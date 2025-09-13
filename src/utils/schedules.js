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
          let channelGroup = client.channels.cache.get(process.env["CHANNEL_ID_GROUP"]);
          if (!channelGroup) channelGroup = await client.channels.fetch(channelId);
          let channelWorld = client.channels.cache.get(process.env["CHANNEL_ID_WORLD"]);
          if (!channelWorld) channelWorld = await client.channels.fetch(channelId);

          // Get all entries from channel channelUser and channelAvatar
          const allUsers = await userDb.all()
          const allAvatars = await avatarDb.all()
          const allGroups = await groupDb.all()
          const allWorlds = await worldDb.all()
          const countAll = await countDb.all()

          // Calc
          let userTotal = 0;
          let avatarTotal = 0;
          let groupTotal = 0;
          let worldTotal = 0;

          // Count for avatar and user total
          // for (const entry of countAll) {
          //     if (typeof entry.value !== 'number') continue;

          //     if (entry.id.startsWith('user-')) {
          //         userTotal += entry.value;
          //     } else if (entry.id.startsWith('avatar-')) {
          //         avatarTotal += entry.value;
          //     }
          // }


          // Count for open tickets. Resolved and not resolved
          let ticketsOpenUser = 0;
          let ticketsOpenAvatar = 0;
          let ticketsOpenGroup = 0;
          let ticketsOpenWorld = 0;
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
          for (const entry of allGroups) {
            if ((entry.value.tickets || []).length !== 0) {
              ticketsOpenGroup++
            }
          }
          for (const entry of allWorlds) {
            if ((entry.value.tickets || []).length !== 0) {
              ticketsOpenWorld++
            }
          }


          // Lookup tables for value → name
          const avatarReasons = [
              { name: 'Crasher', value: 'avatar-crasher' },
              { name: 'NSFW', value: 'avatar-nsfw' },
              { name: 'Racist', value: 'avatar-racist' },
              { name: 'Other reason', value: 'avatar-other' },
          ];

          const userReasons = [
              { name: 'Racist', value: 'user-racism' },
              { name: 'NSFW avatar in public', value: 'user-nsfw' },
              { name: 'Underage', value: 'user-child' },
              { name: 'Pedophile', value: 'user-pedo' },
              { name: 'Bad Sticker/Print', value: 'user-media' },
              { name: 'Promoting Selfharm', value: 'user-selfharm' },
              { name: 'Bad Username', value: 'user-badusername' },
              { name: 'Crasher', value: 'user-crasher' },
              { name: 'Other reason', value: 'user-other' },
          ];
          const groupReasons = [
            { name: 'Racist', value: 'group-racism' },
            { name: 'Pedophile', value: 'group-pedo' },
            { name: 'Bad Banner/Icon', value: 'group-media' },
            { name: 'Promoting Selfharm', value: 'group-selfharm' },
            { name: 'Bad Groupname', value: 'group-badgroupname' },
            { name: 'Crasher', value: 'group-crasher' },
            { name: 'Other reason', value: 'group-other' }
          ];
          const worldReasons= [
            { name: 'Racist', value: 'world-racism' },
            { name: 'Pedophile', value: 'world-pedo' },
            { name: 'Bad Media', value: 'world-media' },
            { name: 'Promoting Selfharm', value: 'world-selfharm' },
            { name: 'Bad Worldname', value: 'world-badworldname' },
            { name: 'Crasher', value: 'world-crasher' },
            { name: 'Other reason', value: 'world-other' }
          ]

          // Convert to maps for quick lookup
          const reasonNameMap = new Map([
              ...avatarReasons.map(r => [r.value, r.name]),
              ...userReasons.map(r => [r.value, r.name]),
              ...groupReasons.map(r => [r.value, r.name]),
              ...worldReasons.map(r => [r.value, r.name])
          ]);

          const breakdown = { users: {}, avatars: {}, groups: {}, worlds: {} };

          for (const entry of countAll) {
              if (typeof entry.value !== 'number') continue;

              const nameOrValue = reasonNameMap.get(entry.id) || entry.id;

              if (entry.id.startsWith('user-')) {
                  console.log(`${entry.id} - ${entry.value}`)
                  userTotal += entry.value;
                  breakdown.users[nameOrValue] = (breakdown.users[nameOrValue] || 0) + entry.value;
              } else if (entry.id.startsWith('avatar-')) {
                  console.log(`${entry.id} - ${entry.value}`)
                  avatarTotal += entry.value;
                  breakdown.avatars[nameOrValue] = (breakdown.avatars[nameOrValue] || 0) + entry.value;
              } else if (entry.id.startsWith('group-')) {
                  console.log(`${entry.id} - ${entry.value}`)
                  groupTotal += entry.value;
                  breakdown.groups[nameOrValue] = (breakdown.groups[nameOrValue] || 0) + entry.value;
              } else if (entry.id.startsWith('world-')) {
                  console.log(`${entry.id} - ${entry.value}`)
                  worldTotal += entry.value;
                  breakdown.worlds[nameOrValue] = (breakdown.worlds[nameOrValue] || 0) + entry.value;
              }
          }

          // Convert breakdown into readable lines
          const userLines = Object.entries(breakdown.users)
              .map(([reason, count]) => `  - ${reason}: \`${count}\``)
              .join('\n');

          const avatarLines = Object.entries(breakdown.avatars)
              .map(([reason, count]) => `  - ${reason}: \`${count}\``)
              .join('\n');

          const groupLines = Object.entries(breakdown.groups)
              .map(([reason, count]) => `  - ${reason}: \`${count}\``)
              .join('\n');

          const worldLines = Object.entries(breakdown.worlds)
              .map(([reason, count]) => `  - ${reason}: \`${count}\``)
              .join('\n');

          // Build message
          const sharedMessage = `## Use the \`/report-user\`... commands to create form posts.\n\n` +

          `### Tracked:\n` +
          `- 🔢Total: \`${allUsers.length + allAvatars.length + allGroups.length + allWorlds.length}\`\n` +
          `- 👤Users: \`${allUsers.length}\` 🎫\`${ticketsOpenUser}\`\n` +
          `- 🖼️Avatars: \`${allAvatars.length}\` 🎫\`${ticketsOpenAvatar}\`\n` +
          `- 👥Groups: \`${allGroups.length}\` 🎫\`${ticketsOpenGroup}\`\n` +
          `- 🌍Worlds: \`${allWorlds.length}\` 🎫\`${ticketsOpenWorld}\`\n` +

          `### Removed:\n` +
          `- 👤Users: \`${userTotal}\`\n` +
          `${userLines}\n` +
          `- 🖼️Avatars: \`${avatarTotal}\`\n` +
          `${avatarLines}\n` +
          `- 👥Groups: \`${groupTotal}\`\n` +
          `${groupLines}\n` +
          `- 🌍Worlds: \`${worldTotal}\`\n` +
          `${worldLines}`;


          // // Channel topic
          // const sharedMessage = `# Use the \`/report-user\` and \`/report-avatar\` command to create form posts.\n\n### Tracked:\n- 🔢Total: \`${allUsers.length + allAvatars.length}\`\n- 👤Users: \`${allUsers.length}\` 🎫\`${ticketsOpenUser}\`\n- 🖼️Avatars: \`${allAvatars.length}\` 🎫\`${ticketsOpenAvatar}\`\n### Removed:\n- 👤Users: \`${userTotal}\`\n- 🖼️Avatars: \`${avatarTotal}\``

          await channelUser.setTopic(sharedMessage)
          await channelAvatar.setTopic(sharedMessage)
          await channelGroup.setTopic(sharedMessage)
          await channelWorld.setTopic(sharedMessage)
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
      // await checkTermination() // Run it once
    })();
    await main(); // Start loop
})()