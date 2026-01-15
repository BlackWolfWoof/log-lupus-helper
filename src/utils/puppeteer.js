import './loadEnv.js'
import puppeteer from 'puppeteer';
import fs from 'fs';
import { logDebug, logInfo, logWarn, logError } from './logger.js'
import { launchSmartPuppeteer } from './puppeteerWrapper.js';

/**
 * Load cookies from storageState.json
 */
function loadStorageState(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const data = fs.readFileSync(filePath, 'utf8');
  const state = JSON.parse(data);
  return state.cookies || [];
}

/**
 * Save cookies to storageState.json
 */
async function saveStorageState(page, filePath) {
  const cookies = await page.cookies();
  const state = { cookies };
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  console.log('✅ Cookies saved to', filePath);
}

/**
 * Simple sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Launches (or reuses) a shared browser instance.
 */
let browserInstance = null;

export async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) return browserInstance;
  browserInstance = await launchSmartPuppeteer();
  return browserInstance;
}


/**
 * Scrapes the H1 text from a VRChat Help Center request page
 * Automatically logs in if redirected to the login page,
 * saves cookies, and returns to the original URL before scraping.
 * 
 * @param {string|number} requestId - The numeric request ID (e.g. 629706)
 * @returns {Promise<string|null>} The H1 text content, or null if not found
 */
export async function scrapeChannelId(requestId) {
  const url = `https://help.vrchat.com/hc/en-us/requests/${requestId}`;
  const cookieFile = 'storageState.json';

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Load cookies
    const cookies = loadStorageState(cookieFile);
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
    }

    // Navigate to the page
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await sleep(2000);

    let currentUrl = page.url();

  // If redirected to login page, perform login
  if (currentUrl.startsWith('https://help.vrchat.com/auth/v3/signin')) {
    logInfo(`[puppeteer]: 🔐 Expired / no login cookie, redirected to login page, attempting login...`);

    // Wait for React inputs to mount
    await page.waitForSelector('[data-testid="email-input"]', { visible: true });
    await page.waitForSelector('[data-testid="password-input"]', { visible: true });

    // Type credentials (React-safe)
    await page.type('[data-testid="email-input"]', process.env["ZENDESK_EMAIL"], { delay: 50 });
    await page.type('[data-testid="password-input"]', process.env["ZENDESK_PASSWORD"], { delay: 50 });

    // Submit + wait for navigation
    await Promise.all([
      page.click('[data-testid="submit-button"]'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded' })
    ]);

    // Save cookies after successful login
    await saveStorageState(page, cookieFile);

    // Return to original URL
    logInfo(`[puppeteer]: ↩️ Returning to original request page...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await sleep(10000);

    currentUrl = page.url();
  }


    // Extract H1 text
    const h1Text = await page.$eval('main h1', el => el.innerText.trim());
    logDebug(`[puppeteer]: Found ${requestId} - ${h1Text}`);
    return h1Text;

  } catch (error) {
    logError(`[puppeteer]: Panic, unexpected error while trying to get ${requestId}!!`)
    console.error(error);
    process.exit(1) // Panic
    return null;
  } finally {
    await page.close(); // Close just the tab, not the browser
  }
}