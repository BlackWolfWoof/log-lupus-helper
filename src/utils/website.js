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

      // Avatar
      case "avatar-nsfw":
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
      case "avatar-crasher":
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

      // User
      case "user-racism":
        redirectUrl = `https://help.vrchat.com/hc/en-us/requests/new?ticket_form_id=1500000182242` +
        `&tf_360056455174=user_report` +
        `&tf_anonymous_requester_email=abusereports%40blackwolfwoof.com` +
        `&tf_1500001445142=${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}` +
        `&tf_subject=%5BUser%5D%20Racist%20user%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}%22%20%28Automated%20${channelId}%29` +
        `&tf_description=${encodeURIComponent(`The user in question is using offensive/racist language. The attachments may include media showcasing the users behavior.<br><br>` +
          `Offending User ID: ${entry.id}<br>` +
          `Offending User Name: ${sanitizeText(entry.value.vrc.displayName)}<br><br>` +
          `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
        break
      case "user-nsfw":
        redirectUrl = `https://help.vrchat.com/hc/en-us/requests/new?ticket_form_id=1500000182242` +
        `&tf_360056455174=user_report` +
        `&tf_anonymous_requester_email=abusereports%40blackwolfwoof.com` +
        `&tf_1500001445142=${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}` +
        `&tf_subject=%5BUser%5D%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}%22%20uses%20adult%20avatar%20in%20public;%20User%20%20%28Automated%20${channelId}%29` +
        `&tf_description=${encodeURIComponent(`The user in question is using an avatar with adult features in a none age gated instance. The avatar itself is properly tagged as content_sex. The attachments may include media showcasing the users behavior.<br><br>` +
          `Offending User ID: ${entry.id}<br>` +
          `Offending User Name: ${sanitizeText(entry.value.vrc.displayName)}<br><br>` +
          `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
        break
      case "user-child":
        redirectUrl = `https://help.vrchat.com/hc/en-us/requests/new?ticket_form_id=1500000182242` +
        `&tf_360056455174=user_report` +
        `&tf_anonymous_requester_email=abusereports%40blackwolfwoof.com` +
        `&tf_1500001445142=${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}` +
        `&tf_subject=%5BUser%5D%20Underage%20user%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}%22%20%28Automated%20${channelId}%29` +
        `&tf_description=${encodeURIComponent(`The user in question is under the legal age of 13 to play VRChat. The attachments may include media showcasing the users behavior and voice as well as other evidence.<br><br>` +
          `Offending User ID: ${entry.id}<br>` +
          `Offending User Name: ${sanitizeText(entry.value.vrc.displayName)}<br><br>` +
          `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
        break
      case "user-pedo":
        redirectUrl = `https://help.vrchat.com/hc/en-us/requests/new?ticket_form_id=1500000182242` +
        `&tf_360056455174=user_report` +
        `&tf_anonymous_requester_email=abusereports%40blackwolfwoof.com` +
        `&tf_1500001445142=${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}` +
        `&tf_subject=%5BUser%5D%20Pedophelia%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}%22%20%28Automated%20${channelId}%29` +
        `&tf_description=${encodeURIComponent(`I encountered a user exhibiting predatory behavior toward minors in VRChat. They made inappropriate comments and attempted to engage in grooming behavior. The attachments may include media showcasing the users behavior and voice as well as other evidence.<br><br>` +
          `Offending User ID: ${entry.id}<br>` +
          `Offending User Name: ${sanitizeText(entry.value.vrc.displayName)}<br><br>` +
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
