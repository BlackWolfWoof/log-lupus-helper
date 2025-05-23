import '../../utils/loadEnv.js'
import { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, EmbedBuilder, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { sendBugMessage, getAvatar, getUserGroups, sanitizeText, escapeMarkdown, getCurrentUser, getUser, toTitleCase, getUserTrustLevel } from '../../utils/functions.js';
import { client } from '../bot.js'
import { userDb, avatarDb } from '../../utils/quickdb.js'

const discord = new SlashCommandBuilder()
  .setName("report-user")
  .setDescription("Report a user")
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addStringOption(option =>
    option
      .setName('user-id')
      .setDescription('ID of the user: usr_a310c385-72f9-4a4b-8ba0-75b05b1317b3')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Choose a category')
      .setRequired(true)
      .addChoices(
        { name: 'Racist', value: 'user-racism' },
        { name: 'NSFW avatar in public', value: 'user-nsfw' },
        { name: 'Underage', value: 'user-child' },
        { name: 'Pedophile', value: 'user-pedo' },
        { name: 'Bad Sticker/Print', value: 'user-media' },
        { name: 'Promoting Selfharm', value: 'user-selfharm' },
        { name: 'Bad Username', value: 'user-badusername' },
        { name: 'Other reason', value: 'user-other' }
      )
  );

async function execute(interaction) {
  const userId = interaction.options.getString('user-id');
  const type = interaction.options.getString('type');

  // Check if already in db
  const alreadyExists = await userDb.get(userId)
  if (alreadyExists) {
    await interaction.reply({
      content: `❌ The user is already tracked in <#${alreadyExists.discordChannelId}>`,
      flags: MessageFlags.Ephemeral
    })
    return
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }) // Preventing timeouts of the command

  // VRChat user info
  const getServiceAccount = await getCurrentUser()

  // Security settings so you cannot get info about your own avatar. This would give people the ability to query avatars from the logged in user otherwise
  if (getServiceAccount.id === userId) {
    await interaction.editReply({
      content: `⚠️ For security reasons this user cannot be reported.`,
      flags: MessageFlags.Ephemeral
    })
    return
  }


  // Get User and its groups and see if user is valid
  const userInfo = await getUser(userId);
  if (userInfo.error) {
    await interaction.editReply({
      content: `❌ Input was not a user-id. Make sure the user-id has the following format. Here an example: \`usr_a310c385-72f9-4a4b-8ba0-75b05b1317b3\``,
      flags: MessageFlags.Ephemeral
    })
    return
  }

  // If user has robot avi, i can't track the takedown status as thats the way this is done
  if (userInfo.currentAvatarImageUrl === 'https://api.vrchat.cloud/api/1/file/file_0e8c4e32-7444-44ea-ade4-313c010d4bae/1/file') {
    await interaction.editReply({
      content: `❌ The user was already terminated or currently has the [Robot](<https://vrchat.com/home/avatar/avtr_c38a1615-5bf5-42b4-84eb-a8b6c37cbd11>) avatar equipped.\nThe way this tool detects the termination is, if someone has the avatar.\nReasons why someone has that avatar:\n- Terminated/Banned\n- Avatar they used got removed/set private\n- User switched into the avatar manually`,
      flags: MessageFlags.Ephemeral
    })
    return
  }
  const userGroups = await getUserGroups(userId);

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
    .setTitle(sanitizeText(escapeMarkdown(userInfo?.displayName)))
    .setDescription(`\`\`\`${userInfo.id}\`\`\``)
    .setURL(`https://vrchat.com/home/user/${userInfo.id}`)
    .setColor(getUserTrustLevel(userInfo).trustColor)
    .setImage(profilePic)
    .addFields(
      { name: "📰 Status", value: status, inline: false },
      { name: "➕ Pronouns", value: escapeMarkdown(userInfo.pronouns), inline: false },
      { name: "📜 Bio", value: bio.length > 1024 ? bio.slice(0, 1021) + "..." : bio, inline: false },
      { name: "🧑‍🦲 Age Verification", value: ageIcon, inline: false },
      { name: "📅 Joined VRChat", value: joinedTimestamp, inline: false },
      ...groupFields
    )
    .setAuthor({
      name: interaction.user.username,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true, size: 512 })
    });



  let channel = client.channels.cache.get(process.env["CHANNEL_ID_USER"]);
  if (!channel) channel = await client.channels.fetch(process.env["CHANNEL_ID_USER"]);


  if (channel) {
    // Create form thread
    const thread = await channel.threads.create({
      name: sanitizeText(userInfo.displayName),
      message: {
        embeds: [embed]
      }
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
    row.addComponents(buttonReport)

    const starterMessage = await thread.fetchStarterMessage({ force: true })

    // Now you can edit it
    const edit = await starterMessage.edit({
      embeds: [embed],
      components: [row]
    });


    // Save to db
    await userDb.set(userId, {
      discordChannelId: thread.id,
      type: type,
      submitter: interaction.user.id,
      vrc: userInfo,
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
