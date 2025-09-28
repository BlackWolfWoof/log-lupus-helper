// A list of functions exported and re-used everyehere
import './loadEnv.js'
import { vrchat } from '../vrchat/authentication.ts'
// import { vrchatFetch } from '../vrchat/apiQueue.js'
import { logDebug, logInfo, logWarn, logError } from './logger.js'
import { flushCache, hasCache, deleteCache, getCache, setCache } from './cache.js'
import { PermissionsBitField, ChannelType } from 'discord.js'
import { userDb, avatarDb, groupDb, worldDb } from './quickdb.js'
import { MessageFlags } from 'discord.js'
import crypto from 'crypto';
import { 
  TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, 
  MediaGalleryBuilder, MediaGalleryItemBuilder, ButtonBuilder, 
  ButtonStyle, ActionRowBuilder, ContainerBuilder 
} from 'discord.js';
import he from "he";
const { decode } = he

const wait = ms => new Promise(res => setTimeout(res, ms));

/**
 * Sanetizes the text from special symbols VRChat introduces.
 * @param {string} text - String.
 * @returns {string} - Sanetized string.
 */
export function sanitizeText(text) {
  if (!text) {
    return ""
  }
  var symbolList = {
    "＠": "@",
    "＃": "#",
    "＄": "$",
    "％": "%",
    "＆": "&",
    "＝": "=",
    "＋": "+",
    "⁄": "/",
    "＼": "\\",
    ";": ";",
    "˸": ":",
    "‚": ",",
    "？": "?",
    "ǃ": "!",
    '＂': '"',
    "≺": "<",
    "≻": ">",
    "․": ".",
    "＾": "^",
    "｛": "{",
    "｝": "}",
    "［": "[",
    "］": "]",
    "（": "(",
    "）": ")",
    "｜": "|",
    "∗": "*"
  }
  var newText = text
  for (var key in symbolList) {
    var regex = new RegExp("\\" + key, "g") // Escape the key for special characters
    newText = newText.replace(regex, symbolList[key])
  }
  return newText.replace(/ {1,}/g, " ").trimEnd()
}


/**
 * Generates a SHA-256 hash from the provided input string.
 *
 * @param {string} input - The input string to be hashed.
 * @returns {string} The SHA-256 hash of the input string in hexadecimal format.
 *
 * @example
 * const hash = sha256Hash('hello world');
 * console.log(hash); // Output: a948904f2f0f479b8f8197694b30184b0d2ed1c1...
 */
