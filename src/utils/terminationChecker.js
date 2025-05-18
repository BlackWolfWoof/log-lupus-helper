import { logDebug, logInfo, logWarn, logError } from './logger.js'
import { avatarDb, userDb } from './quickdb.js'
import { getAvatar, getUser } from './functions.js'
import { client } from '../discord/bot.js'

export async function checkTermination() {
  // Get all avatars
  const allAvatars = await avatarDb.all()
  const allUsers = await userDb.all()

  // Loop over avatars
  for (const avatar of allAvatars) {
    try {
      const refreshedAvatar = await getAvatar(avatar.id)
      // If avi gone
      if (refreshedAvatar.error && refreshedAvatar.error.status_code === 404) {
        // Avatar gone
        logInfo`[terminationChecker]: Avi gone ${avatar.value.vrc.id} - ${avatar.value.vrc.name}`
        // If author has robot avi
        const targetUser = await getUser(avatar.value.vrc.authorId, false)
        let thread = client.channels.cache.get(avatar.value.discordChannelId);
        if (!thread) thread = await client.channels.fetch(avatar.value.discordChannelId);

        if (targetUser.error && targetUser.error.status_code === 404) {
          // Unexpected error, remove from db and kill thread. Add function for this to terminate the watching
          logDebug(`[terminationChecker]: ${avatar.id} - ${avatar.value.vrc.name} has been deleted and user went missing`)

          await thread.send(`💀 The user does not exist anymore, and the avatar has been deleted / set to private.\nTherefor the thread is no longer tracked and is archivd.`)
          await thread.setArchived(true, `Archived automatically (user NA)`);
          await avatarDb.delete(avatar.id)
          // Delete from db and close thread

          continue // Continue with other avis
        }
        if (targetUser.currentAvatarImageUrl === 'https://api.vrchat.cloud/api/1/file/file_0e8c4e32-7444-44ea-ade4-313c010d4bae/1/file') {
          // User is maybe terminated.
          // For now, report this instantly, no grace period
          logDebug(`[terminationChecker]: ${avatar.id} - ${avatar.value.vrc.name} has been deleted and user is termed`)
          // Delete from db and close thread

          await thread.send(`🛡️ The user was most likely terminated, and the avatar has been deleted / set to private.\nTherefor the thread is no longer tracked and is archivd.`)
          await thread.setArchived(true, `Archived automatically (user term)`);
          await avatarDb.delete(avatar.id)

          continue
        } else {
          // User is not termed but avatar is gone. Most likely just deleted
          logDebug(`[terminationChecker]: ${avatar.id} - ${avatar.value.vrc.name} has been deleted`)
          // Delete from db and close thread
          await thread.send(`❔ The user was not terminated, but the avatar has been deleted / set to private.\nTherefor the thread is no longer tracked and is archivd.`)
          await thread.setArchived(true, `Archived automatically (avi term)`);
          await avatarDb.delete(avatar.id)

        }
      } else {
        // AVatar avaliable
        logDebug(`[terminationChecker]: Avatar avaliable ${avatar.value.vrc.id} - ${avatar.value.vrc.name}`)
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
      let thread = client.channels.cache.get(entry.value.discordChannelId);
      if (!thread) thread = await client.channels.fetch(entry.value.discordChannelId);

      if (refreshedUser.error && refreshedUser.error.status_code === 404) {
        // Unexpected error, remove from db and kill thread. Add function for this to terminate the watching
        logDebug(`[terminationChecker]: ${entry.id} - ${entry.value.vrc.name} user went missing`)

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