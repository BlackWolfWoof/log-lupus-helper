import '../../utils/loadEnv.js'
import { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, EmbedBuilder, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { sendBugMessage, sanitizeText, escapeMarkdown, toTitleCase, getUserTrustLevel, languageMappings } from '../../utils/functions.js';
import { client } from '../bot.js'
import { groupDb } from '../../utils/quickdb.js'
import { getCurrentUser, getUser, getUserGroups, getGroup } from '../../utils/cache.js'

const discord = new SlashCommandBuilder()
  .setName("report-group")
  .setDescription("Report a group")
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addStringOption(option =>
    option
      .setName('group-id')
      .setDescription('ID of the group: grp_a310c385-72f9-4a4b-8ba0-75b05b1317b3')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Choose a category')
      .setRequired(true)
      .addChoices(
        { name: 'Racist', value: 'group-racism' },
        { name: 'Pedophile', value: 'group-pedo' },
        { name: 'Bad Banner/Icon', value: 'group-media' },
        { name: 'Promoting Selfharm', value: 'group-selfharm' },
        { name: 'Bad Groupname', value: 'group-badgroupname' },
        { name: 'Crasher', value: 'group-crasher' },
        { name: 'Other reason', value: 'group-other' }
      )
  )

async function execute(interaction) {
  let groupId = interaction.options.getString('group-id');
  const type = interaction.options.getString('type');

  // Check if valid Group ID
  const regex = /grp_[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/
  const match = groupId.match(regex)
  if (!match) {
    await interaction.reply({
      content: `❌ The group id you provided is invalid. Here an example of an user id: \`grp_a310c385-72f9-4a4b-8ba0-75b05b1317b3\`.`,
      flags: MessageFlags.Ephemeral
    })
    return
  } else {
    groupId = match[0] // Filter out the group id, if someone suplies a link
  }

  // Check if already in db
  const alreadyExists = await groupDb.get(groupId)
  if (alreadyExists) {
    await interaction.reply({
      content: `❌ The group is already tracked in <#${alreadyExists.discordChannelId}>`,
      flags: MessageFlags.Ephemeral
    })
    return
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }) // Preventing timeouts of the command

  // VRChat user info
  // const getServiceAccount = await getCurrentUser()
  const getServiceAccount = await getCurrentUser({}, 7)

  const group = await getGroup({
    path: {
      groupId: groupId
    }
  }, 7, false)

  // Does the group exist
  if (group.error && group.error.response.status === 404) {
    await interaction.editReply({
      content: `❌ The group no longer exists or the id is invalid. Here an example: \`grp_a310c385-72f9-4a4b-8ba0-75b05b1317b3\``,
      flags: MessageFlags.Ephemeral
    })
    return
  }

  // Get User and its groups and see if user is valid
  // const userInfo = await getUser(userId);
  const userInfo = await getUser({
    path: { userId: group.data.ownerId }
  }, 7, false)
  if (userInfo.error && userInfo.error.response.status === 404) {
    await interaction.editReply({
      content: `🔥 Something is messed up. The group owner does not exist. I don't know what to do.`,
      flags: MessageFlags.Ephemeral
    })
    return
  }

  // Security settings so you cannot get info about your own avatar. This would give people the ability to query avatars from the logged in user otherwise
  if (getServiceAccount.data.id === group.data.ownerId) {
    await interaction.editReply({
      content: `⚠️ For security reasons this user cannot be reported.`,
      flags: MessageFlags.Ephemeral
    })
    return
  }

  // const userGroups = await getUserGroups(userId);
  const userGroups = await getUserGroups({
    path: { userId: group.data.ownerId }
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
    .setTitle(sanitizeText(escapeMarkdown(userInfo.data?.displayName)))
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


  // Prepare groupInfo and groupData
  const groupDate = Math.floor(new Date(group.data.createdAt).getTime() / 1000)
  const languagesString = (group.data.languages && group.data.languages.length > 0)
    ? group.data.languages
        .map(lang => `:flag_${languageMappings[lang] || lang}:`) // fallback to code if mapping missing
        .join(" ")
    : "N/A";
  const groupInfo = `Members: ${group.data.memberCount}\n` + 
  `Join State: \`${toTitleCase(group.data.joinState)}\`\n` +
  `Languages: ${languagesString}\n` +
  `Created At: <t:${groupDate}> (<t:${groupDate}:R>)\n` +
  `Shortcode: [${group.data.shortCode}.${group.data.discriminator}](https://vrc.group/${group.data.shortCode}.${group.data.discriminator})`

  // Prepare rules
  let rules = group?.data?.rules ? sanitizeText(escapeMarkdown(group.data.rules)) : 'N/A';
  const suffix = '... (too long)';
  if (rules.length > 1024) rules = rules.slice(0, 1024 - suffix.length) + suffix;

  // Prepare desciption
  let description = group?.data?.description  ? sanitizeText(escapeMarkdown(group.data.description)) : 'N/A';
  if (description.length > 1024) description = description.slice(0, 1024 - suffix.length) + suffix;


  const embed2 = new EmbedBuilder()
  .setTitle(sanitizeText(escapeMarkdown(group.data?.name ||"N/A")))
  .setThumbnail(group.data.iconUrl || "")
  .setDescription(`\`\`\`${group.data.id}\`\`\``)
  .setURL(`https://vrchat.com/home/group/${group.data.id}`)
  .addFields(
    { name: "ℹ️ Info", value: groupInfo, inline: false },
    { name: "📜 Rules", value: rules, inline: false },
    { name: "📄 Description", value: description, inline: false }
  )
  .setImage(group.data.bannerUrl || "");

  embeds.push(embed2)
  embeds.push(embed1)

  let channel = client.channels.cache.get(process.env["CHANNEL_ID_GROUP"]);
  if (!channel) channel = await client.channels.fetch(process.env["CHANNEL_ID_GROUP"]);


  if (channel) {
    // Create form thread
    const thread = await channel.threads.create({
      name: sanitizeText(group.data?.name ||"N/A"),
      message: {
        embeds: embeds
      },
      appliedTags: [process.env["DISCORD_GROUP_NOTICKET_TAG_ID"]]
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
    await groupDb.set(groupId, {
      discordChannelId: thread.id,
      type: type,
      submitter: interaction.user.id,
      vrc: group.data,
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