export function sha256Hash(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export const languageMappings = {
    eng: 'us',
    kor: 'kr',
    rus: 'ru',
    spa: 'es',
    por: 'pt',
    zho: 'cn',
    deu: 'de',
    jpn: 'jp',
    fra: 'fr',
    swe: 'se',
    nld: 'nl',
    pol: 'pl',
    dan: 'dk',
    nor: 'no',
    ita: 'it',
    tha: 'th',
    fin: 'fi',
    hun: 'hu',
    ces: 'cz',
    tur: 'tr',
    ara: 'ae',
    ron: 'ro',
    vie: 'vn',
    ukr: 'ua',
    ase: 'us',
    bfi: 'gb',
    dse: 'nl',
    fsl: 'fr',
    jsl: 'jp',
    kvk: 'kr',

    mlt: 'mt',
    ind: 'id',
    hrv: 'hr',
    heb: 'he',
    afr: 'af',
    ben: 'be',
    bul: 'bg',
    cmn: 'cn',
    cym: 'cy',
    ell: 'el',
    est: 'et',
    fil: 'ph',
    gla: 'gd',
    gle: 'ga',
    hin: 'hi',
    hmn: 'cn',
    hye: 'hy',
    isl: 'is',
    lav: 'lv',
    lit: 'lt',
    ltz: 'lb',
    mar: 'hi',
    mkd: 'mk',
    msa: 'my',
    sco: 'gd',
    slk: 'sk',
    slv: 'sl',
    tel: 'hi',
    mri: 'nz',
    wuu: 'cn',
    yue: 'cn',
    tws: 'cn',
    asf: 'au',
    nzs: 'nz',
    gsg: 'de',
    epo: 'eo',
    tok: 'tok'
};


export function escapeMarkdown(text) {
  const markdownChars = [
    { char: '\\', escape: '\\\\' },
    { char: '*', escape: '\\*' },
    { char: '_', escape: '\\_' },
    { char: '`', escape: '\\`' },
    { char: '~', escape: '\\~' },
    { char: '>', escape: '\\>' },
    { char: '#', escape: '\\#' },
    { char: '-', escape: '\\-' },
    { char: '+', escape: '\\+' },
    { char: '=', escape: '\\=' },
    { char: '|', escape: '\\|' },
    { char: '!', escape: '\\!' },
    { char: '[', escape: '\\[' },
    { char: ']', escape: '\\]' },
    { char: '(', escape: '\\(' },
    { char: ')', escape: '\\)' },
    { char: '{', escape: '\\{' },
    { char: '}', escape: '\\}' },
    { char: '.', escape: '\\.' },
    { char: ',', escape: '\\,' },
    { char: ':', escape: '\\:' },
    { char: ';', escape: '\\;' },
    { char: '"', escape: '\\"' },
    { char: "'", escape: "\\'" }
  ];

  let escapedText = text;
  markdownChars.forEach(({ char, escape }) => {
    const regex = new RegExp(`\\${char}`, 'g'); // Create a regex to find the character
    escapedText = escapedText.replace(regex, escape); // Replace with escaped version
  });

  return escapedText;
}


/**
 * Sends a standardized bug message to the user in response to an interaction.
 * Depending on whether the interaction was deferred or not, it uses either `followUp` or `edit`.
 *
 * @async
 * @function sendBugMessage
 * @param {Object} interaction - The Discord interaction object.
 * @param {boolean} isDefered - Indicates if the interaction was deferred.
 * @param {boolean} isEphemeral - Whether the response should be ephemeral (visible only to the user).
 * 
 * @returns {Promise<void>} A promise that resolves when the message has been sent.
 */
export async function sendBugMessage(interaction, isDefered, isPublic) {
  if (isDefered) {
    await interaction.followUp({
      content: `🐛 Uh oh! Something went wrong. The developer has been notified about this issue.`,
      flags: isPublic ? undefined : MessageFlags.Ephemeral
    });
  } else {
    await interaction.edit({
      content: `🐛 Uh oh! Something went wrong. The developer has been notified about this issue.`,
      flags: isPublic ? undefined : MessageFlags.Ephemeral
    });
  }
}


/**
 * Converts a string to Title Case: first letter of each word capitalized, rest lowercased.
 * @param {string} str - The input string.
 * @returns {string} The title-cased string.
 */
export function toTitleCase(str) {
  return str.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}


export async function findChannelId(channelId) {
  // Check avatarDb
  const avatarEntries = await avatarDb.all();
  for (const entry of avatarEntries) {
    if (entry.value && entry.value.discordChannelId === channelId) {
      return entry;
    }
  }

  // Check userDb
  const userEntries = await userDb.all();
  for (const entry of userEntries) {
    if (entry.value && entry.value.discordChannelId === channelId) {
      return entry;
    }
  }

  // Check groupDb
  const groupEntries = await groupDb.all();
  for (const entry of groupEntries) {
    if (entry.value && entry.value.discordChannelId === channelId) {
      return entry;
    }
  }

  // Check worldDb
  const worldEntries = await worldDb.all();
  for (const entry of worldEntries) {
    if (entry.value && entry.value.discordChannelId === channelId) {
      const json = fromSafeJSON(entry.value.vrc) // Deletes .vrc and adds it back after running fromSafeJSON on it
      delete entry.value.vrc
      entry.value.vrc = json
      return entry;
    }
  }

  return null;
}


export async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const trustColors = {
  untrusted: "#CCCCCC",
  basic: "#1778FF",
  known: "#2BCF5C",
  trusted: "#FF7B42",
  veteran: "#B18FFF",
  vip: "#FF2626",
  troll: "#782F2F"
};

const trustRanks = {
  system_trust_basic: "New User",
  system_trust_known: "User",
  system_trust_trusted: "Known User",
  system_trust_veteran: "Trusted User",
  admin_moderator: "VIP",
  system_troll: "Nuisance",
  system_probable_troll: "Almost Nuisance"
};

// Enhanced trust level function
export const getUserTrustLevel = (user) => {
  let trustColor = trustColors.untrusted;
  let trustRank = "Visitor";

  const tags = user?.tags || [];

  if (tags.includes("admin_moderator")) {
    trustColor = trustColors.vip;
    trustRank = trustRanks.admin_moderator;
  } else if (tags.includes("system_troll")) {
    trustColor = trustColors.troll;
    trustRank = trustRanks.system_troll;
  } else if (tags.includes("system_probable_troll")) {
    trustColor = trustColors.troll;
    trustRank = trustRanks.system_probable_troll;
  } else if (tags.includes("system_trust_veteran")) {
    trustColor = trustColors.veteran;
    trustRank = trustRanks.system_trust_veteran;
  } else if (tags.includes("system_trust_trusted")) {
    trustColor = trustColors.trusted;
    trustRank = trustRanks.system_trust_trusted;
  } else if (tags.includes("system_trust_known")) {
    trustColor = trustColors.known;
    trustRank = trustRanks.system_trust_known;
  } else if (tags.includes("system_trust_basic")) {
    trustColor = trustColors.basic;
    trustRank = trustRanks.system_trust_basic;
  }

  return {
    trustColor,
    trustRank
  };
};



export async function addTicket(entry, emailHash) {
  // Determine which DB to use
  const db = entry.id.startsWith("usr_") ? userDb :
             entry.id.startsWith("avtr_") ? avatarDb :
             entry.id.startsWith("grp_") ? groupDb :
             entry.id.startsWith("wrld_") ? worldDb : null;

  if (!db) {
    logError(`[db]: Invalid entry ID format`)
    return;
  }

  // Fetch the existing entry
  const data = await db.get(entry.id);
  if (!data) {
    logError(`[db]: Entry not found`)
    return;
  }

  // Ensure ticket is an array
  const oldTickets = Array.isArray(data.tickets) ? data.tickets : [];

  // Combine with new emailHash
  const newTickets = [...oldTickets, emailHash];

  // Update and save
  data.tickets = newTickets;
  await db.set(entry.id, data);

  logDebug(`[db]: Ticket added to db sucsesfully`)
}



export async function isTicketHashUsed(emailHash) {
    // Helper to search in a specific DB
    async function searchInDb(db) {
        const allEntries = await db.all();
        for (const entry of allEntries) {
            const tickets = entry.value.tickets;
            if (Array.isArray(tickets) && tickets.includes(emailHash)) {
                return true;
            }
        }
        return false;
    }

    // Check all DBs
    const inUserDb = await searchInDb(userDb);
    if (inUserDb) return true;

    const inAvatarDb = await searchInDb(avatarDb);
    if (inAvatarDb) return true;

    const inGroupDb = await searchInDb(groupDb);
    if (inGroupDb) return true;

    const inWorldDb = await searchInDb(worldDb);
    if (inWorldDb) return true;

    return false;
}



/**
 * Class representing prefill configuration for a report form.
 * It encapsulates mappings between custom field IDs, ticket field IDs, and their values,
 * as well as utilities to generate formatted data for forms and URLs.
 */
export class ReportPrefill {
  constructor() {
    this.fields = {
      report: {
        customFieldId: "360056455174",
        tfId: "360056455174",
        values: {
          user_report: "I want to file a report",
          ban_appeal: "I want to appeal a ban"
        }
      },
      report_type: {
        customFieldId: "41535925078291",
        tfId: "41535925078291",
        values: {
          content_report: "Content Report",
          account_report: "Account Report"
        },
        subfields: {
          content_report: {
            customFieldId: "41535943048211",
            tfId: "41535943048211",
            values: {
              content_report_avatar: "Avatar",
              content_report_world: "World",
              content_report_group: "Group",
              contentreport_issue_not_described: "My issue is not described above"
            },
            textFields: [
              {
                customFieldId: "41536179133203",
                label: "Additional content details"
              }
            ]
          },
          account_report: {
            customFieldId: "41536076540179",
            tfId: "41536076540179",
            values: {
              account_report_prints: "Prints",
              account_report_emoji: "Emoji",
              account_report_stickers: "Stickers",
              account_report_gallery: "Gallery",
              account_report_profile: "Profile",
              account_report_user_icon: "User Icon",
              take_it_down_act: "TAKE IT DOWN Act (Compliance)",
              accountreport_issue_not_described: "My issue is not described above"
            },
            textFields: [
              {
                customFieldId: "41537175838995",
                label: "Account report explanation"
              }
            ]
          }
        }
      }
    };
  }

  getUrlParam(category, key, subkey = null) {
    const field = this.fields[category];
    if (!field || !field.values[key]) {
      throw new Error(`Invalid category/key: ${category}.${key}`);
    }

    let url = `&tf_${field.customFieldId}=${encodeURIComponent(key)}`;

    if (subkey && field.subfields?.[key]) {
      const sub = field.subfields[key];
      if (!sub.values[subkey]) {
        throw new Error(`Invalid subkey for ${key}: ${subkey}`);
      }
      url += `&tf_${sub.customFieldId}=${encodeURIComponent(subkey)}`;
    }

    return url;
  }

  getUrlParamsWithText(category, key, subkey = null, textValue = "") {
    const field = this.fields[category];
    if (!field || !field.values[key]) {
      throw new Error(`Invalid category/key: ${category}.${key}`);
    }

    let url = `&tf_${field.customFieldId}=${encodeURIComponent(key)}`;

    if (field.subfields?.[key]) {
      const sub = field.subfields[key];

      if (subkey) {
        if (!sub.values[subkey]) {
          throw new Error(`Invalid subkey for ${key}: ${subkey}`);
        }
        url += `&tf_${sub.customFieldId}=${encodeURIComponent(subkey)}`;
      }

      if (textValue && sub.textFields?.length > 0) {
        sub.textFields.forEach(tf => {
          url += `&tf_${tf.customFieldId}=${encodeURIComponent(textValue)}`;
        });
      }
    }

    return url;
  }

  getFormFields(category, key, subkey = null, textValue = "") {
    const field = this.fields[category];
    const fields = [{
      name: `request[custom_fields][${field.customFieldId}]`,
      value: key
    }];

    if (field.subfields?.[key]) {
      const sub = field.subfields[key];

      if (subkey) {
        if (!sub.values[subkey]) {
          throw new Error(`Invalid subkey for ${key}: ${subkey}`);
        }

        fields.push({
          name: `request[custom_fields][${sub.customFieldId}]`,
          value: subkey
        });
      }

      if (textValue && sub.textFields?.length > 0) {
        sub.textFields.forEach(tf => {
          fields.push({
            name: `request[custom_fields][${tf.customFieldId}]`,
            value: textValue
          });
        });
      }
    }

    return fields;
  }

  getLabel(category, key, subkey = null) {
    const field = this.fields[category];
    let label = field?.values[key] || null;
    if (subkey && field.subfields?.[key]) {
      const sub = field.subfields[key];
      const subLabel = sub.values[subkey];
      label += ` → ${subLabel}`;
    }
    return label;
  }

  shouldShowReportType(reportKey) {
    return reportKey === "user_report";
  }
}

export function formatHumanNumber(num) {
  return new Intl.NumberFormat('fr-FR').format(num);
}

export function toSafeJSON(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return `${value.toString()}n`; // Mark it as BigInt string
    }
    return value;
  });
}

