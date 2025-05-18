import './loadEnv.js'
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { logDebug, logInfo, logWarn, logError } from './logger.js'
import { emailDb } from './quickdb.js'
import { client as discordClient } from '../discord/bot.js'
import { convert } from 'html-to-text'
import { sleep } from './functions.js'

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
    let lock = await client.getMailboxLock('INBOX');
    try {
      // Search for all messages from tickets@vrchat.com
      const messages = await client.search({ from: 'tickets@vrchat.com', to: 'abusereports@blackwolfwoof.com' });
      if (messages.length === 0) {
        logDebug('[email]: No emails found from tickets@vrchat.com');
      } else {
        logDebug(`[email]: Found ${messages.length} emails from tickets@vrchat.com to abusereports@blackwolfwoof.com`);

        // Fetch subject and date from each message
        for await (let msg of client.fetch(messages, { envelope: true, source: true })) {
          const subject = msg.envelope.subject || '(No Subject)';
          const date = msg.envelope.date;
          const recipients = msg.envelope.to.map(to => to.address).join(', ');
          // console.log(`[email]: [${date}] To: ${recipients} | Subject: ${subject}`);
          
          // Check if the email starts with abusereports@blackwolfwoof.com to only include automated reports
          const regex = /\(Automated (\d{19})\) #\d+$/;

          const match = regex.exec(msg.envelope.subject);
          if (match) {
            // Extract the 19-digit number from capture group 1
            const channelId = match[1];

            // Check the email id against the db and skip if already known
            const skipEmail = await emailDb.has(msg.id);
            if (!skipEmail) {
              // Parse email body
              const parsed = await simpleParser(msg.source, {
                skipImageLinks: true,
                skipAttachments: true
              });

              let thread = discordClient.channels.cache.get(channelId);
              if (!thread) thread = await discordClient.channels.fetch(channelId);
              if (thread.archived) {
                await emailDb.set(msg.id, 0)
                continue
              } 
              // Send email in thread
              await thread.send(`## ${parsed.subject}\n${convert(parsed.html)}`)
              await emailDb.set(msg.id, 0)
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
      const lock = await client.getMailboxLock('INBOX');
      lock.release();

      client.on('exists', async (seq) => {
        logDebug(`[email]: New email detected.`);
        await processNewEmail(seq);
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