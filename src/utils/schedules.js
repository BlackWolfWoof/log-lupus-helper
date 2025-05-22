import { client } from '../discord/bot.js'
import { checkTermination } from "./terminationChecker.js";
import { emailConnection } from './mail.js'
import { userDb, avatarDb, countDb } from './quickdb.js'
import { logDebug, logInfo, logWarn, logError } from './logger.js'

async function main () {
  try {
    // setInterval(async () => {
    //   await doIntervalGroupLog();
    // }, 300000); // 5 Minutes

    setInterval(async () => {
      // Make sure the discord client is ready as well
      (async () => {
        while (!client.isReady()) await new Promise(res => setTimeout(res, 1000))
        await checkTermination()
        
        try {
          // Edit channel with stats
          let channelUser = client.channels.cache.get(process.env["CHANNEL_ID_USER"]);
          if (!channelUser) channelUser = await client.channels.fetch(channelId);
          let channelAvatar = client.channels.cache.get(process.env["CHANNEL_ID_AVATAR"]);
          if (!channelAvatar) channelAvatar = await client.channels.fetch(channelId);

          // Get all entries from channel channelUser and channelAvatar
          const allUsers = await userDb.all()
          const allAvatars = await avatarDb.all()
          const countAll = await countDb.all()

          // Calc
          let userTotal = 0;
          let avatarTotal = 0;

          // Count for avatar and user total
          for (const entry of countAll) {
              if (typeof entry.value !== 'number') continue;

              if (entry.id.startsWith('user-')) {
                  userTotal += entry.value;
              } else if (entry.id.startsWith('avatar-')) {
                  avatarTotal += entry.value;
              }
          }


          // Count for open tickets. Resolved and not resolved
          let ticketsOpenUser = 0;
          let ticketsOpenAvatar = 0;
          for (entry of allUsers) {
            if (entry.value.ticket) {
              ticketsOpenUser++
            }
          }
          for (entry of allAvatars) {
            if (entry.value.ticket) {
              ticketsOpenAvatar++
            }
          }


          // Channel topic
          const sharedMessage = `# Use the \`/report-user\` and \`/report-avatar\` command to create form posts.\n\n### Total tracked: ${allUsers.length + allAvatars.length} ### Tracked:\n- 👤Users: \`${allUsers.length}\` 🎫\`${ticketsOpenUser}\`\n- 🖼️Avatars: \`${allAvatars.length}\` 👤\`${ticketsOpenAvatar}\`\n### Terminated:\n- Terminated users: \`${userTotal}\`\n- Terminated avatars: \`${avatarTotal}\``

          await channelUser.setTopic(sharedMessage)
          await channelAvatar.setTopic(sharedMessage)
        } catch (error) {
          logError(`[schedules]: Something crashed when calculating the stats. ${error}`)
          console.error(error)
        }

      })();
    }, 1800000); // 30min

  } catch (e) {
    logError(`[schedules]: Fatal error that crashed the loop. Restarting loops. Error: ${e}`)
    console.error(e)
  }
}

(async () => {
    // Make sure the discord client is ready as well
    (async () => {
      while (!client.isReady()) await new Promise(res => setTimeout(res, 1000))
      // await listEmailsFromVRChat()
      emailConnection()
      await checkTermination() // Run it once
    })();
    await main(); // Start loop
})()