import { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, EmbedBuilder, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { sendBugMessage, getAvatar, getUserGroups, sanitizeText, escapeMarkdown, getCurrentUser, getUser, toTitleCase } from '../../utils/functions.js';
import { client } from '../bot.js'
import { sanetizeText } from "../../../../lobby-info/src/utils/functions.js";
import { userDb, avatarDb } from '../../utils/quickdb.js'

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
  )
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Choose a category')
      .setRequired(true)
      .addChoices(
        { name: 'Crasher', value: 'crasher' },
        { name: 'NSFW', value: 'nsfw' },
      )
  );

async function execute(interaction) {
  const avatarId = interaction.options.getString('avatar-id');
  const type = interaction.options.getString('type');

  // Check if already in db
  const alreadyExists = await avatarDb.get(avatarId)
  if (alreadyExists) {
    await interaction.reply({
      content: `❌ The avatar is already tracked in <#${alreadyExists.discordChannelId}>`,
      flags: MessageFlags.Ephemeral
    })
    return
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }) // Preventing timeouts of the command

  // VRChat avatar info
  const getServiceAccount = await getCurrentUser()
  const avatar = await getAvatar(avatarId)

  // Security settings so you cannot get info about your own avatar. This would give people the ability to query avatars from the logged in user otherwise
  if (getServiceAccount.id === avatar.authorId) {
    await interaction.editReply({
      content: `⚠️ For security reasons, the avatar of this user cannot be gotten.`,
      flags: MessageFlags.Ephemeral
    })
    return
  }

  if (type === "nsfw" && Array.isArray(avatar.tags) && avatar.tags.includes("content_sex")) {
    await interaction.editReply({
      content: `❌ The avatar is marked as NSFW and can therefor not be reported for being NSFW.`,
      flags: MessageFlags.Ephemeral
    })
    return
  }


  const userInfo = await getUser(avatar.authorId);
  const userGroups = await getUserGroups(avatar.authorId);

  const bio = escapeMarkdown(sanitizeText(userInfo?.bio)) || "No bio available.";
  const profilePic = userInfo?.profilePicOverrideThumbnail || userInfo?.currentAvatarThumbnailImageUrl || null;
  const status = escapeMarkdown(sanitizeText(userInfo?.statusDescription)) || "No status available."

  // Combine age verification and age status
  let ageIcon = "✖️"; // Default: Not Verified
  if (userInfo?.ageVerified) ageIcon = "✔️"; 
  if (userInfo?.ageVerificationStatus === "+18") ageIcon = "🔞";

  // Format date_joined
  let joinedTimestamp = "Unknown";
  if (userInfo?.date_joined) {
    const joinedDate = new Date(userInfo.date_joined);
    const discordTimestamp = `<t:${Math.floor(joinedDate.getTime() / 1000)}:F> (<t:${Math.floor(joinedDate.getTime() / 1000)}:R>)`;
    joinedTimestamp = discordTimestamp;
  }

  // Split group names into multiple fields if needed
  const groupNames = userGroups?.map(group => group.name).filter(Boolean) || [];
  const groupFields = [];
  const maxFieldLength = 1024;
  const maxTotalLength = 4000; // its 6k but yea... i left some just in case
  const maxFields = 21; // count the ones we need for the rest of the stuff. 25 is max
  const overflowMessage = "\n...and more groups not shown.";

  let totalLength = 0;
  let currentField = "";
  let fieldCount = 0;
  let addedOverflowMessage = false;

  for (let groupName of groupNames) {
    groupName = escapeMarkdown(sanitizeText(groupName));

    if (currentField.length + groupName.length + 2 > maxFieldLength) {
      // Check if we can add another field
      if (fieldCount < maxFields - 1 && totalLength + currentField.length <= maxTotalLength) {
        groupFields.push({ name: `👥 Groups Joined (${userGroups.length})`, value: currentField, inline: false });
        totalLength += currentField.length;
        fieldCount++;
        currentField = groupName;
      } else {
        // No more fields allowed, append overflow message to last field if not already added
        if (!addedOverflowMessage) {
          const remainingSpace = maxFieldLength - currentField.length;
          if (remainingSpace >= overflowMessage.length) {
            currentField += overflowMessage;
          } else {
            currentField = currentField.slice(0, remainingSpace - 3) + "...";
          }
          addedOverflowMessage = true;
        }
        break;
      }
    } else {
      currentField += (currentField ? "\n" : "") + groupName;
    }
  }

  // Add the last field if it contains data
  if (currentField && totalLength + currentField.length <= maxTotalLength) {
    groupFields.push({ name: `👥 Groups Joined (${userGroups.length})`, value: currentField, inline: false });
  }

  const embed = new EmbedBuilder()
    .setTitle(sanitizeText(userInfo?.displayName))
    .setDescription(`\`\`\`${userInfo.id}\`\`\``)
    .setURL(`https://vrchat.com/home/user/${userInfo.id}`)
    .setImage(profilePic)
    .addFields(
      { name: "📰 Status", value: status, inline: false },
      { name: "📜 Bio", value: bio.length > 1024 ? bio.slice(0, 1021) + "..." : bio, inline: false },
      { name: "🧑‍🦲 Age Verification", value: ageIcon, inline: false },
      { name: "📅 Joined VRChat", value: joinedTimestamp, inline: false },
      ...groupFields
    )
    .setAuthor({
      name: interaction.user.username,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true, size: 512 })
    });


  // Avatar
  const avatarCreatedAt = Math.floor(new Date(avatar.created_at).getTime() / 1000);
  const avatarUpdatedAt = Math.floor(new Date(avatar.updated_at).getTime() / 1000);
  const embedAvi = new EmbedBuilder()
    .setTitle(avatar.name)
    .setURL(`https://vrchat.com/home/avatar/${avatar.id}?aviId=${avatar.id}`)
    .setImage(avatar.thumbnailImageUrl)
    .setDescription(`\`\`\`${avatar.id}\`\`\``)
    .addFields(
      { name: "Description", value: escapeMarkdown(avatar.description).slice(0, 1024), inline: false },
      { name: "Styles", value: `Primary: ${avatar.styles.primary || "*None*"}, Secondary: ${avatar.styles.secondary || "*None*"}`, inline: false },
      { name: "Date", value: `Created at: <t:${avatarCreatedAt}>\nUpdated at: <t:${avatarUpdatedAt}>`, inline: false },
      { name: "Tags", value: (avatar.tags.length ? avatar.tags.map(t => toTitleCase(t.split("_").pop())).join(", ") : "*None*"), inline: false },
      { name: "Acknowledgements", value: avatar.acknowledgements ? sanitizeText(escapeMarkdown(avatar.acknowledgements)).slice(0, 1024) : "*None*", inline: false },
    )

  let channel = client.channels.cache.get(process.env["CHANNEL_ID_AVATAR"]);
  if (!channel) channel = await client.channels.fetch(process.env["CHANNEL_ID_AVATAR"]);


  if (channel) {
    // Create form thread
    const thread = await channel.threads.create({
      name: avatar.name,
      message: {
        embeds: [embed, embedAvi]
      }
    });


    // Prepare buttons including button with post id
    const buttonUrlNSFW = `https://blackwolfwoof.com/vrchat-report?type=${encodeURIComponent(type)}&userId=${encodeURIComponent(userInfo.id)}&userDisplayName=${userInfo.displayName}&avatarId=${encodeURIComponent(avatar.id)}&avatarName=${encodeURIComponent(avatar.name)}&channelId=${encodeURIComponent(thread.id)}`

    // Button for reporting
    const buttonReport = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(buttonUrlNSFW)
      .setLabel(`Create Ticket`);

    const buttonCloseThread = new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`button-close-post`)
      .setEmoji(`🗑️`);

    const row = new ActionRowBuilder().addComponents(buttonCloseThread)
    row.addComponents(buttonReport)

    const starterMessage = await thread.fetchStarterMessage({ force: true })

    // Now you can edit it
    const edit = await starterMessage.edit({
      embeds: [embed, embedAvi],
      components: [row]
    });


    // Save to db
    await avatarDb.set(avatar.id, {
      discordChannelId: thread.id,
      vrc: avatar
    })
    await thread.message
    // Reply to user with OK
    await interaction.editReply({
      content: `✅ Message posted in <#${thread.id}>`,
      flags: MessageFlags.Ephemeral
    })
  } else {
    await sendBugMessage(interaction, true, false)
  }

}

export default { discord, execute };
