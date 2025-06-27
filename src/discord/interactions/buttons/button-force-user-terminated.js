import { MessageFlags } from 'discord.js';
import { avatarDb, userDb } from '../../../utils/quickdb.js'
import { findChannelId } from '../../../utils/functions.js';
import { logDebug, logInfo, logWarn, logError } from '../../../utils/logger.js'

async function execute(interaction) {
  const thread = interaction.channel

  // Archive the thread
  try {
     const entry = await findChannelId(interaction.channel.id)
    if (entry?.id && entry.id.includes('usr_')) {
      await thread.edit({
        appliedTags: [process.env["DISCORD_USER_TERM_TAG_ID"]]
      })
      await userDb.delete(entry.id)
    } else if (entry?.id && entry.id.includes('avtr_')) {
      // This should not be needed here, as we can check if the user was termed via the avatar 404
      // await thread.edit({
      //   appliedTags: [process.env["DISCORD_AVATAR_TERM_TAG_ID"]]
      // })
      await avatarDb.delete(entry.id)
    } else {
      logWarn(`[button-close-post]: Entry was not found. Skipping deletion and closing thread.`)
    }
    await interaction.reply({
      content: `✅ Thread has been archived will no longer be tracked.`,
      flags: MessageFlags.Ephemeral
    });
    await thread.edit({
      appliedTags: [process.env["DISCORD_USER_TERM_TAG_ID"]]
    })
    await countDb.add(entry.value.type, 1)
    await thread.setArchived(true, `Archived via button by ${interaction.user.id}`);
    return
  } catch (error) {
    console.error('Failed to archive thread:', error);
    await interaction.reply({
      content: '❌ Failed to archive the thread. Make sure I have the right permissions.',
      flags: MessageFlags.Ephemeral
    });
    return
  }
}


export default { execute }
