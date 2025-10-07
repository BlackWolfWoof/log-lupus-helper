import '../../utils/loadEnv.js'
import { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, EmbedBuilder, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { sendBugMessage, sanitizeText, escapeMarkdown, toTitleCase, getUserTrustLevel, languageMappings, shortenText } from '../../utils/functions.js';
import { client } from '../bot.js'
import { userDb, avatarDb } from '../../utils/quickdb.js'
import { vrchat } from '../../vrchat/authentication.ts';
import { getCurrentUser, getAvatar, getUserGroups, getUser } from '../../utils/cache.js'

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
        { name: 'Crasher', value: 'avatar-crasher' },
        { name: 'Pedophilia', value: 'avatar-pedo' },
        { name: 'NSFW', value: 'avatar-nsfw' },
        { name: 'Promoting Selfharm', value: 'avatar-selfharm' },
        { name: 'Racist', value: 'avatar-racist' },
        { name: 'Other reason', value: 'avatar-other' },
      )
  );

const categories = {
  'avatar-crasher': '💥',
  'avatar-pedo': '😻',
  'avatar-nsfw': '🔞',
  'avatar-selfharm': '🩸',
  'avatar-racist': '🤬',
  'avatar-other': '❔'
}

async function execute(interaction) {
  let avatarId = interaction.options.getString('avatar-id');
  const type = interaction.options.getString('type');

  // Check if valid Avatar ID
  const regex = /avtr_[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/
  const match = avatarId.match(regex)
  if (!match) {
    await interaction.reply({
      content: `❌ The avatar id you provided is invalid. Here an example of an avatar id: \`avtr_a310c385-72f9-4a4b-8ba0-75b05b1317b3\`.`,
      flags: MessageFlags.Ephemeral
    })
    return
  } else {
    avatarId = match[0]
  }

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
  // const getServiceAccount = await getCurrentUser()
  const getServiceAccount = await getCurrentUser({}, 7)
  // const avatar = await getAvatar(avatarId)
  const avatar = await getAvatar({
    path: { avatarId: avatarId }
  }, 7, false)

  if (avatar.error) {
    switch (avatar.error.response.status) {
      case 404:
        await interaction.editReply({
          content: `❌ The avatar does not exist or has already been deleted.`,
          flags: MessageFlags.Ephemeral
        })
        return
      default:
        await sendBugMessage(interaction, true, false)
        return
    }
  }

  // Security settings so you cannot get info about your own avatar. This would give people the ability to query avatars from the logged in user otherwise
  if (getServiceAccount.data.id === avatar.data.authorId) {
    await interaction.editReply({
      content: `⚠️ For security reasons, the avatar of this user cannot be gotten.`,
      flags: MessageFlags.Ephemeral
    })
    return
  }

  if (type === "nsfw" && Array.isArray(avatar.data.tags) && avatar.data.tags.includes("content_sex")) {
    await interaction.editReply({
      content: `❌ The avatar is marked as NSFW and can therefor not be reported for being NSFW.`,
      flags: MessageFlags.Ephemeral
    })
    return
  }

  // const userInfo = await getUser(avatar.data.authorId);
  const userInfo = await getUser({
    path: { userId: avatar.data.authorId }
  }, 7, false)
  // const userGroups = await getUserGroups(avatar.data.authorId);
  const userGroups = await getUserGroups({
    path: { userId: avatar.data.authorId }
  }, 7, false)

  const bio = escapeMarkdown(sanitizeText(userInfo.data?.bio)) || "";
  const profilePic = userInfo.data?.profilePicOverrideThumbnail || userInfo.data?.currentAvatarThumbnailImageUrl || null;
  const status = escapeMarkdown(sanitizeText(userInfo.data?.statusDescription)) || ""

  // Combine age verification and age status
  let ageIcon = "✖️"; // Default: Not Verified
  if (userInfo.data?.ageVerified) ageIcon = "✔️"; 
  if (userInfo.data?.ageVerificationStatus === "18+") ageIcon = "🔞";

  // Format date_joined
  let joinedTimestamp = "Unknown";
  if (userInfo.data?.date_joined) {
    const joinedDate = new Date(userInfo.data.date_joined);
    const discordTimestamp = `<t:${Math.floor(joinedDate.getTime() / 1000)}:F> (<t:${Math.floor(joinedDate.getTime() / 1000)}:R>)`;
    joinedTimestamp = discordTimestamp;
  }

  // Split group names into multiple fields if needed
  const groupNames = userGroups.data?.map(group => group.name).filter(Boolean) || [];
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
        groupFields.push({ name: `👥 Groups Joined (${userGroups.data.length})`, value: currentField, inline: false });
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
    groupFields.push({ name: `👥 Groups Joined (${userGroups.data.length})`, value: currentField, inline: false });
  }

  const languagesString = (userInfo.data.tags && userInfo.data.tags.length > 0)
    ? userInfo.data.tags
      .filter(tag => tag.startsWith("language_"))             // only language tags
      .map(tag => {
        const code = tag.split("_")[1];                       // get 'deu', 'eng', etc.
        return `:flag_${languageMappings[code] || code}:`;    // map to emoji
      })
      .join(" ")
    : "N/A";

  const embed = new EmbedBuilder()
    .setTitle(sanitizeText(escapeMarkdown(userInfo.data?.displayName)))
    .setDescription(`\`\`\`${userInfo.data.id}\`\`\``)
    .setURL(`https://vrchat.com/home/user/${userInfo.data.id}`)
    .setColor(getUserTrustLevel(userInfo.data).trustColor)
    .setImage(profilePic)
    .addFields(
      { name: "📰 Status", value: status, inline: false },
      { name: "➕ Pronouns", value: escapeMarkdown(userInfo.data.pronouns) || "", inline: false },
      { name: "🏳️ Languages", value: languagesString, inline: false },
      { name: "📜 Bio", value: bio.length > 1024 ? bio.slice(0, 1021) + "..." : bio, inline: false },
      { name: "🧑‍🦲 Age Verification", value: ageIcon, inline: false },
      { name: "📅 Joined VRChat", value: joinedTimestamp, inline: false },
      ...groupFields
    )
    .setFooter({
      text: `Reported by "${interaction.user.username}"`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true, size: 512 })
    });

  // Avatar
  const avatarCreatedAt = Math.floor(new Date(avatar.data.created_at).getTime() / 1000);
  const avatarUpdatedAt = Math.floor(new Date(avatar.data.updated_at).getTime() / 1000);
  const embedAvi = new EmbedBuilder()
    .setTitle(sanitizeText(escapeMarkdown(shortenText(avatar.data.name) || "N/A")))
    .setURL(`https://vrchat.com/home/avatar/${avatar.data.id}`)
    .setImage(avatar.data.thumbnailImageUrl || null)
    .setDescription(`\`\`\`${avatar.data.id}\`\`\``)
    .addFields(
      { name: "Description", value: escapeMarkdown(avatar.data.description).slice(0, 1024), inline: false },
      { name: "Styles", value: `Primary: ${avatar.data.styles.primary || ""}, Secondary: ${avatar.data.styles.secondary || ""}`, inline: false },
      { name: "Date", value: `Created at: <t:${avatarCreatedAt}> (<t:${avatarUpdatedAt}:R>)\nUpdated at: <t:${avatarUpdatedAt}:R> (<t:${avatarUpdatedAt}>)`, inline: false },
      { name: "Tags", value: (avatar.data.tags.length ? avatar.data.tags.map(t => toTitleCase(t.split("_").pop())).join(", ") : ""), inline: false },
      { name: "Acknowledgements", value: avatar.data.acknowledgements ? sanitizeText(escapeMarkdown(avatar.data.acknowledgements)).slice(0, 1024) : "", inline: false },
    );

  let channel = client.channels.cache.get(process.env["CHANNEL_ID_AVATAR"]);
  if (!channel) channel = await client.channels.fetch(process.env["CHANNEL_ID_AVATAR"]);


  if (channel) {
    // Create form thread
    const thread = await channel.threads.create({
      name: `${categories[type]}${shortenText(avatar.data.name) || "N/A"} (by ${sanitizeText(shortenText(userInfo.data?.displayName))})`,
      message: {
        embeds: [embedAvi, embed]
      },
      appliedTags: [process.env["DISCORD_AVATAR_NOTICKET_TAG_ID"]]
    });


    // Prepare buttons including button with post id
    const buttonUrl = `https://blackwolfwoof.com/vrchat-report?channelId=${encodeURIComponent(thread.id)}`

    // Button for reporting
    const buttonReport = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(buttonUrl)
      .setLabel(`Create Ticket`);

    const buttonCloseThread = new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`button-close-post`)
      .setEmoji(`🗑️`);

    const row = new ActionRowBuilder().addComponents(buttonCloseThread)

    const buttonTerminated = new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setCustomId('button-force-terminated')
      .setEmoji('🪦');

    row.addComponents(buttonTerminated)
    row.addComponents(buttonReport)

    const starterMessage = await thread.fetchStarterMessage({ force: true })

    // Now you can edit it
    const edit = await starterMessage.edit({
      embeds: [embedAvi, embed],
      components: [row]
    });


    // Save to db
    await avatarDb.set(avatar.data.id, {
      discordChannelId: thread.id,
      type: type,
      authorDisplayName: userInfo.data.displayName,
      submitter: interaction.user.id,
      vrc: avatar.data,
      tickets: []
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
