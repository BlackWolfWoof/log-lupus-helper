import './loadEnv.js'
import { logDebug, logInfo, logWarn, logError } from './logger.js'
import { avatarDb, userDb, countDb, groupDb, worldDb } from './quickdb.js'
import { fromSafeJSON } from './functions.js'
import { client } from '../discord/bot.js'
import { EmbedBuilder } from 'discord.js'
import { getAvatar, getUser, getGroup, getWorld, getFile } from './cache.js'

async function checkTerminationAvatars() {
  const allAvatars = await avatarDb.all()
  for (const entry of allAvatars) {
    try {
      // const refreshedAvatar = await getAvatar(entry.id)
      const refreshedAvatar = await getAvatar({
        path: { avatarId: entry.id }
      }, 6, false)

      // If avi gone
      if (refreshedAvatar.error && refreshedAvatar.error.response.status === 404) {
        // Avatar gone
        // logInfo`[terminationChecker]: Avi gone ${entry.id} - ${entry.value.vrc.name}`
        // If author has robot avi
        // const targetUser = await getUser(entry.value.vrc.authorId, false)
        const targetUser = await getUser({
          path: { userId: entry.value.vrc.authorId }
        }, 6, false)
        let thread;
        try {
          thread = client.channels.cache.get(entry.value.discordChannelId);
          if (!thread) thread = await client.channels.fetch(entry.value.discordChannelId);
        } catch (error) {
          logWarn(`[terminationChecker]: Channel no longer exists but is still in db. Removing avatarDb entry.`)
          await avatarDb.delete(entry.id)
          continue
        }

        // Ping user that submitted
        const submitter = entry.value.submitter ? `<@${entry.value.submitter}>` : null

        if (targetUser.error && targetUser.error.response.status === 404) {
          // Unexpected error, remove from db and kill thread. Add function for this to terminate the watching
          logDebug(`[terminationChecker]: ${entry.id} - ${entry.value.vrc.name} has been deleted and user went missing`)

          if (thread.isArchived) await thread.setArchived(false)

          const embed = new EmbedBuilder()
            .setTitle('💀User deleted & Avatar terminated')
            .setDescription(`The user does not exist anymore, and the avatar has been deleted / set to private.\nTherefor the thread is no longer tracked and is archivd.`)
            .setColor(0x000000);
          await thread.send({
            content: submitter,
            embeds: [embed]
          })
          await thread.edit({
            appliedTags: [process.env["DISCORD_AVATAR_TERM_TAG_ID"]]
          })
          await thread.setArchived(true, `Archived automatically (user NA)`);
          await countDb.add(entry.value.type, 1)
          await avatarDb.delete(entry.id)
          // Delete from db and close thread

          continue // Continue with other avis
        }
        if (targetUser.data.currentAvatarImageUrl === 'https://api.vrchat.cloud/api/1/file/file_0e8c4e32-7444-44ea-ade4-313c010d4bae/1/file') {
          // User is maybe terminated.
          // For now, report this instantly, no grace period
          logDebug(`[terminationChecker]: ${entry.id} - ${entry.value.vrc.name} has been deleted and user is termed`)
          // Delete from db and close thread

          if (thread.isArchived) await thread.setArchived(false)

          const embed = new EmbedBuilder()
            .setTitle('🛡️User & Avatar terminated')
            .setDescription(`The user was most likely terminated and the avatar has been deleted / set to private.\nTherefor the thread is no longer tracked and is archivd.`)
            .setColor(0xFF0000);
          await thread.send({
            content: submitter,
            embeds: [embed]
          })
          await thread.edit({
            appliedTags: [process.env["DISCORD_AVATAR_TERM_TAG_ID"]]
          })
          await thread.setArchived(true, `Archived automatically (user term)`);
          await countDb.add(entry.value.type, 1)
          await avatarDb.delete(entry.id)

          continue
        } else {
          // User is not termed but avatar is gone. Most likely just deleted
          logDebug(`[terminationChecker]: ${entry.id} - ${entry.value.vrc.name} has been deleted`)
          // Delete from db and close thread

          if (thread.isArchived) await thread.setArchived(false)

          const embed = new EmbedBuilder()
            .setTitle('❔User not deleted & Avatar terminated')
            .setDescription(`❔The user was not terminated, but the avatar has been deleted / set to private.\nTherefor the thread is no longer tracked and is archivd.`)
            .setColor(0xFF6C00);
          await thread.send({
            content: submitter,
            embeds: [embed]
          })
          await thread.edit({
            appliedTags: [process.env["DISCORD_AVATAR_TERM_TAG_ID"]]
          })
          await thread.setArchived(true, `Archived automatically (avi term)`);
          await avatarDb.delete(entry.id)

        }
      }
    } catch (error) {
      logError(`[terminationChecker]: avatarDb: ${error}`)
      console.error(error)
      continue
    }
  }
}

