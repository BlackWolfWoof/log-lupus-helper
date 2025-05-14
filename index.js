import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

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
        console.log('Connected to mail server.');

        // Select and lock the inbox
        let lock = await client.getMailboxLock('INBOX');
        try {
            // Search for all messages from tickets@vrchat.com
            const messages = await client.search({ from: 'tickets@vrchat.com' });

            if (messages.length === 0) {
                console.log('No emails found from tickets@vrchat.com');
            } else {
                console.log(`Found ${messages.length} emails from tickets@vrchat.com:\n`);

                // Fetch subject and date from each message
                for await (let msg of client.fetch(messages, { envelope: true, source: true })) {
                    const subject = msg.envelope.subject || '(No Subject)';
                    const date = msg.envelope.date;
                    console.log(`- [${date}] ${subject}`);

                    // Parse email body
                    const parsed = await simpleParser(msg.source, {
                        skipImageLinks: true,
                        skipAttachments: true
                    });
                    console.log(parsed.text || '[No plain text]');

                    // Optional: break early
                    process.exit(0); // Remove or modify if processing all emails
                }
            }
        } finally {
            lock.release();
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.logout();
        console.log('Logged out.');
    }
}

listEmailsFromVRChat();
