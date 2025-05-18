import express from 'express';
import { logDebug, logInfo, logWarn, logError } from './logger.js'
import { findChannelId, sanitizeText } from './functions.js'

const app = express();
const port = 3888;

app.get('/vrchat-report', async (req, res) => {
  try {
    const { channelId } = req.query;

    if (!channelId) {
      return res.status(400).send({
        error: {
          message: `Missing required field 'channelId'`,
          status_code: 400
        }
      });
    }
    const entry = await findChannelId(channelId)
    if (!entry) {
      return res.status(401).send({
        error: {
          message: 'Unauthorized',
          status_code: 401
        }
      });
    }

    let redirectUrl;

    switch (entry.value.type) {
      case "nsfw":
        redirectUrl = `https://help.vrchat.com/hc/en-us/requests/new?ticket_form_id=1500000182242` +
        `&tf_360056455174=user_report` +
        `&tf_anonymous_requester_email=abusereports%40blackwolfwoof.com` +
        `&tf_1500001445142=${encodeURIComponent(sanitizeText(entry.value.authorDisplayName))}` +
        `&tf_subject=%5BAvatar%5D%20NSFW%20Avatar%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.name))}%22%20is%20missing%20content_sex%20tag%20%28Automated%20${channelId}%29` +
        `&tf_description=${encodeURIComponent(`The Avatar in question has adult features but is missing the content_sex tag. The attachments may include media showcasing the avatar.<br><br>` +
          `Avatar ID: ${entry.id}<br>` +
          `Avatar Name: ${sanitizeText(entry.value.vrc.name)}<br>` +
          `Avatar Owner ID: ${entry.value.vrc.authorId}<br>` +
          `Avatar Owner Name: ${sanitizeText(entry.value.authorDisplayName)}<br><br>` +
          `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
        break
      case "crasher":
        redirectUrl = `https://help.vrchat.com/hc/en-us/requests/new?ticket_form_id=1500000182242` +
        `&tf_360056455174=user_report` +
        `&tf_anonymous_requester_email=abusereports%40blackwolfwoof.com` +
        `&tf_1500001445142=${encodeURIComponent(sanitizeText(entry.value.authorDisplayName))}` +
        `&tf_subject=%5BAvatar%5D%20Crasher%20Avatar%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.name))}%22%20%28Automated%20${channelId}%29` +
        `&tf_description=${encodeURIComponent(`The Avatar in question disrupts the gameplay by crashing/lagging the client of the users. The attachments may include media showcasing the avatar.<br><br>` +
          `Avatar ID: ${entry.id}<br>` +
          `Avatar Name: ${sanitizeText(entry.value.vrc.name)}<br>` +
          `Avatar Owner ID: ${entry.value.vrc.authorId}<br>` +
          `Avatar Owner Name: ${sanitizeText(entry.value.authorDisplayName)}<br><br>` +
          `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
        break
      default:
        return res.status(400).send({
          "error": {
            "message": "Type not found",
            "status_code": 400
          }
        });
    }
    res.redirect(redirectUrl);
  } catch (error) {
    logError(`[website]: Internal server error. ${error}`)
    console.error(error)
    return res.status(500).send({
      "error": {
        "message": "Internal server error",
        "status_code": 500
      }
    })
  }
})

app.listen(port, () => {
  logDebug(`[website]: Server running at http://localhost:${port}`);
});
