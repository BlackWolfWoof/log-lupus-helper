import '../../utils/loadEnv.js'
import { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, EmbedBuilder, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { sendBugMessage, sanitizeText, escapeMarkdown, toTitleCase, getUserTrustLevel, formatHumanNumber, toSafeJSON, shortenText } from '../../utils/functions.js';
import { client } from '../bot.js'
import { worldDb } from '../../utils/quickdb.js'
import { getCurrentUser, getUser, getUserGroups, getWorld } from '../../utils/cache.js'

const discord = new SlashCommandBuilder()
  .setName("report-world")
  .setDescription("Report a world")
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addStringOption(option =>
    option
      .setName('world-id')
      .setDescription('ID of the world: wrld_a310c385-72f9-4a4b-8ba0-75b05b1317b3')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Choose a category')
      .setRequired(true)
      .addChoices(
        { name: 'Racist', value: 'world-racism' },
        { name: 'Pedophile', value: 'world-pedo' },
        { name: 'Bad Media', value: 'world-media' },
        { name: 'Promoting Selfharm', value: 'world-selfharm' },
        { name: 'Bad Worldname', value: 'world-badworldname' },
        { name: 'Crasher', value: 'world-crasher' },
        { name: 'Other reason', value: 'world-other' }
      )
  )

const categories = {
  'world-racism': '🤬',
  'world-pedo': '😻',
  'world-media': '🖼️',
  'world-selfharm': '🩸',
  'world-badworldname': '📛',
  'world-crasher': '💥',
  'world-other': '❔'
}


async function execute(interaction) {
  let worldId = interaction.options.getString('world-id');
  const type = interaction.options.getString('type');

  // Check if valid world ID
  const regex = /wrld_[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/
  const match = worldId.match(regex)
  if (!match) {
    await interaction.reply({
      content: `❌ The world id you provided is invalid. Here an example of an user id: \`wrld_a310c385-72f9-4a4b-8ba0-75b05b1317b3\`.`,
      flags: MessageFlags.Ephemeral
    })
    return
  } else {
    worldId = match[0] // Filter out the world id, if someone suplies a link
  }

  // Check if already in db
  const alreadyExists = await worldDb.get(worldId)
  if (alreadyExists) {
    await interaction.reply({
      content: `❌ The world is already tracked in <#${alreadyExists.discordChannelId}>`,
      flags: MessageFlags.Ephemeral
    })
    return
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }) // Preventing timeouts of the command

  // VRChat user info
  // const getServiceAccount = await getCurrentUser()
  const getServiceAccount = await getCurrentUser({}, 7)

  const world = await getWorld({
    path: {
      worldId: worldId
    }
  }, 7, false)

  // Does the world exist
  if (world.error && world.error.response.status === 404) {
    await interaction.editReply({
      content: `❌ The world no longer exists or the id is invalid. Here an example: \`wrld_a310c385-72f9-4a4b-8ba0-75b05b1317b3\``,
      flags: MessageFlags.Ephemeral
    })
    return
  }

  // Get User and its groups and see if user is valid
  // const userInfo = await getUser(userId);
  const userInfo = await getUser({
    path: { userId: world.data.authorId }
  }, 7, false)
  if (userInfo.error && userInfo.error.response.status === 404) {
    await interaction.editReply({
      content: `🔥 Something is messed up. The world owner does not exist. I don't know what to do.`,
      flags: MessageFlags.Ephemeral
    })
    return
  }

  // Security settings so you cannot get info about user. This would give people the ability to query worlds from the logged in user otherwise
  if (getServiceAccount.data.id === world.data.authorId) {
    await interaction.editReply({
      content: `⚠️ For security reasons this user cannot be reported.`,
      flags: MessageFlags.Ephemeral
    })
    return
  }

  // const userGroups = await getUserGroups(userId);
  const userGroups = await getUserGroups({
    path: { userId: world.data.authorId }
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
  
  let embeds = []
  const embed1 = new EmbedBuilder()
    .setTitle(sanitizeText(escapeMarkdown(shortenText(userInfo.data?.displayName))))
    .setDescription(`\`\`\`${userInfo.data.id}\`\`\``)
    .setURL(`https://vrchat.com/home/user/${userInfo.data.id}`)
    .setColor(getUserTrustLevel(userInfo.data).trustColor)
    .setImage(profilePic)
    .addFields(
      { name: "📰 Status", value: status, inline: false },
      { name: "➕ Pronouns", value: escapeMarkdown(userInfo.data?.pronouns) || "", inline: false },
      { name: "📜 Bio", value: bio.length > 1024 ? bio.slice(0, 1021) + "..." : bio, inline: false },
      { name: "🧑‍🦲 Age Verification", value: ageIcon, inline: false },
      { name: "📅 Joined VRChat", value: joinedTimestamp, inline: false },
      ...groupFields
    )
    .setFooter({
      text: `Reported by "${interaction.user.username}"`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true, size: 512 })
    });

  // Prepare groupInfo and worldData
  const worldDate = Math.floor(new Date(world.data.created_at).getTime() / 1000)
  const authorTagsString = (world.data.tags && world.data.tags.length > 0)
    ? world.data.tags
        .filter(tag => tag.startsWith('author_tag_'))
        .map(tag => tag.replace('author_tag_', ''))
        .join(", ") || "N/A"
    : "N/A";
  const emojis = {
    "standalonewindows": "<:windows:1408727276157276290>",
    "android": "<:android:1408727301188878356>",
    "ios": "<:ios:1408727321556287528>"
  }
  const platformsArray = [...new Set(world.data.unityPackages.map(p => p.platform))];
  const platforms = platformsArray.map(p => emojis[p] || p).join(" ");

  const worldInfo = `Platforms: ${platforms}\n` +
  `Capacity: \`${world.data.capacity}\`\n` +
  `Occupants: \`${formatHumanNumber(world.data.occupants)}\`\n` +
  `Favourites: \`${formatHumanNumber(world.data.favorites)}\`\n` +
  `Heat: \`${world.data.heat}\`\n` +
  `Visits: \`${formatHumanNumber(world.data.visits)}\`\n` +
  `Version: \`${world.data.version}\`\n` +
  `Tags: ${authorTagsString}\n` +
  `Created At: <t:${worldDate}> (<t:${worldDate}:R>)\n` +
  `Video: ${world.data.previewYoutubeId ? `[Link](https://youtu.be/${world.data.previewYoutubeId})` : "N/A"}`

  // Prepare desciption
  let description = world?.data?.description  ? sanitizeText(escapeMarkdown(world.data.description)) : 'N/A';
  const suffix = '... (too long)';
  if (description.length > 1024) description = description.slice(0, 1024 - suffix.length) + suffix;

  const embed2 = new EmbedBuilder()
  .setTitle(sanitizeText(escapeMarkdown(shortenText(world.data?.name) ||"N/A")))
  .setDescription(`\`\`\`${world.data.id}\`\`\``)
  .setURL(`https://vrchat.com/home/world/${world.data.id}`)
  .addFields(
    { name: "ℹ️ Info", value: worldInfo, inline: false },
    { name: "📄 Description", value: description, inline: false }
  )
  .setImage(world.data.imageUrl || "");

  embeds.push(embed2)
  embeds.push(embed1)

  let channel = client.channels.cache.get(process.env["CHANNEL_ID_WORLD"]);
  if (!channel) channel = await client.channels.fetch(process.env["CHANNEL_ID_WORLD"]);


  if (channel) {
    // Create form thread
    const thread = await channel.threads.create({
      name: `${categories[type]}${sanitizeText(shortenText(world.data?.name) ||"N/A")}`,
      message: {
        embeds: embeds
      },
      appliedTags: [process.env["DISCORD_WORLD_NOTICKET_TAG_ID"]]
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

    // const buttonTerminated = new ButtonBuilder()
    //   .setStyle(ButtonStyle.Danger)
    //   .setCustomId('button-force-group-terminated')
    //   .setEmoji('🪦');

    // row.addComponents(buttonTerminated)
    row.addComponents(buttonReport)

    const starterMessage = await thread.fetchStarterMessage({ force: true })

    // Now you can edit it
    const edit = await starterMessage.edit({
      embeds: embeds,
      components: [row]
    });


    // Save to db
    await worldDb.set(worldId, {
      discordChannelId: thread.id,
      type: type,
      submitter: interaction.user.id,
      vrc: toSafeJSON(world.data),
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
