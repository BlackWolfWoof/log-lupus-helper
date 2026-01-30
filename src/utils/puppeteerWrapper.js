import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import { logDebug, logInfo, logWarn } from './logger.js'
import fs from 'fs';

function hasXvfb() {
  try {
    execSync('pgrep Xvfb');
    return true;
  } catch {
    return false;
  }
}

function hasXServer() {
  return Boolean(process.env.DISPLAY);
}

function getChromiumPath() {
  const paths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ];
  return paths.find(fs.existsSync) || null;
}

export async function launchSmartPuppeteer() {
  const executablePath = getChromiumPath();
  if (!executablePath) {
    logWarn('[puppeteer-wrapper]: WARNING: No system Chromium found, relying on default Puppeteer Chromium.');
  }

  const hasDisplay = hasXServer();
  const xvfbRunning = hasXvfb();

  logDebug(`[puppeteer-wrapper]: DISPLAY: ${process.env.DISPLAY || 'none'}`);
  logDebug(`[puppeteer-wrapper]: Xvfb running: ${xvfbRunning}`);
  logDebug(`[puppeteer-wrapper]: X server available: ${hasDisplay}`);

  let headlessMode = false;
  let args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1280,720',
    '--disable-features=VizDisplayCompositor'
  ];

  // If no X server, force headless mode
  if (!hasDisplay && !xvfbRunning) {
    logWarn('[puppeteer-wrapper]: ⚠️ No X server detected — forcing headless mode.');
    headlessMode = 'new';
  } else {
    logInfo('[puppeteer-wrapper]: 🖥️ X server detected — running in full headful mode.');
  }

  return puppeteer.launch({
    headless: headlessMode,
    executablePath: executablePath || undefined,
    args
  });
}