export function fromSafeJSON(json) {
  return JSON.parse(json, (key, value) => {
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1)); // Remove "n" and convert back to BigInt
    }
    return value;
  });
}


export function snowflakeOlderThan(snowflake, days) {
    const id = BigInt(snowflake);
    const timestamp = (id >> 22n) + 1420070400000n; // Discord epoch in ms
    const now = BigInt(Date.now());
    const threshold = BigInt(days) * 24n * 60n * 60n * 1000n; // days → ms
    return now - timestamp > threshold;
}


export function shortenText(text) {
  return text.length > 16 ? text.slice(0, 48) + "..." : text;
}


/**
   * Parses a VRChat Trust & Safety email into Discord.js components.
   * Supports multiple images and removes image lines from the body.
   * @param {string} title - The email title line (already decoded/escaped)
   * @param {string} emailText - The full email text (including body and last ID)
   * @returns {ContainerBuilder[]} Discord.js components array
 */
export function parseVrChatEmail(title, emailText) {
  const lines = emailText.split('\n').map(l => l.trim());

  // Extract ticket ID from title (#123456)
  const ticketIdMatch = title.match(/#(\d+)/);
  const ticketId = ticketIdMatch ? ticketIdMatch[1] : null;

  const imageUrls = [];
  const cleanedLines = [];

  // Collect images and filter them out of the body
  const imageRegex = /^\[(https?:\/\/[^\]]+)\]$/;
  lines.forEach(line => {
    const match = line.match(imageRegex);
    if (match) {
      imageUrls.push(match[1]);
    } else {
      cleanedLines.push(line);
    }
  });

  // Extract last line ID (e.g., [ZEM73Z-NW99W])
  const lastLineMatch = cleanedLines[cleanedLines.length - 1]?.match(/\[([^\]]+)\]/);
  const lastId = lastLineMatch ? lastLineMatch[1] : '';

  // Remove the last line from the body (we'll add it formatted later)
  if (lastLineMatch) cleanedLines.pop();

  // Rebuild the body
  const bodyText = cleanedLines.join('\n');

  // Build container
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${escapeMarkdown(decode(title))}**`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

  if (imageUrls.length > 0) {
    const gallery = new MediaGalleryBuilder();
    imageUrls.forEach(url => gallery.addItems(new MediaGalleryItemBuilder().setURL(url)));
    container.addMediaGalleryComponents(gallery);
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${escapeMarkdown(decode(bodyText))}\n\n-# [${lastId}]`)
  );

  if (ticketId) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel("Open Ticket")
          .setEmoji({ name: "🎫" })
          .setURL(`https://help.vrchat.com/hc/en-us/requests/${ticketId}`)
      )
    );
  }

  return [container];
}