import '../utils/loadEnv.js'
import { Client, GatewayIntentBits, REST, Routes, ActivityType, MessageFlags, ChannelType } from 'discord.js'
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js'
import { commands, interactions, loadDiscordCommands, loadInteractions } from './handler.js'
import { webhookClient, getFormattedTime } from '../utils/logger.js'


// Create the Discord bot client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
  rest: {
    api: 'https://discordproxy.local.blackwolfwoof.com/api',
  }
})

// Register commands globally
client.once('ready', async () => {
  try {
    const rest = new REST().setToken(client.token)

    await loadDiscordCommands() // Loads the commands into the bot
    await loadInteractions() // Loads the interactions to listen to into the bot

    // Convert commands map to an array of command data
    const msgCommands = Array.from(commands.values()).map(cmd => cmd.discord)
    // Register commands with Discord API

    await rest.put(Routes.applicationCommands(client.user.id), { body: msgCommands })

    // Set bot status
    // client.user.setActivity('VRChat Groups', { type: ActivityType.Watching })

    logInfo(`[Discord]: ✅ Client is ready: ${client.user.username}`)  
  } catch (error) {
    logError(`[Discord]: ❌ Error during bot setup: ${error.message}`)
    throw error
  }
})

// Handle command interactions
client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand()) {
    const { commandName, user } = interaction
    const command = commands.get(commandName)

    if (!command) {
      return interaction.reply({
        content: "🐛 Unknown command! Report this error to the developer.",
        flags: MessageFlags.Ephemeral
      })
    }

    try {
      await command.execute(interaction)
    } catch (error) {
      logError(`❌ Error executing ${commandName} by ${user.username}: ${error}`)
      console.error(error)

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "🐛 You found a bug! Report this error to the developer.",
          flags: MessageFlags.Ephemeral
        })
      } else {
        await interaction.reply({
          content: "🐛 You found a bug! Report this error to the developer.",
          flags: MessageFlags.Ephemeral
        })
      }
    }
  }
  // Handle button/select menu interactions
  else if (interaction.isButton() || interaction.isStringSelectMenu()) {
    const interactionHandler = interactions.get(interaction.customId)

    if (!interactionHandler) {
      logWarn(`[Interaction]: ⚠️ No handler found for ${interaction.customId}`)
      return
    }

    try {
      await interactionHandler(interaction)
      logDebug(`[Interaction]: ✅ Successfully handled ${interaction.customId} - ${interaction.user.id}`)
    } catch (error) {
      try {
        logError(`[Interaction]: ❌ Error handling ${interaction.customId}: ${error.message}`)
        console.error(error)

        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: "🐛 Something went wrong! Report this error to the developer.",
            flags: MessageFlags.Ephemeral
          })
        } else {
          await interaction.reply({
            content: "🐛 Something went wrong! Report this error to the developer.",
            flags: MessageFlags.Ephemeral
          })
        }
      } catch (e) {
        logError(`[Interaction]: ❌ Error handeling error`)
        console.error(error)
      }
    }
  }
})

client.login(process.env["DISCORD_BOT_TOKEN"])

export { client }