import './loadEnv.js'
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { logDebug, logInfo, logWarn, logError } from './logger.js'
import { avatarDb, userDb, emailDb } from './quickdb.js'
import { client as discordClient } from '../discord/bot.js'
import { convert } from 'html-to-text'
import { findChannelId, sleep, sha256Hash, addTicket, isTicketHashUsed, findTicketId } from './functions.js'
import { scrapeChannelId } from './puppeteer.js';

const client = new ImapFlow({
    host: process.env["IMAP_IP"],
    port: process.env["IMAP_PORT"],
    secure: false,
    tls: {
        rejectUnauthorized: false
    },
    auth: {
        user: process.env["IMAP_UN"],
        pass: process.env["IMAP_PW"]
    },
    logger: false
});

export async function processNewEmail() {
  try {
    // Connect and login
    // await client.connect();
    // logDebug('[email]: Connected to mail server.');

    // Select and lock the inbox
    let lock = await client.getMailboxLock('Archive'); //INBOX
    try {
      // Search for all messages from tickets@vrchat.com
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const messages = await client.search({ from: 'tickets@vrchat.com', to: 'abusereports@blackwolfwoof.com', sentSince: sevenDaysAgo });
      if (messages.length === 0) {
        logDebug('[email]: No emails found from tickets@vrchat.com');
      } else {
        logDebug(`[email]: Found ${messages.length} emails from tickets@vrchat.com to abusereports@blackwolfwoof.com`);

        // Fetch subject and date from each message
        for await (let msg of client.fetch(messages, { envelope: true, source: true })) {
          const subject = msg.envelope.subject || '(No Subject)';
          const date = msg.envelope.date;

          const htmlRegex = /https:\/\/help\.vrchat\.com\/hc\/requests\/(\d+)/

          const emailHash = sha256Hash(`${date}-${subject}`)
          const skipEmail = await isTicketHashUsed(emailHash)

          if (!skipEmail) {
            // Parse email body
            const parsed = await simpleParser(msg.source, {
              skipImageLinks: true,
              skipAttachments: true
            });
            const idMatch = htmlRegex.exec(parsed.html)
            const ticketId = idMatch[1]

            let channelId = await findTicketId(ticketId)
            const staleEmail = await emailDb.has(emailHash)
            if (!channelId && !staleEmail) {
              logDebug(`[email]: [${date}] Subject: ${subject}`);
              // Scrape channel id from website
              const scrape = await scrapeChannelId(ticketId)
              const regex = /\(Automated (\d{19})\)/;
              const match = regex.exec(scrape)
              logDebug(`[email <-> zendesk] ${match[1]} belongs to ${ticketId}`)
              channelId = match[1]
              if (match) {
                if (await findChannelId(match[1])) {
                  try {
                    let thread = discordClient.channels.cache.get(channelId);
                    if (!thread) thread = await discordClient.channels.fetch(channelId);
                    if (thread.archived) thread.setArchived(false)
                    // Send email in thread
                    await thread.send(`## ${parsed.subject}\n${convert(parsed.html)}`)
                    await thread.edit({
                      appliedTags: [process.env["DISCORD_USER_TICKET_TAG_ID"], process.env["DISCORD_AVATAR_TICKET_TAG_ID"], process.env["DISCORD_GROUP_TICKET_TAG_ID"], process.env["DISCORD_WORLD_TICKET_TAG_ID"]] // Replace with ticket open tag
                    })
                    // Save that we processed the email already
                    // Save that we now have an email
                    const entry = await findChannelId(channelId)
                    // if (!entry) new Error(`Entry doesn't exist`)
                    entry.ticketId = ticketId
                    await addTicket(entry, emailHash)
                  } catch (error) {
                    // Delete the entry as the channel no longer exists and i cannot send a message to it anymore
                    // Figure out if it is a userDb or avatarDb entry
                    const entry = await findChannelId(channelId)
                    if (entry?.id && entry.id.includes('usr_')) {
                      await userDb.delete(entry.id)
                    } else if (entry?.id && entry.id.includes('avtr_')) {
                      await avatarDb.delete(entry.id)
                    } else if (entry?.id && entry.id.includes('grp_')) {
                      await avatarDb.delete(entry.id)
                    } else if (entry?.id && entry.id.includes('wrld_')) {
                      await avatarDb.delete(entry.id)
                    }
                  }
                } else {
                  await emailDb.set(emailHash, new Date())
                  logDebug(`[email]: Stale email found: ${emailHash}`)
                }
              }
            }
          }
        }
      }
    } catch (error) {
      logError(`[email]: An error has occured: ${error}`)
      console.error(error)
    } finally {
        lock.release();
    }
  } catch (err) {
    logError(`[email]: error: ${err}`)
    console.error('Error:', err);
  }
}

export async function emailConnection() {
  while (true) {
    try {
      await client.connect();
      logInfo('[email]: Connected and waiting for new emails...');

      // Immediately release mailbox lock to trigger exists listener properly
      const lock = await client.getMailboxLock('Archive'); // INBOX
      lock.release();
      await processNewEmail()
      client.on('exists', async (seq) => {
        logDebug(`[email]: New email detected.`);
        await processNewEmail();
      });

      client.on('error', (err) => {
        logError(`[email]: IMAP error: ${err}`);
      });

      client.on('close', async () => {
        logWarn('[email]: Connection closed, will retry in 10 minutes...');
        await sleep(600000); // 10 minutes
      });

      // Prevent main from exiting
      await new Promise(() => {});

    } catch (error) {
      await client.logout();
      logError(`[email]: Fatal error in emailConnection(): ${error}`);
      console.error(error);
      logInfo('[email]: Retrying connection in 10 minutes...');
      await sleep(600000); // 10 minutes delay before retry
    }
  }
}