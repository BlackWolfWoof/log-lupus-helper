import { readdir } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { logDebug, logError } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const commands = new Map();
const interactions = new Map();

/**
 * Loads all Discord command files from the commands directory.
 */
export async function loadDiscordCommands() {
  const commandsPath = path.join(__dirname, 'commands');

  try {
    const files = await readdir(commandsPath, { withFileTypes: true });

    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.js')) {
        const fullPath = path.join(commandsPath, file.name);

        const commandModule = await import(pathToFileURL(fullPath));
        if (commandModule.default?.discord) {
          // Convert SlashCommandBuilder instance to JSON
          const discordCommand = commandModule.default.discord.toJSON();

          // Store command information
          const commandData = {
            discord: discordCommand, // JSON version of the command
            execute: commandModule.default.execute || (() => {}),
          };

          commands.set(discordCommand.name, commandData);
          logDebug(`[Discord Handler]: ✅ Loaded command: \x1b[4;37m${discordCommand.name}\x1b[0m`);
        }
      }
    }
  } catch (error) {
    logError(`[Discord Handler]: ❌ Error loading commands - ${error.message}`);
    throw error;
  }
}

/**
 * Loads all interaction handlers from the interactions directory.
 */
export async function loadInteractions() {
  const interactionsPath = path.join(__dirname, 'interactions');

  async function loadFiles(directory) {
    try {
      const files = await readdir(directory, { withFileTypes: true });

      for (const file of files) {
        const fullPath = path.join(directory, file.name);

        if (file.isDirectory()) {
          // Recursively load interactions from subdirectories
          await loadFiles(fullPath);
        } else if (file.isFile() && file.name.endsWith('.js')) {
          const interactionId = path.basename(fullPath, '.js');
          const interactionModule = await import(pathToFileURL(fullPath));

          if (interactionModule.default?.execute) {
            interactions.set(interactionId, interactionModule.default.execute);
            logDebug(`[Discord Handler]: ✅ Loaded interaction: \x1b[4;37m${interactionId}\x1b[0m`);
          }
        }
      }
    } catch (error) {
      logError(`[Discord Handler]: ❌ Error loading interactions from ${directory} - ${error.message}`);
      throw error
    }
  }

  await loadFiles(interactionsPath);
}


export { commands, interactions };
