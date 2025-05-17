import express from 'express';

const app = express();
const port = 3888;

app.get('/vrchat-report', (req, res) => {
  const { type, userId, userDisplayName, avatarId, avatarName, channelId } = req.query;

  const missingFields = [];
  if (!type) missingFields.push('type');
  if (!userId) missingFields.push('userId');
  if (!userDisplayName) missingFields.push('userDisplayName');
  if (!avatarId) missingFields.push('avatarId');
  if (!avatarName) missingFields.push('avatarName');
  if (!channelId) missingFields.push('channelId')

  if (missingFields.length > 0) {
    return res.status(400).send({
      error: {
        message: `Missing required field(s): ${missingFields.join(', ')}`,
        status_code: 400
      }
    });
  }

  let redirectUrl;

  switch (type) {
    case "nsfw":
      redirectUrl = `https://help.vrchat.com/hc/en-us/requests/new?ticket_form_id=1500000182242` +
      `&tf_360056455174=user_report` +
      `&tf_anonymous_requester_email=${channelId}+abusereports%40blackwolfwoof.com` +
      `&tf_1500001445142=${encodeURIComponent(userDisplayName)}` +
      `&tf_subject=%5BAvatar%5D%20NSFW%20Avatar%20missing%20content_sex%20tag%22${encodeURIComponent(avatarName)}%22` +
      `&tf_description=${encodeURIComponent(`The Avatar in question has adult features but is missing the content_sex tag. The attachments may include media showcasing the avatar.<br>`
        `Avatar ID: ${avatarId}<br>` +
        `Avatar Name: ${avatarName}<br>` +
        `Avatar Owner ID: ${userId}<br>` +
        `Avatar Owner Name: ${userDisplayName}<br><br>` +
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
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
