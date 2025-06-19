import express from 'express';
import { logDebug, logInfo, logWarn, logError } from './logger.js'
import { findChannelId, sanitizeText, ReportPrefill } from './functions.js'

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
    } else if (entry.value.tickets && entry.value.tickets.length !== 0) {
      return res.status(409).send({
        error: {
          message: 'Ticket already exists for this this post. To prevent dupes, you can only create one',
          status_code: 409
        }
      });
    }

    let redirectUrl;

    const prefill = new ReportPrefill();
    const baseUrl = "https://help.vrchat.com/hc/en-us/requests/new?ticket_form_id=41536165070483&tf_anonymous_requester_email=abusereports%40blackwolfwoof.com"

    let reportKey;
    let reportTypeKey
    let subkey = null
    let additionalText

    if (entry.value.type.includes('avatar-')) {
      // Avatar only has one category and the description has to describe it
      reportKey = "user_report"; // I want to file a report
      reportTypeKey = "content_report"; // Content Report
      subkey = "content_report_avatar"; // Avatar
      additionalText = entry.id; // Avatar ID
      let urlParams = prefill.getUrlParam("report", reportKey);
      if (prefill.shouldShowReportType(reportKey)) {
        urlParams += prefill.getUrlParamsWithText("report_type", reportTypeKey, subkey, additionalText);
      }

      switch (entry.value.type) {
        case "avatar-nsfw":
        redirectUrl = baseUrl +
          urlParams +
          `&tf_subject=%5BAvatar%5D%20NSFW%20Avatar%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.name))}%22%20is%20missing%20content_sex%20tag%20%28Automated%20${channelId}%29` +
          `&tf_description=${encodeURIComponent(`The Avatar in question has adult features but is missing the content_sex tag. The attachments may include media showcasing the avatar.<br><br>` +
          `Avatar ID: ${entry.id}<br>` +
          `Avatar Name: ${sanitizeText(entry.value.vrc.name)}<br>` +
          `Avatar Owner ID: ${entry.value.vrc.authorId}<br>` +
          `Avatar Owner Name: ${sanitizeText(entry.value.authorDisplayName)}<br><br>` +
          `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`
        break
      case "avatar-crasher":
        redirectUrl = baseUrl +
          urlParams +
          `&tf_subject=%5BAvatar%5D%20Crasher%20Avatar%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.name))}%22%20%28Automated%20${channelId}%29` +
          `&tf_description=${encodeURIComponent(`The Avatar in question disrupts the gameplay by crashing/lagging the client of the users. The attachments may include media showcasing the avatar.<br><br>` +
            `Avatar ID: ${entry.id}<br>` +
            `Avatar Name: ${sanitizeText(entry.value.vrc.name)}<br>` +
            `Avatar Owner ID: ${entry.value.vrc.authorId}<br>` +
            `Avatar Owner Name: ${sanitizeText(entry.value.authorDisplayName)}<br><br>` +
            `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
        break
      case "avatar-racist":
        redirectUrl = baseUrl +
          urlParams +
          `&tf_subject=%5BAvatar%5D%20Racist%20Avatar%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.name))}%22%20%28Automated%20${channelId}%29` +
          `&tf_description=${encodeURIComponent(`The Avatar in question is offensive/racist. The attachments may include media showcasing the avatar.<br><br>` +
            `Avatar ID: ${entry.id}<br>` +
            `Avatar Name: ${sanitizeText(entry.value.vrc.name)}<br>` +
            `Avatar Owner ID: ${entry.value.vrc.authorId}<br>` +
            `Avatar Owner Name: ${sanitizeText(entry.value.authorDisplayName)}<br><br>` +
            `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
        break
      case "avatar-other":
        redirectUrl = baseUrl +
          urlParams +
          `&tf_subject=%5BAvatar%5D%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.name))}%22%20%28Automated%20${channelId}%29` +
          `&tf_description=${encodeURIComponent(`The attachments may include media showcasing the avatar.<br><br>` +
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

    } else if (entry.value.type.includes('user-')) {
      //User report (has different categories)
      reportKey = "user_report"; // I want to file a report
      reportTypeKey = "account_report"; // Content Report
      additionalText = entry.id; // User ID
      let urlParams = prefill.getUrlParam("report", reportKey);
      if (prefill.shouldShowReportType(reportKey)) {
        urlParams += prefill.getUrlParamsWithText("report_type", reportTypeKey, subkey, additionalText);
      }

      const userReport = entry.value.type.slice(5) // user-racism turns into racism
      switch (userReport) {
        case 'racism':
          redirectUrl = baseUrl +
            urlParams +
            `&tf_subject=%5BUser%5D%20Racist%20User%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}%22%20%28Automated%20${channelId}%29` +
            `&tf_description=${encodeURIComponent(`The user in question is using offensive/racist language. The attachments may include media showcasing the users behavior.<br><br>` +
              `Offending User ID: ${entry.id}<br>` +
              `Offending User Name: ${sanitizeText(entry.value.vrc.displayName)}<br><br>` +
              `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
          break
        case 'nsfw':
          redirectUrl = baseUrl +
            urlParams +
            `&tf_subject=%5BUser%5D%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}%22%20uses%20adult%20avatar%20in%20public%20%20%28Automated%20${channelId}%29` +
            `&tf_description=${encodeURIComponent(`The user in question is using an avatar with adult features in a none age gated instance. The avatar itself is properly tagged as content_sex. The attachments may include media showcasing the users behavior.<br><br>` +
              `Offending User ID: ${entry.id}<br>` +
              `Offending User Name: ${sanitizeText(entry.value.vrc.displayName)}<br><br>` +
              `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
          break
        case 'child':
          redirectUrl = baseUrl +
            urlParams +
            `&tf_subject=%5BUser%5D%20Underage%20User%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}%22%20%28Automated%20${channelId}%29` +
            `&tf_description=${encodeURIComponent(`The user in question is under the legal age of 13 to play VRChat. The attachments may include media showcasing the users behavior and voice as well as other evidence.<br><br>` +
            `Offending User ID: ${entry.id}<br>` +
            `Offending User Name: ${sanitizeText(entry.value.vrc.displayName)}<br><br>` +
            `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
          break
        case 'pedo':
          redirectUrl = baseUrl +
            urlParams +
              `&tf_subject=%5BUser%5D%20Pedophelia%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}%22%20%28Automated%20${channelId}%29` +
              `&tf_description=${encodeURIComponent(`I encountered a user exhibiting predatory behavior toward minors in VRChat. They made inappropriate comments and attempted to engage in grooming behavior. The attachments may include media showcasing the users behavior and voice as well as other evidence.<br><br>` +
              `Offending User ID: ${entry.id}<br>` +
              `Offending User Name: ${sanitizeText(entry.value.vrc.displayName)}<br><br>` +
              `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
          break
        case 'media':
          redirectUrl = baseUrl +
            urlParams +
            `&tf_subject=%5BUser%5D%20Pedophelia%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}%22%20%28Automated%20${channelId}%29` +
            `&tf_description=${encodeURIComponent(`I encountered a user exhibiting predatory behavior toward minors in VRChat. They made inappropriate comments and attempted to engage in grooming behavior. The attachments may include media showcasing the users behavior and voice as well as other evidence.<br><br>` +
            `Offending User ID: ${entry.id}<br>` +
            `Offending User Name: ${sanitizeText(entry.value.vrc.displayName)}<br><br>` +
            `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
          break
        case 'badusername':
          redirectUrl = baseUrl +
            urlParams +
            `&tf_subject=%5BUser%5D%20Bad%20Username%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}%22%20%28Automated%20${channelId}%29` +
            `&tf_description=${encodeURIComponent(`I encountered a user with a bad username. This username contains offensive and inappropriate content, including references that violate community standards.<br><br>` +
            `Offending User ID: ${entry.id}<br>` +
            `Offending User Name: ${sanitizeText(entry.value.vrc.displayName)}<br><br>` +
            `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
          break
        case 'selfharm':
          redirectUrl = baseUrl +
            urlParams +
            `&tf_subject=%5BUser%5D%20Threats%20%2F%20Promoting%20Self-Harm%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}%22%20%28Automated%20${channelId}%29` +
            `&tf_description=${encodeURIComponent(`I encountered a user threatening or promoting self-harm. The attachments may include media showcasing the users and voice as well as other evidence.<br><br>` +
            `Offending User ID: ${entry.id}<br>` +
            `Offending User Name: ${sanitizeText(entry.value.vrc.displayName)}<br><br>` +
            `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
          break
        case 'crasher':
          redirectUrl = baseUrl +
            urlParams +
            `&tf_subject=%5BUser%5D%20Crasher%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}%22%20%28Automated%20${channelId}%29` +
            `&tf_description=${encodeURIComponent(`The User in question disrupts the gameplay by crashing/lagging the client of the users. The attachments may include media showcasing the users behavior and voice as well as other evidence.<br><br>` +
            `Offending User ID: ${entry.id}<br>` +
            `Offending User Name: ${sanitizeText(entry.value.vrc.displayName)}<br><br>` +
            `<b>This is a semi automated report. For issues please contact wolf@blackwolfwoof.com</b>`)}`;
          break
        case 'other':
          redirectUrl = baseUrl +
            urlParams +
            `&tf_subject=%5BUser%5D%20%22${encodeURIComponent(sanitizeText(entry.value.vrc.displayName))}%22%20%28Automated%20${channelId}%29` +
            `&tf_description=${encodeURIComponent(`The attachments may include media showcasing the users behavior and voice as well as other evidence.<br><br>` +
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


      subkey = "content_report_avatar"; // Avatar
      additionalText = entry.id; // Avatar ID
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
