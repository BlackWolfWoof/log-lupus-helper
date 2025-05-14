import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { logDebug, logInfo, logWarn, logError } from './logger.js'
import dotenv from "dotenv"; dotenv.config()

async function listEmailsFromVRChat() {
        const client = new ImapFlow({
        host: process.env["IMAP_IP"],
        port: process.env["IMAP_PORT"],
        secure: false,
        tls: {
            rejectUnauthorized: false // <-- Allow self-signed certs
        },
        auth: {
            user: process.env["IMAP_UN"],
            pass: process.env["IMAP_PW"]
        },
        logger: false
    });

    try {
        // Connect and login
        await client.connect();
        logDebug('[mail]: Connected to mail server.');

        // Select and lock the inbox
        let lock = await client.getMailboxLock('INBOX');
        try {
            // Search for all messages from tickets@vrchat.com
            const messages = await client.search({ from: 'tickets@vrchat.com' });

            if (messages.length === 0) {
                logDebug('[mail]: No emails found from tickets@vrchat.com');
            } else {
                logDebug(`[mail]: Found ${messages.length} emails from tickets@vrchat.com:\n`);

                // Fetch subject and date from each message
                for await (let msg of client.fetch(messages, { envelope: true, source: true })) {
                    const subject = msg.envelope.subject || '(No Subject)';
                    const date = msg.envelope.date;
                    // logInfo(`[email]: [${date}] ${subject}`);

                    // Parse email body
                    const parsed = await simpleParser(msg.source, {
                        skipImageLinks: true,
                        skipAttachments: true
                    });
                    // logInfo(`[email]: ${parsed.text || '[No plain text]'}`);
                }
            }
        } finally {
            lock.release();
        }
    } catch (err) {
        logError(`[email]: error: ${err}`)
        console.error('Error:', err);
    } finally {
        await client.logout();
        logDebug('[email]: Logged out.');
    }
}

listEmailsFromVRChat();
