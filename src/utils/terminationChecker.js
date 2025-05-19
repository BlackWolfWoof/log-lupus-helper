import { logDebug, logInfo, logWarn, logError } from './logger.js'
import { avatarDb, userDb } from './quickdb.js'
import { findChannelId, getAvatar, getUser } from './functions.js'
import { client } from '../discord/bot.js'

export async function checkTermination() {
  // Get all avatars
  const allAvatars = await avatarDb.all()
  const allUsers = await userDb.all()

  // Loop over avatars
  for (const entry of allAvatars) {
    try {
      const refreshedAvatar = await getAvatar(entry.id)
      // If avi gone
      if (refreshedAvatar.error && refreshedAvatar.error.status_code === 404) {
        // Avatar gone
        logInfo`[terminationChecker]: Avi gone ${entry.value.vrc.id} - ${entry.value.vrc.name}`
        // If author has robot avi
        const targetUser = await getUser(entry.value.vrc.authorId, false)
        let thread;
        try {
          thread = client.channels.cache.get(entry.value.discordChannelId);
          if (!thread) thread = await client.channels.fetch(entry.value.discordChannelId);
        } catch (error) {
          logWarn(`[terminationChecker]: Channel no longer exists but is still in db. Removing avatarDb entry.`)
          await avatarDb.delete(entry.id)
        }

        if (targetUser.error && targetUser.error.status_code === 404) {
          // Unexpected error, remove from db and kill thread. Add function for this to terminate the watching
          logDebug(`[terminationChecker]: ${entry.id} - ${entry.value.vrc.name} has been deleted and user went missing`)

          if (thread.isArchived) await thread.setArchived(false)
          await thread.send(`💀 The user does not exist anymore, and the avatar has been deleted / set to private.\nTherefor the thread is no longer tracked and is archivd.`)
          await thread.setArchived(true, `Archived automatically (user NA)`);
          await avatarDb.delete(entry.id)
          // Delete from db and close thread

          continue // Continue with other avis
        }
        if (targetUser.currentAvatarImageUrl === 'https://api.vrchat.cloud/api/1/file/file_0e8c4e32-7444-44ea-ade4-313c010d4bae/1/file') {
          // User is maybe terminated.
          // For now, report this instantly, no grace period
          logDebug(`[terminationChecker]: ${entry.id} - ${entry.value.vrc.name} has been deleted and user is termed`)
          // Delete from db and close thread

          if (thread.isArchived) await thread.setArchived(false)
          await thread.send(`🛡️ The user was most likely terminated, and the avatar has been deleted / set to private.\nTherefor the thread is no longer tracked and is archivd.`)
          await thread.setArchived(true, `Archived automatically (user term)`);
          await avatarDb.delete(entry.id)

          continue
        } else {
          // User is not termed but avatar is gone. Most likely just deleted
          logDebug(`[terminationChecker]: ${entry.id} - ${entry.value.vrc.name} has been deleted`)
          // Delete from db and close thread

          if (thread.isArchived) await thread.setArchived(false)
          await thread.send(`❔ The user was not terminated, but the avatar has been deleted / set to private.\nTherefor the thread is no longer tracked and is archivd.`)
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


  // Loop over users
  for (const entry of allUsers) {
    try {
      const refreshedUser = await getUser(entry.id, false)
      // If author has robot avi
      let thread;
      try {
        thread = client.channels.cache.get(entry.value.discordChannelId);
        if (!thread) thread = await client.channels.fetch(entry.value.discordChannelId);
      } catch (error) {
        logWarn(`[terminationChecker]: Channel no longer exists but is still in db. Removing userDb entry.`)
        await userDb.delete(entry.id)
      }
      

      if (refreshedUser.error && refreshedUser.error.status_code === 404) {
        // Unexpected error, remove from db and kill thread. Add function for this to terminate the watching
        logDebug(`[terminationChecker]: ${entry.id} - ${entry.value.vrc.name} user went missing`)

        if (thread.isArchived) await thread.setArchived(false)
        await thread.send(`💀 The user does not exist anymore.\nTherefor the thread is no longer tracked and is archivd.`)
        await thread.setArchived(true, `Archived automatically (user NA)`);
        await userDb.delete(entry.id)
        // Delete from db and close thread

        continue // Continue with other users
      }
      if (refreshedUser.currentAvatarImageUrl === 'https://api.vrchat.cloud/api/1/file/file_0e8c4e32-7444-44ea-ade4-313c010d4bae/1/file') {
        // User is maybe terminated.
        // For now, report this instantly, no grace period
        logDebug(`[terminationChecker]: ${entry.id} - ${entry.value.vrc.name} user is termed/banned`)
        // Delete from db and close thread

        
        await thread.send(`🛡️ The user was most likely terminated.\nTherefor the thread is no longer tracked and is archivd.`)
        await thread.setArchived(true, `Archived automatically (user term)`);
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