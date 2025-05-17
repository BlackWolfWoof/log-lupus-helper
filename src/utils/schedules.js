import dotenv from "dotenv"; dotenv.config()
import { client } from '../discord/bot.js'
import { checkTermination } from "./terminationChecker.js";
import { listEmailsFromVRChat } from './mail.js'

async function main () {
  try {
    // setInterval(async () => {
    //   await doIntervalGroupLog();
    // }, 300000); // 5 Minutes

    setInterval(async () => {
      // Make sure the discord client is ready as well
      (async () => {
        while (!client.isReady()) await new Promise(res => setTimeout(res, 1000))
        await listEmailsFromVRChat()
        await checkTermination()
      })();
    }, 60000); // 1h

  } catch (e) {
    logError(`[schedules]: Fatal error that crashed the loop. Restarting loops. Error: ${e}`)
    console.error(e)
  }
}

(async () => {
    // Make sure the discord client is ready as well
    (async () => {
      while (!client.isReady()) await new Promise(res => setTimeout(res, 1000))
      await listEmailsFromVRChat()
      await checkTermination() // Run it once
    })();
    await main(); // Start loop
})()