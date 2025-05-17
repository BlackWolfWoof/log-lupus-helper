import { client } from '../../bot.js'
import { MessageFlags } from 'discord.js';
import { avatarDb } from '../../../utils/quickdb.js'
import { findAvatarByChannel } from '../../../utils/functions.js';

async function execute(interaction) {
  const thread = interaction.channel
  const avatar = await findAvatarByChannel(interaction.channel.id)

  // Archive the thread
  try {
    await avatarDb.delete(avatar.id)
    await interaction.reply({
      content: `✅ Thread has been archived and the avatar is no longer tracked.`,
      flags: MessageFlags.Ephemeral
    });
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