async function checkTerminationUsers() {
  // Loop over users
  const allUsers = await userDb.all()
  for (const entry of allUsers) {
    if (entry.value.force) continue // Skip "force" and do not use termination checks on them
    try {
      // const refreshedUser = await getUser(entry.id, false)
      const refreshedUser = await getUser({
        path: { userId: entry.id }
      }, 5, false)
      // If author has robot avi
      let thread;
      try {
        thread = client.channels.cache.get(entry.value.discordChannelId);
        if (!thread) thread = await client.channels.fetch(entry.value.discordChannelId);
      } catch (error) {
        logWarn(`[terminationChecker]: Channel no longer exists but is still in db. Removing userDb entry.`)
        await userDb.delete(entry.id)
        continue
      }

      const submitter = entry.value.submitter ? `<@${entry.value.submitter}>` : null

      if (refreshedUser.error && refreshedUser.error.response.status === 404) {
        // Unexpected error, remove from db and kill thread. Add function for this to terminate the watching
        logDebug(`[terminationChecker]: ${entry.id} - ${entry.value.vrc.displayName} user went missing`)

        if (thread.isArchived) await thread.setArchived(false)
        const embed = new EmbedBuilder()
          .setTitle('💀User deleted')
          .setDescription(`The user does not exist anymore.\nTherefor the thread is no longer tracked and is archivd.`)
          .setColor(0x000000);
        await thread.send({
          content: submitter,
          embeds: [embed]
        })
        await thread.edit({
          appliedTags: [process.env["DISCORD_USER_TERM_TAG_ID"]]
        })
        await thread.setArchived(true, `Archived automatically (user NA)`);
        await countDb.add(entry.value.type, 1)
        await userDb.delete(entry.id)
        // Delete from db and close thread

        continue // Continue with other users
      }
      if (refreshedUser.data.currentAvatarImageUrl === 'https://api.vrchat.cloud/api/1/file/file_0e8c4e32-7444-44ea-ade4-313c010d4bae/1/file') {
        // User is maybe terminated.
        // For now, report this instantly, no grace period
        logDebug(`[terminationChecker]: ${entry.id} - ${entry.value.vrc.displayName} user is termed/banned`)
        // Delete from db and close thread

        const embed = new EmbedBuilder()
          .setTitle('🛡️User Terminated')
          .setDescription(`The user was most likely terminated.\nTherefor the thread is no longer tracked and is archivd.`)
          .setColor(0xFF0000);
        await thread.send({
          content: submitter,
          embeds: [embed]
        })
        await thread.edit({
          appliedTags: [process.env["DISCORD_USER_TERM_TAG_ID"]]
        })
        await thread.setArchived(true, `Archived automatically (user term)`);
        await countDb.add(entry.value.type, 1)
        await userDb.delete(entry.id)

        continue
      }
    } catch (error) {
      logError(`[terminationChecker]: userDb: ${error}`)
      console.error(error)
      continue
    }
  }
}

