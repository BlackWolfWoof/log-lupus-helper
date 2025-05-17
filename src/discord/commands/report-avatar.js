import { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, EmbedBuilder, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder } from "discord.js";
import { sendBugMessage, } from '../../utils/functions.js';
import { client } from '../bot.js'

const discord = new SlashCommandBuilder()
  .setName("report-avatar")
  .setDescription("Report a public avatar")
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addStringOption(option =>
    option
      .setName('avatar-id')
      .setDescription('ID of the avatar: avtr_a310c385-72f9-4a4b-8ba0-75b05b1317b3')
      .setRequired(true)
  );

async function execute(interaction) {
  const avatarId = interaction.options.getString('avatar-id');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }) // Preventing timeouts of the command

  let channel = client.channels.cache.get(process.env["CHANNEL_ID_AVATAR"]);
  if (!channel) channel = await client.channels.fetch(process.env["CHANNEL_ID_AVATAR"]);


  if (channel) {
    console.log(interaction)
    const thread = await channel.threads.create({
      name: `Test ${interaction.id}`,
      message: {
        content: `Hello world ${avatarId}`
      },
    });
    await interaction.editReply({
      content: `✅ Message posted in <#${thread.id}>`,
      flags: MessageFlags.Ephemeral
    })
  } else {
    await sendBugMessage(interaction, true, false)
  }

 
}

export default { discord, execute };
