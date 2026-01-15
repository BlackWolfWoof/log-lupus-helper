import express from 'express';
import { Registry, Gauge, collectDefaultMetrics } from 'prom-client';
import { userDb, avatarDb, groupDb, worldDb, countDb } from './quickdb.js';
import { logInfo } from './logger.js';

// --- Prometheus setup ---
const register = new Registry();
// collectDefaultMetrics({ register });

// --- Metric definitions ---

// Snapshot metric for various ticket stats per entity
const ticketsInfo = new Gauge({
  name: 'tickets_info',
  help: 'Current ticket metrics by entity and type (ticketCount and emailCount)',
  labelNames: ['name', 'discordChannelId', 'emailCount'],
});
register.registerMetric(ticketsInfo);

// Snapshot metric for total resolved tickets per category
const resolvedTickets = new Gauge({
  name: 'resolved_tickets',
  help: 'Number of resolved tickets per category',
  labelNames: ['name'],
});
register.registerMetric(resolvedTickets);

// --- Metric update function ---
async function updateMetrics() {
  try {
    const allUsers = await userDb.all();
    const allAvatars = await avatarDb.all();
    const allGroups = await groupDb.all();
    const allWorlds = await worldDb.all();
    const countAll = await countDb.all();

    // Reset before re-setting
    ticketsInfo.reset();
    resolvedTickets.reset();

    // --- Update resolved tickets (from countDb) ---
    for (const entry of countAll) {
      const name = entry.id;
      const value = entry.value || 0;
      resolvedTickets.labels(name).set(value);
    }

    // --- Helper to process entity metrics ---
    const updateEntityMetrics = (entityName, entries) => {
      for (const entry of entries) {
        const name = entry.value.type || 'unknown';
        const discordChannelId = entry.value.discordChannelId || 'none';
        const emailCount = (entry.value.tickets ?? []).length;

        ticketsInfo.labels(name, discordChannelId, emailCount).set(1);
      }
    };

    // --- Update all datasets ---
    updateEntityMetrics('user', allUsers);
    updateEntityMetrics('avatar', allAvatars);
    updateEntityMetrics('group', allGroups);
    updateEntityMetrics('world', allWorlds);

  } catch (err) {
    console.error('Error updating metrics:', err);
  }
}

// Run immediately and then every 15 seconds
updateMetrics();
setInterval(updateMetrics, 15_000);

// --- Express setup ---
const app = express();

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).send(err.message);
  }
});

const PORT = process.env.METRICS_PORT || 8901;
app.listen(PORT, () => {
  logInfo(`[prometheusExporter]: Webserver running at http://localhost:${PORT}/metrics`);
});