async function checkTerminationGroups() {
  const allGroups = await groupDb.all()
  for (const entry of allGroups) {
    try {
      const groupId = entry.value.vrc.id
      const submitter = entry.value.submitter ? `<@${entry.value.submitter}>` : null

      const group = await getGroup({
        path: {
          groupId: groupId
        }
      }, 5, false)

      const user = await getUser({
        path: {
          userId: entry.value.vrc.ownerId
        }
      }, 5, false)

      let thread;
      try {
        thread = client.channels.cache.get(entry.value.discordChannelId);
        if (!thread) thread = await client.channels.fetch(entry.value.discordChannelId);
      } catch (error) {
        logWarn(`[terminationChecker]: Channel no longer exists but is still in db. Removing groupDb entry.`)
        await groupDb.delete(entry.id)
        continue
      }

      // Group deleted / termed
      if (group.error && group.error.response.status === 404) {
        let embed;

        // Check if user is dead
        if (user.error && user.error.response.status === 404) {
          embed = new EmbedBuilder()
            .setTitle('💀Group & Owner deleted / terminated')
            .setDescription(`The group and the owner does not exist anymore.\nTherefor the thread is no longer tracked and is archivd.`)
            .setColor(0x000000);
        } else if (user.data.currentAvatarImageUrl === 'https://api.vrchat.cloud/api/1/file/file_0e8c4e32-7444-44ea-ade4-313c010d4bae/1/file') {
          embed = new EmbedBuilder()
            .setTitle('🛡️User Terminated & Group deleted')
            .setDescription(`The group was deleted and the user was most likely terminated.\nTherefor the thread is no longer tracked and is archivd.`)
            .setColor(0xFF0000);
        } else {
          embed = new EmbedBuilder()
            .setTitle('❔User not terminated & group deleted')
            .setDescription(`The group was deleted, but the user still exists.\nTherefor the thread is no longer tracked and is archivd.`)
            .setColor(0xFF0000);
        }

        await thread.send({
          content: submitter,
          embeds: [embed]
        })
        await thread.edit({
          appliedTags: [process.env["DISCORD_GROUP_TERM_TAG_ID"]]
        })
        await thread.setArchived(true, `Archived automatically (group term)`);
        await countDb.add(entry.value.type, 1)
        await groupDb.delete(entry.id)

        continue
      }

      if (group.data?.iconId) {
        // Group looks ok, icons disapeared. User got punished, group stays
        const file = await getFile({
          path: {
            fileId: group.data.iconId
          }
        }, 5, false)
        if (file.error && file.error.response.status === 404) {
          const embed2 = new EmbedBuilder()
            .setTitle('☹️Group and owner punished, but not deletd')
            .setDescription(`The group and the owner were punished, but the group still exists.\nTherefor the thread is no longer tracked and is archived.`)
            .setColor(0xFF0000);

          await thread.send({
            content: submitter,
            embeds: [embed2]
          })
          await thread.edit({
            appliedTags: [process.env["DISCORD_GROUP_TERM_TAG_ID"]]
          })
          await thread.setArchived(true, `Archived automatically (group & owner punish)`);
          await countDb.add(entry.value.type, 1)
          await groupDb.delete(entry.id)
        }
      }
    } catch (error) {
      logError(`[terminationChecker]: groupDb: ${error}`)
      console.error(error)
      continue
    }
  }
}

async function checkTerminationWorlds() {
  const allWorlds = await worldDb.all()
  for (let entry of allWorlds) {
    try {
      entry.value.vrc = fromSafeJSON(entry.value.vrc)
      const worldId = entry.value.vrc.id
      const submitter = entry.value.submitter ? `<@${entry.value.submitter}>` : null

      const world = await getWorld({
        path: {
          worldId: worldId
        }
      }, 5, false)

      const user = await getUser({
        path: {
          userId: entry.value.vrc.authorId
        }
      }, 5, false)

      let thread;
      try {
        thread = client.channels.cache.get(entry.value.discordChannelId);
        if (!thread) thread = await client.channels.fetch(entry.value.discordChannelId);
      } catch (error) {
        logWarn(`[terminationChecker]: Channel no longer exists but is still in db. Removing worldDb entry.`)
        await worldDb.delete(entry.id)
        continue
      }

      // World deleted / termed
      if (world.error && world.error.response.status === 404) {
        let embed;

        // Check if user is dead
        if (user.error && user.error.response.status === 404) {
          embed = new EmbedBuilder()
            .setTitle('💀World & Owner deleted / terminated')
            .setDescription(`The world and the owner does not exist anymore.\nTherefor the thread is no longer tracked and is archivd.`)
            .setColor(0x000000);
        } else if (user.data.currentAvatarImageUrl === 'https://api.vrchat.cloud/api/1/file/file_0e8c4e32-7444-44ea-ade4-313c010d4bae/1/file') {
          embed = new EmbedBuilder()
            .setTitle('🛡️User Terminated & World deleted')
            .setDescription(`The world was deleted and the user was most likely terminated.\nTherefor the thread is no longer tracked and is archivd.`)
            .setColor(0xFF0000);
        } else {
          embed = new EmbedBuilder()
            .setTitle('❔User not terminated & world deleted')
            .setDescription(`The world was deleted, but the user still exists.\nTherefor the thread is no longer tracked and is archivd.`)
            .setColor(0xFF0000);
        }

        await thread.send({
          content: submitter,
          embeds: [embed]
        })
        await thread.edit({
          appliedTags: [process.env["DISCORD_WORLD_TERM_TAG_ID"]]
        })
        await thread.setArchived(true, `Archived automatically (world term)`);
        await countDb.add(entry.value.type, 1)
        await worldDb.delete(entry.id)

        continue
      }
    } catch (error) {
      logError(`[terminationChecker]: groupDb: ${error}`)
      console.error(error)
      continue
    }
  }
}

export async function checkTermination() {

  await checkTerminationAvatars()
  await checkTerminationUsers()
  await checkTerminationGroups()
  await checkTerminationWorlds()

}