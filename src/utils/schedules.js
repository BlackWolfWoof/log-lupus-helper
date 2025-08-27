import './loadEnv.js'
import { client } from '../discord/bot.js'
import { checkTermination } from "./terminationChecker.js";
import { emailConnection } from './mail.js'
import { snowflakeOlderThan, findChannelId } from './functions.js'
import { userDb, avatarDb, groupDb, worldDb, countDb } from './quickdb.js'
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
        
        // Close stuff due to inactivity (currently 90d)
        try {
          const allUsers = await userDb.all()
          const allAvatars = await avatarDb.all()
          const allGroups = await groupDb.all()
          const allWorlds = await worldDb.all()

          for (const allEntries of [allUsers, allAvatars, allGroups, allWorlds]) {
            for (const entryBig of allEntries) {
              const snowflake = entryBig.value.discordChannelId
              // If snowflake is older than 90 days, stop tracking
              if (snowflakeOlderThan(snowflake, 90)) {
                // Archive the thread
                try {
                  const entry = await findChannelId(snowflake)
                  if (entry?.id && entry.id.includes('usr_')) {
                    await userDb.delete(entry.id)
                  } else if (entry?.id && entry.id.includes('avtr_')) {
                    await avatarDb.delete(entry.id)
                  } else if (entry?.id && entry.id.includes('grp_')) {
                    await groupDb.delete(entry.id)
                  } else if (entry?.id && entry.id.includes('wrld_')) {
                    await worldDb.delete(entry.id)
                  } else {
                    logWarn(`[schedules]: Entry was not found. Skipping deletion and closing thread.`)
                  }

                  let thread;
                  try {
                    thread = client.channels.cache.get(snowflake);
                    if (!thread) thread = await client.channels.fetch(snowflake);
                  } catch (error) {
                    logWarn(`[schedules]: Channel no longer exists but is still in db. Removed entry`)
                    continue
                  }
                  if (thread.archived) {
                    await thread.setArchived(false, `Unarchived to edit tags`)
                  }
                  await thread.edit({
                    appliedTags: []
                  })
                  await thread.setArchived(true, `Archived because too old`);
                  logInfo(`[schedules]: Thread ${thread.id} - ${thread.name} was archived due to being too old.`)
                  return
                } catch (e) {
                  console.error(e)
                  logError(`[schedules]: Error: ${e}`)
                }
              }
            }
          }
        } catch (e) {
          console.error(e)
          logWarn(`[schedules]: Error: ${e}`)
        }

        // Channel topic stuff
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
          for (const entry of allUsers) {
            if ((entry.value.tickets || []).length !== 0) {
              ticketsOpenUser++
            }
          }
          for (const entry of allAvatars) {
            if ((entry.value.tickets || []).length !== 0) {
              ticketsOpenAvatar++
            }
          }


          // Channel topic
          const sharedMessage = `# Use the \`/report-user\` and \`/report-avatar\` command to create form posts.\n\n### Tracked:\n- 🔢Total: \`${allUsers.length + allAvatars.length}\`\n- 👤Users: \`${allUsers.length}\` 🎫\`${ticketsOpenUser}\`\n- 🖼️Avatars: \`${allAvatars.length}\` 🎫\`${ticketsOpenAvatar}\`\n### Removed:\n- 👤Users: \`${userTotal}\`\n- 🖼️Avatars: \`${avatarTotal}\``

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