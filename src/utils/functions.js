// A list of functions exported and re-used everyehere
import './loadEnv.js'
import { testSession } from '../vrchat/authentication.js'
import { vrchatFetch } from '../vrchat/apiQueue.js'
import { logDebug, logInfo, logWarn, logError } from './logger.js'
import { flushCache, hasCache, deleteCache, getCache, setCache } from './cache.js'
import { PermissionsBitField, ChannelType } from 'discord.js'
import { userDb, avatarDb } from './quickdb.js'
import { MessageFlags } from 'discord.js'
import crypto from 'crypto';

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


const groupCache = new Map()
/**
 * Retrieves information about a VRChat group from the API, with caching support.
 *
 * @async
 * @function getGroup
 * @param {string} groupId - The unique identifier of the VRChat group.
 * @returns {Promise<Object>} A promise that resolves to an object containing group details.
 *
 * @example
 * const groupInfo = await getGroup("grp_71a7ff59-112c-4e78-a990-c7cc650776e5")
 * console.log(groupInfo.name) // Outputs the group name
 *
 * @typedef {Object} VRChatGroup
 * @property {boolean} ageVerificationSlotsAvailable - Whether age verification slots are available.
 * @property {string} ageVerificationBetaCode - The beta code for age verification.
 * @property {number} ageVerificationBetaSlots - The number of beta slots available.
 * @property {string[]} badges - List of badges assigned to the group.
 * @property {string} id - The group's unique identifier.
 * @property {string} name - The name of the group.
 * @property {string} shortCode - The short code identifier for the group.
 * @property {string} discriminator - Group discriminator.
 * @property {string} description - A brief description of the group.
 * @property {string} iconUrl - URL to the group's icon.
 * @property {string} bannerUrl - URL to the group's banner.
 * @property {string} privacy - Privacy setting of the group (e.g., "default").
 * @property {string} ownerId - The user ID of the group's owner.
 * @property {string} rules - The group's rules.
 * @property {string[]} links - Associated external links.
 * @property {string[]} languages - Supported languages in the group.
 * @property {string} iconId - ID of the group's icon.
 * @property {string} bannerId - ID of the group's banner.
 * @property {number} memberCount - Total number of members in the group.
 * @property {string} memberCountSyncedAt - Timestamp when member count was last synced.
 * @property {boolean} isVerified - Whether the group is verified.
 * @property {string} joinState - Current join state of the group (e.g., "closed").
 * @property {string[]} tags - List of associated tags.
 * @property {string} transferTargetId - User ID of a potential transfer target.
 * @property {VRChatGallery[]} galleries - List of associated galleries.
 * @property {string} createdAt - Timestamp of group creation.
 * @property {string} updatedAt - Timestamp of last group update.
 * @property {string} lastPostCreatedAt - Timestamp of the last post creation.
 * @property {number} onlineMemberCount - Number of online members.
 * @property {string} membershipStatus - The membership status of the current user.
 * @property {VRChatMember} myMember - The current user's membership details.
 * @property {VRChatRole[]} roles - List of roles within the group.
 *
 * @typedef {Object} VRChatGallery
 * @property {string} id - The gallery's unique identifier.
 * @property {string} name - The name of the gallery.
 * @property {string} description - Description of the gallery.
 * @property {boolean} membersOnly - Whether the gallery is restricted to members.
 * @property {string[]} roleIdsToView - Roles that can view the gallery.
 * @property {string[]} roleIdsToSubmit - Roles that can submit to the gallery.
 * @property {string[]} roleIdsToAutoApprove - Roles that can auto-approve submissions.
 * @property {string[]} roleIdsToManage - Roles that can manage the gallery.
 * @property {string} createdAt - Timestamp of gallery creation.
 * @property {string} updatedAt - Timestamp of last gallery update.
 *
 * @typedef {Object} VRChatMember
 * @property {string} id - The member's unique identifier.
 * @property {string} groupId - ID of the group the member belongs to.
 * @property {string} userId - The user's unique identifier.
 * @property {string[]} roleIds - List of role IDs assigned to the member.
 * @property {string} acceptedByDisplayName - Display name of the user who accepted them.
 * @property {string} acceptedById - ID of the user who accepted them.
 * @property {string} createdAt - Timestamp of membership creation.
 * @property {string} managerNotes - Notes from the group manager.
 * @property {string} membershipStatus - Membership status (e.g., "member").
 * @property {boolean} isSubscribedToAnnouncements - Whether subscribed to announcements.
 * @property {string} visibility - Visibility status of the member.
 * @property {boolean} isRepresenting - Whether the member is representing the group.
 * @property {string} joinedAt - Timestamp when the user joined.
 * @property {string} bannedAt - Timestamp when the user was banned (if applicable).
 * @property {boolean} has2FA - Whether the member has two-factor authentication enabled.
 * @property {boolean} hasJoinedFromPurchase - Whether joined via purchase.
 * @property {string} lastPostReadAt - Timestamp when last post was read.
 * @property {string[]} mRoleIds - List of role IDs the member has.
 * @property {string[]} permissions - List of permissions granted.
 *
 * @typedef {Object} VRChatRole
 * @property {string} id - The role's unique identifier.
 * @property {string} groupId - The ID of the group the role belongs to.
 * @property {string} name - The name of the role.
 * @property {string} description - Description of the role.
 * @property {boolean} isSelfAssignable - Whether the role can be self-assigned.
 * @property {string[]} permissions - List of permissions associated with the role.
 * @property {boolean} isManagementRole - Whether the role is a management role.
 * @property {boolean} requiresTwoFactor - Whether the role requires two-factor authentication.
 * @property {boolean} requiresPurchase - Whether the role requires a purchase.
 * @property {number} order - Order of the role in hierarchy.
 * @property {string} createdAt - Timestamp of role creation.
 * @property {string} updatedAt - Timestamp of last role update.
 */
export async function getGroup(groupId, useCache = true) {
  // Check cache
  const cachedData = await getCache(groupId)
  if (cachedData && useCache) {
    logDebug(`[Cache]: Returning cached data for group ${groupId}`)
    return cachedData
  }

  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/groups/${groupId}`, {
    headers: {
      "User-Agent": process.env["USERAGENT"],
      "Cookie": process.env["VRCHAT_TOKEN"]
    },
    method: "GET"
  })

  let data = await response.json()

  // Check request status
  switch (response.status) {
    case 200:
      // Store in cache
      await setCache(groupId, data)
      break
    case 401:
      await testSession()
      data = await getGroup(groupId, useCache)
      break
  }

  return data
}


/**
 * Retrieves information about a group member in VRChat, with optional caching.
 *
 * @param {string} groupId - The ID of the group.
 * @param {string} userId - The ID of the user.
 * @param {boolean} [useCache=true] - Whether to use cached data if available.
 * @returns {Promise<Object>} The group member's data from the API or cache.
 *
 * @throws {Error} If there is an issue with fetching data from the API.
 *
 * @example
 * const memberData = await getGroupMember("group123", "user456");
 * console.log(memberData);
 */
export async function getGroupMember(groupId, userId, useCache = true) {
  // Check cache
  const cachedData = await getCache(`${groupId}_member_${userId}`)
  if (cachedData && useCache) {
    logDebug(`[Cache]: Returning cached data for group member ${groupId} ${userId}`)
    return cachedData
  }

  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/groups/${groupId}/members/${userId}`, {
    headers: {
      "User-Agent": process.env["USERAGENT"],
      "Cookie": process.env["VRCHAT_TOKEN"]
    },
    method: "GET"
  }, 9)

  let data = await response.json()

  // Check request status
  switch (response.status) {
    case 200:
    case 403:
    case 404:
      // Store in cache
      await setCache(`${groupId}_member_${userId}`, data)
      break
    case 401:
      await testSession()
      data = await getGroupMember(groupId, userId, useCache)
      break
  }

  return data
}


/**
 * Retrieves the roles for a specific VRChat group, with optional caching.
 *
 * @param {string} groupId - The ID of the group.
 * @param {boolean} [useCache=true] - Whether to use cached data if available.
 * @returns {Promise<Object>} The group roles data from the API or cache.
 *
 * @throws {Error} If there is an issue with fetching data from the API.
 *
 * @example
 * const roles = await getGroupRoles("group123");
 * console.log(roles);
 */
export async function getGroupRoles(groupId, useCache = true) {
  // Check cache
  const cachedData = await getCache(`${groupId}_roles`)
  if (cachedData && useCache) {
    logDebug(`[Cache]: Returning cached data for group member ${groupId}`)
    return cachedData
  }

  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/groups/${groupId}/roles`, {
    headers: {
      "User-Agent": process.env["USERAGENT"],
      "Cookie": process.env["VRCHAT_TOKEN"]
    },
    method: "GET"
  }, 9)

  let data = await response.json()

  // Check request status
  switch (response.status) {
    case 200:
    case 404:
      // Store in cache
      await setCache(`${groupId}_roles`, data)
      break
    case 401:
      await testSession()
      data = await getGroupRoles(groupId, useCache)
      break
  }

  return data
}


/**
 * Retrieves information about a VRChat user from the API, with caching support.
 *
 * @async
 * @function getUser
 * @param {string} userId - The unique identifier of the VRChat user.
 * @returns {Promise<VRChatUser>} A promise that resolves to an object containing user details.
 *
 * @example
 * const userInfo = await getUser("usr_c1644b5b-3ca4-45b4-97c6-a2a0de70d469")
 * console.log(userInfo.displayName) // Outputs the user's display name
 *
 * @typedef {Object} VRChatUser
 * @property {string} ageVerificationStatus - Age verification status ("hidden", "verified", etc.).
 * @property {boolean} ageVerified - Whether the user is age verified.
 * @property {boolean} allowAvatarCopying - Whether the user allows avatar copying.
 * @property {VRChatBadge[]} badges - List of badges assigned to the user.
 * @property {string} bio - User's biography.
 * @property {string[]} bioLinks - List of links in the user's bio.
 * @property {string} currentAvatarImageUrl - URL to the user's current avatar.
 * @property {string} currentAvatarThumbnailImageUrl - URL to the user's avatar thumbnail.
 * @property {string[]} currentAvatarTags - Tags associated with the user's avatar.
 * @property {string} date_joined - The date the user joined VRChat.
 * @property {string} developerType - User's developer type (e.g., "none").
 * @property {string} displayName - The user's display name.
 * @property {string} friendKey - Key used for friend-related actions.
 * @property {string} friendRequestStatus - Status of a friend request (if applicable).
 * @property {string} id - The user's unique identifier.
 * @property {string} instanceId - The current instance ID the user is in.
 * @property {boolean} isFriend - Whether the user is a friend.
 * @property {string} last_activity - Timestamp of the user's last activity.
 * @property {string} last_login - Timestamp of the user's last login.
 * @property {string} last_mobile - Timestamp of the last mobile login.
 * @property {string} last_platform - The last platform used (e.g., "standalonewindows").
 * @property {string} location - The world or instance the user is currently in.
 * @property {string} note - A user-defined note about this user.
 * @property {string} platform - The platform the user is currently using.
 * @property {string} profilePicOverride - URL of a custom profile picture.
 * @property {string} profilePicOverrideThumbnail - URL of the profile picture thumbnail.
 * @property {string} pronouns - The user's preferred pronouns.
 * @property {string} state - The user's current online state (e.g., "offline").
 * @property {string} status - The user's account status (e.g., "active").
 * @property {string} statusDescription - A description of the user's current status.
 * @property {string[]} tags - A list of tags associated with the user.
 * @property {string} travelingToInstance - The instance the user is traveling to.
 * @property {string} travelingToLocation - The location the user is traveling to.
 * @property {string} travelingToWorld - The world the user is traveling to.
 * @property {string} userIcon - URL of the user's profile icon.
 * @property {string} worldId - The ID of the world the user is in.
 *
 * @typedef {Object} VRChatBadge
 * @property {string} assignedAt - Timestamp when the badge was assigned.
 * @property {string} badgeDescription - Description of the badge.
 * @property {string} badgeId - The unique identifier of the badge.
 * @property {string} badgeImageUrl - URL to the badge image.
 * @property {string} badgeName - The name of the badge.
 * @property {boolean} hidden - Whether the badge is hidden.
 * @property {boolean} showcased - Whether the badge is showcased.
 * @property {string} updatedAt - Timestamp when the badge was last updated.
 */
export async function getUser(userId, useCache = true) {
  // Check cache
  const cachedData = await getCache(userId)
  if (cachedData && useCache) {
    logDebug(`[Cache]: Returning cached data for user ${userId}`)
    return cachedData
  }

  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/users/${userId}`, {
    headers: {
      "User-Agent": process.env["USERAGENT"],
      "Cookie": process.env["VRCHAT_TOKEN"]
    },
    method: "GET"
  })

  let data = await response.json()

  // Check request status
  switch (response.status) {
    case 200:
      // Store in cache
      await setCache(userId, data)
      break
    case 401:
      await testSession()
      data = await getUser(userId, useCache)
      break
    case 404:
      break
  }

  return data
}


/**
 * Retrieves a list of VRChat groups the user is a member of, with caching support.
 *
 * @async
 * @function getUserGroups
 * @param {string} userId - The unique identifier of the VRChat user.
 * @returns {Promise<VRChatUserGroup[]>} A promise that resolves to an array of user group objects.
 *
 * @example
 * const userGroups = await getUserGroups("usr_c1644b5b-3ca4-45b4-97c6-a2a0de70d469")
 * console.log(userGroups[0].name) // Outputs the name of the first group
 *
 * @typedef {Object} VRChatUserGroup
 * @property {string} id - The unique identifier of the user group membership.
 * @property {string} name - The name of the group.
 * @property {string} shortCode - The group's short code.
 * @property {string} discriminator - Group discriminator.
 * @property {string} description - A brief description of the group.
 * @property {string} iconId - The ID of the group's icon.
 * @property {string} iconUrl - URL to the group's icon.
 * @property {string} bannerId - The ID of the group's banner.
 * @property {string} bannerUrl - URL to the group's banner.
 * @property {string} privacy - Privacy setting of the group.
 * @property {string} lastPostCreatedAt - Timestamp of the last post created in the group.
 * @property {string} ownerId - The user ID of the group's owner.
 * @property {number} memberCount - The total number of members in the group.
 * @property {string} groupId - The unique identifier of the group.
 * @property {string} memberVisibility - Visibility status of the user within the group.
 * @property {boolean} isRepresenting - Whether the user is representing this group.
 * @property {boolean} mutualGroup - Whether the group is mutual between friends.
 * @property {string} lastPostReadAt - Timestamp when the last post was read.
 */
export async function getUserGroups(userId, useCache = true) {
  // Check cache
  const cachedData = await getCache(`${userId}_group`)
  if (cachedData && useCache) {
    logDebug(`[Cache]: Returning cached group data for user ${userId}`)
    return cachedData
  }

  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/users/${userId}/groups`, {
    headers: {
      "User-Agent": process.env["USERAGENT"],
      "Cookie": process.env["VRCHAT_TOKEN"]
    },
    method: "GET"
  })

  let data = await response.json()

  // Check request status
  switch (response.status) {
    case 200:
      // Store in cache
      await setCache(`${userId}_group`, data)
      break
    case 401:
      await testSession()
      data = await getUserGroups(userId, useCache)
      break
    case 404:
      break
  }

  return data
}


/**
 * Parses a VRChat location tag and extracts relevant information about the instance.
 *
 * @async
 * @function parseLocation
 * @param {string} tag - The VRChat location tag to be parsed.
 * @returns {Promise<ParsedLocation>} A promise that resolves to an object containing parsed location details.
 *
 * @example
 * const locationInfo = await parseLocation("wrld_ba913a96-fac4-4048-a062-9aa5db092812:12345~hidden(usr_1234)~region(us)")
 * console.log(locationInfo.worldId) // Outputs: "wrld_ba913a96-fac4-4048-a062-9aa5db092812"
 *
 * @typedef {Object} ParsedLocation
 * @property {string} tag - The original location tag.
 * @property {boolean} isOffline - Whether the user is offline.
 * @property {boolean} isPrivate - Whether the instance is private.
 * @property {boolean} isTraveling - Whether the user is traveling.
 * @property {boolean} isRealInstance - Whether this is a real instance (not local).
 * @property {string} worldId - The world ID associated with the tag.
 * @property {string} instanceId - The instance ID within the world.
 * @property {string} instanceName - The name of the instance.
 * @property {string} accessType - The access level of the instance ("public", "invite", "friends", etc.).
 * @property {string} accessTypeName - The detailed access type, including group-related types.
 * @property {string} region - The server region of the instance.
 * @property {string} shortName - The short name of the instance, if applicable.
 * @property {string|null} userId - The user ID associated with the access type (e.g., the inviter).
 * @property {string|null} hiddenId - The user ID if the instance is "Friends of Guests" access.
 * @property {string|null} privateId - The user ID if the instance is private.
 * @property {string|null} friendsId - The user ID if the instance is "Friends Only".
 * @property {string|null} groupId - The group ID if the instance is a group world.
 * @property {string|null} groupName - The name of the group (fetched from the API if applicable).
 * @property {string|null} groupAccessType - The access type for the group instance.
 * @property {boolean} canRequestInvite - Whether the user can request an invite.
 * @property {boolean} strict - Whether strict instance rules apply.
 * @property {boolean} ageGate - Whether the instance has an age restriction.
 */
export async function parseLocation(tag) {
  var _tag = String(tag || '')
  var ctx = {
    tag: _tag,
    isOffline: false,
    isPrivate: false,
    isTraveling: false,
    isRealInstance: false,
    worldId: '',
    instanceId: '',
    instanceName: '',
    accessType: '',
    accessTypeName: '',
    region: '',
    shortName: '',
    userId: null,
    hiddenId: null,
    privateId: null,
    friendsId: null,
    groupId: null,
    groupAccessType: null,
    canRequestInvite: false,
    strict: false,
    ageGate: false
  }
  if (_tag === 'offline' || _tag === 'offline:offline') {
    ctx.isOffline = true
  } else if (_tag === 'private' || _tag === 'private:private') {
    ctx.isPrivate = true
  } else if (_tag === 'traveling' || _tag === 'traveling:traveling') {
    ctx.isTraveling = true
  } else if (!_tag.startsWith('local')) {
    ctx.isRealInstance = true
    var sep = _tag.indexOf(':')
    // technically not part of instance id, but might be there when coping id from url so why not support it
    var shortNameQualifier = '&shortName='
    var shortNameIndex = _tag.indexOf(shortNameQualifier)
    if (shortNameIndex >= 0) {
      ctx.shortName = _tag.substr(
        shortNameIndex + shortNameQualifier.length
      )
      _tag = _tag.substr(0, shortNameIndex)
    }
    if (sep >= 0) {
      ctx.worldId = _tag.substr(0, sep)
      ctx.instanceId = _tag.substr(sep + 1)
      ctx.instanceId.split('~').forEach((s, i) => {
        if (i) {
          var A = s.indexOf('(')
          var Z = A >= 0 ? s.lastIndexOf(')') : -1
          var key = Z >= 0 ? s.substr(0, A) : s
          var value = A < Z ? s.substr(A + 1, Z - A - 1) : ''
          if (key === 'hidden') {
            ctx.hiddenId = value
          } else if (key === 'private') {
            ctx.privateId = value
          } else if (key === 'friends') {
            ctx.friendsId = value
          } else if (key === 'canRequestInvite') {
            ctx.canRequestInvite = true
          } else if (key === 'region') {
            ctx.region = value
          } else if (key === 'group') {
            ctx.groupId = value
          } else if (key === 'groupAccessType') {
            ctx.groupAccessType = value
          } else if (key === 'strict') {
            ctx.strict = true
          } else if (key === 'ageGate') {
            ctx.ageGate = true
          }
        } else {
          ctx.instanceName = s
        }
      })
      ctx.accessType = 'public'
      if (ctx.privateId !== null) {
        if (ctx.canRequestInvite) {
          // InvitePlus
          ctx.accessType = 'invite+'
        } else {
          // InviteOnly
          ctx.accessType = 'invite'
        }
        ctx.userId = ctx.privateId
      } else if (ctx.friendsId !== null) {
        // FriendsOnly
        ctx.accessType = 'friends'
        ctx.userId = ctx.friendsId
      } else if (ctx.hiddenId !== null) {
        // FriendsOfGuests
        ctx.accessType = 'friends+'
        ctx.userId = ctx.hiddenId
      } else if (ctx.groupId !== null) {
        // Group
        ctx.accessType = 'group'
        ctx.groupName = (await getGroup(ctx.groupId)).name
      }
      ctx.accessTypeName = ctx.accessType
      if (ctx.groupAccessType !== null) {
        if (ctx.groupAccessType === 'public') {
          ctx.accessTypeName = 'groupPublic'
        } else if (ctx.groupAccessType === 'plus') {
          ctx.accessTypeName = 'groupPlus'
        }
      }
    } else {
      ctx.worldId = _tag
    }
  }
  return ctx
}


/**
 * @typedef {Object} VRChatGroupMemberLimitedUser
 * @property {string} id - The unique ID of the user (e.g., usr_c1644b5b-3ca4-45b4-97c6-a2a0de70d469).
 * @property {string} displayName - The display name of the user.
 * @property {string|null} thumbnailUrl - The URL to the user's thumbnail image, or null if not set.
 * @property {string} iconUrl - The URL to the user's icon image.
 * @property {string} profilePicOverride - The overridden profile picture URL.
 * @property {string|null} currentAvatarThumbnailImageUrl - The URL to the current avatar thumbnail, or null if not set.
 * @property {string[]} currentAvatarTags - Tags assigned to the user's avatar.
 */

/**
 * @typedef {("inactive"|"member"|"requested"|"invited"|"banned"|"userblocked")} VRChatMembershipStatus
 * Enum for membership status.
 */

/**
 * @typedef {Object} VRChatGroupMember
 * @property {string|null} acceptedByDisplayName - The display name of the user who accepted the membership, or null if not applicable.
 * @property {string|null} acceptedById - The ID of the user who accepted the membership, or null if not applicable.
 * @property {string} id - The unique ID of the group membership.
 * @property {string} groupId - The unique ID of the group.
 * @property {string} userId - The unique ID of the user.
 * @property {boolean} isRepresenting - Whether the user is representing the group in VRChat (displays the group above the name tag).
 * @property {VRChatGroupMemberLimitedUser} user - The limited user information.
 * @property {string[]} roleIds - The list of role IDs assigned to the user.
 * @property {string[]} mRoleIds - The list of member role IDs assigned to the user.
 * @property {string|null} joinedAt - The timestamp when the user joined (ISO 8601 format) or null if not set.
 * @property {VRChatMembershipStatus} membershipStatus - The status of the membership.
 * @property {string} visibility - The visibility of the user's membership.
 * @property {boolean} isSubscribedToAnnouncements - Whether the user is subscribed to group announcements (default: false).
 * @property {string|null} createdAt - The timestamp when the membership was created (ISO 8601 format) or null if not set.
 * @property {string|null} bannedAt - The timestamp when the user was banned (ISO 8601 format) or null if not set.
 * @property {string|null} managerNotes - Any manager notes related to the user (only available via the /groups/:groupId/members endpoint).
 * @property {string|null} lastPostReadAt - The timestamp of the last read post by the user (ISO 8601 format) or null if not set.
 * @property {boolean} hasJoinedFromPurchase - Whether the user joined the group via purchase.
 */

/**
 * Joins a VRChat group using the specified group ID.
 * 
 * @async
 * @param {string} groupId - The unique ID of the VRChat group to join.
 * @returns {Promise<VRChatGroupMember>} - A promise that resolves to the VRChat group member details after joining.
 * @throws {Error} - If the API request fails.
 */
export async function joinGroup(groupId) {
  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/groups/${groupId}/join`, {
    headers: {
      "User-Agent": process.env["USERAGENT"],
      "Cookie": process.env["VRCHAT_TOKEN"]
    },
    method: "POST"
  }, 9) // Very high priority

  let data = await response.json()

  // Check request status
  switch (response.status) {
    case 200: // Ok
    case 400: // ALready member
    case 403: // Already requested to join
    case 409: // Blocked group by user
      break
    case 401:
      await testSession()
      data = await joinGroup(groupId)
      break
    case 404:
      throw new Error(`Group not found: ${groupId}`)
    default:
      throw new Error(`joinGroup(${groupId}) failed with status ${response.status}`)
  }

  return data
}


/**
 * Checks if the given set of permissions includes the necessary and optional permissions.
 *
 * @param {string[]} grantedPermissions - An array of granted permissions.
 * @param {string[]} [necessaryPermissions=[]] - An array of required permissions that must be granted.
 * @param {string[]} [optionalPermissions=[]] - An array of optional permissions that are nice to have but not required.
 * @returns {{ missingNecessary: string[], missingOptional: string[] }} An object containing arrays of missing necessary and optional permissions.
 */
export function permCheck(grantedPermissions, necessaryPermissions = [], optionalPermissions = []) {
  // If the user has wildcard permission, grant all
  if (grantedPermissions.includes("*")) {
      return { missingNecessary: [], missingOptional: [] } // No missing permissions
  }

  // Convert granted permissions to a Set for faster lookups
  const grantedPermissionsSet = new Set(grantedPermissions)

  // Determine missing permissions
  const missingNecessary = necessaryPermissions.filter(perm => !grantedPermissionsSet.has(perm))
  const missingOptional = optionalPermissions.filter(perm => !grantedPermissionsSet.has(perm))

  return { missingNecessary, missingOptional }
}


/**
 * A mapping of permission keys to their human-readable descriptions.
 *
 * This object is used to associate internal permission identifiers with user-friendly labels.
 *
 * @constant
 * @type {Object.<string, string>}
 */
export const permNames = {
  "group-members-manage": "Manage Group Member Data", // Allows role to view, filter by role, and sort all members and edit data about them.
  "group-data-manage": "Manage Group Data", // Allows role to edit group details (name, description, joinState, etc).
  "group-audit-view": "View Audit log", // Allows role to view the full group audit log.
  "group-roles-manage": "Manage Group Roles", // Allows role to create roles, modify roles, and delete roles.
  "group-default-role-manage": "Manage Group Default Role", // Allows role to manage the permissions for the default role (aka Everyone role). Requires “Manage Group Roles”.
  "group-roles-assign": "Assign Group Roles", // Allows role to assign/unassign roles to users. Requires “Manage Group Member Data”.
  "group-bans-manage": "Manage Group Bans", // Allows role to ban/unban users and view all banned users. Requires “Manage Group Member Data”.
  "group-members-remove": "Remove Group Members", // Allows role to remove someone from the group. Requires “Manage Group Member Data”.
  "group-members-viewall": "View All Members", // Allows role to view all members in a group, not just friends.
  "group-announcement-manage": "Manage Group Announcement", // Allows role to set/clear group announcement and send it as a notification.
  "group-galleries-manage": "Manage Group Galleries", // Allows role to create, reorder, edit, and delete group galleries. Can always submit to galleries, and can approve images.
  "group-invites-manage": "Manage Group Invites", // Allows role to create/cancel invites, as well as accept/decline/block join requests.
  "group-instance-moderate": "Moderate Group Instances", // Allows role to moderate within a group instance.
  "group-instance-manage": "Manage Group Instances", // Allows role to close a group instance.
  "group-instance-queue-priority": "Group Instance Queue Priority", // Gives role priority for group instance queues.
  "group-instance-age-gated-create": "Create Age Gated Instances", // Allows role to create group instances that require users to have age verified and be 18 or above in order to join.
  "group-instance-public-create": "Create Group Public Instances", // Allows role to create group instances that are open to all, member or not. NOTE: Private groups cannot create public instances.
  "group-instance-plus-create": "Create Group+ Instances", // Allows role to create group instances that friends of people present can also join.
  "group-instance-restricted-create": "Create Members-Only Group Instances", // Allows role to create members-only instances.
  "group-instance-plus-portal": "Portal to Group+ Instances", // Allows role to open locked portals to Group+ instances. Members, friends of people there, and friends of the portal dropper may enter unless group-banned.
  "group-instance-plus-portal-unlocked": "Unlocked Portal to Group+ Instances", // Allows role to open unlocked portals to Group+ instances. Everyone except group-banned people may enter. Requires “Portal to Group+ Instances”.
  "group-instance-join": "Join Group Instances", // Allows role to join group instances.
  "group-instance-open-create": "Create Members-Only Group Instances" // Allows role to create members-only instances.
}


/**
 * Checks if the bot has the necessary permissions in a guild and returns missing ones.
 * @param {import('discord.js').Guild} guild - The Discord guild (server)
 * @returns {string[]} - Returns an array of missing permissions (empty if none are missing)
 */
export const botHasPermissions = async (guild) => {
  const botMember = await guild.members.fetchMe();

  const requiredPermissions = [
      PermissionsBitField.Flags.ManageChannels,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.SendMessagesInThreads,
      PermissionsBitField.Flags.CreatePublicThreads,
      PermissionsBitField.Flags.ManageThreads,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.ManageMessages,
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.ReadMessageHistory
  ];

  const missingPermissions = requiredPermissions.filter(
      (perm) => !botMember.permissions.has(perm)
  );

  if (missingPermissions.length > 0) {
      logWarn(`[Discord]: Bot is missing permissions in guild ${guild.id} - "${guild.name}": ${missingPermissions.map(perm => PermissionsBitField.Flags[perm] || perm).join(', ')}`);
  }

  return missingPermissions;
};


/**
 * Creates a category in the specified guild.
 * @param {import('discord.js').Guild} guild - The Discord guild (server)
 * @param {string} categoryName - The name of the category (default: "VRC Management")
 * @returns {Promise<import('discord.js').CategoryChannel>} - The created category
 */
export async function createCategory(guild, categoryName = "VRC Management") {
  logDebug(`[Discord]: ${guild.id} Creating category: ${categoryName}`);

    const category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id, // Default server role (everyone)
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: guild.client.user.id, // Bot user ID
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ManageMessages,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.CreatePublicThreads,
            PermissionsBitField.Flags.SendMessagesInThreads,
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.EmbedLinks,
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageThreads
          ]
        }
      ]
    });
    return category;
}


/**
 * Creates forum and text channels under a category and fetches tag IDs.
 * @param {import('discord.js').Guild} guild - The Discord guild (server)
 * @param {import('discord.js').CategoryChannel} category - The category to attach channels to
 * @returns {Promise<Object>} - Returns an object with channel names, their IDs, and tag IDs
 */
export const createChannels = async (guild, category) => {
  const channels = [
    { 
      name: "vrc-bans",
      type: ChannelType.GuildForum,
      tags: ["CRASHER/CLIENT", "TOXIC BEHAVIOUR", "NSFW", "UNDERAGE", "TROLL", "PEDO", "RACISM/HATE", "OTHER", "BANNED", "UNBANNED"]
    },
    { 
      name: "vrc-kicks",
      type: ChannelType.GuildForum,
      tags: ["CRASHER/CLIENT", "TOXIC BEHAVIOUR", "NSFW", "UNDERAGE", "TROLL", "PEDO", "RACISM/HATE", "OTHER"]
    },
    { 
      name: "vrc-warn",
      type: ChannelType.GuildForum,
      tags: ["CRASHER/CLIENT", "TOXIC BEHAVIOUR", "NSFW", "UNDERAGE", "TROLL", "PEDO", "RACISM/HATE", "OTHER"]
    },
    { 
      name: "vrc-archive",
      type: ChannelType.GuildText
    },
    { 
      name: "vrc-join-leave",
      type: ChannelType.GuildForum,
      tags: ["JOIN", "LEAVE", "REMOVED", "REQUESTED", "REJECTED"]
    }
  ];

  const createdChannels = {}; // Store channel names, IDs, and their tags

  for (const { name, type, tags } of channels) {
    const options = {
      name,
      type,
      parent: category.id,
      permissionOverwrites: category.permissionOverwrites.cache
    };

    // Add forum tags if it's a forum channel
    if (type === ChannelType.GuildForum && tags) {
      options.availableTags = tags.map(tag => ({
        name: tag,
        emoji: null,
        moderated: false // Set to true if only admins should set tags
      }));
    }

    // Create the channel
    const channel = await guild.channels.create(options);

    // Initialize the object for this channel if it's a forum channel
    const channelData = { 
      id: channel.id,
      tags: {} 
    };

    // If the channel is a forum, fetch the tags and their IDs
    if (type === ChannelType.GuildForum && tags) {
      const fetchedTags = channel.availableTags || []

      // Map the tag name to its ID
      tags.forEach(tag => {
        const tagObj = fetchedTags.find(t => t.name === tag);
        if (tagObj) {
          channelData.tags[tag] = tagObj.id; // Store tag name and its ID
        }
      });
    }

    // Store the channel data (ID and tag IDs) for the current channel
    createdChannels[name] = channelData;

    logDebug(`[Discord]: ${guild.id} Created ${type === ChannelType.GuildForum ? "forum" : "text"} channel: ${name}`);
  }

  // Return an object with channel names, their IDs, and tags (with tag IDs)
  return createdChannels;
};



/**
 * Retrieves the audit log for a specific VRChat group.
 * Handles pagination with `amount` and `offset`, respects API limits, and retries on unauthorized (401) responses.
 *
 * @async
 * @function getGroupLog
 * @param {string} groupId - The ID of the VRChat group to fetch logs for.
 * @param {number} [amount=60] - The number of log entries to fetch (clamped between 1 and 100).
 * @param {number} [offset=0] - The number of entries to skip (used for pagination).
 * @returns {Promise<Object>} The group audit log data returned from the VRChat API.
 * @throws {Error} If the request fails with an unexpected status code.
 */
async function getGroupLog(groupId, amount = 60, offset = 0) {
  // Ensure amount and offset stay within VRChat API limits
  amount = Math.min(Math.max(amount, 1), 100); // Clamp between 1 and 100
  offset = Math.max(offset, 0); // Ensure non-negative offset

  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/groups/${groupId}/auditLogs?n=${amount}&offset=${offset}`, {
    headers: {
      "User-Agent": process.env["USERAGENT"],
      "Cookie": process.env["VRCHAT_TOKEN"]
    },
    method: "GET"
  }, 7); // High priority

  let data = await response.json();

  // Check request status
  switch (response.status) {
    case 200: // Success
    case 403:
      break;
    case 401:
      await testSession();
      return await getGroupLog(groupId, amount, offset); // Retry with valid session
    case 404: // Group not found
      break;
    default:
      throw new Error(`getGroupLog(${groupId}) failed with status ${response.status}`);
  }

  return data;
}


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
 * Bans a user from a VRChat group.
 *
 * @async
 * @param {string} groupId - The ID of the group.
 * @param {string} userId - The ID of the user to ban.
 * @returns {Promise<Object>} The response data from the VRChat API.
 */
export async function banUser(groupId, userId) {
  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/groups/${groupId}/bans`, {
    headers: {
      "User-Agent": process.env["USERAGENT"],
      "Cookie": process.env["VRCHAT_TOKEN"],
      "Content-Type": "application/json"
    },
    method: "POST",
    body: JSON.stringify({ userId: userId })
  }, 9); // High priority

  let data = await response.json();

  // Check request status
  switch (response.status) {
    case 200:
    case 400:
    case 403:
      break;
    case 401:
      await testSession();
      data = await banUser(groupId, userId);
      break;
  }

  return data;
}


/**
 * Unbans a user from a VRChat group.
 *
 * @async
 * @param {string} groupId - The ID of the group.
 * @param {string} userId - The ID of the user to unban.
 * @returns {Promise<Object>} The response data from the VRChat API.
 */
export async function unbanUser(groupId, userId) {
  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/groups/${groupId}/bans/${userId}`, {
    headers: {
      "User-Agent": process.env["USERAGENT"],
      "Cookie": process.env["VRCHAT_TOKEN"],
      "Content-Type": "application/json"
    },
    method: "DELETE",
  }, 9); // High priority

  let data = await response.json();

  // Check request status
  switch (response.status) {
    case 200:
    case 400:
    case 403:
      break;
    case 401:
      await testSession();
      data = await unbanUser(groupId, userId);
      break;
  }

  return data;
}


/**
 * Kicks a user from a VRChat group.
 *
 * @async
 * @param {string} groupId - The ID of the group.
 * @param {string} userId - The ID of the user to kick.
 * @returns {Promise<Object>} The response data from the VRChat API.
 */
export async function kickUser(groupId, userId) {
  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/groups/${groupId}/members/${userId}`, {
    headers: {
      "User-Agent": process.env["USERAGENT"],
      "Cookie": process.env["VRCHAT_TOKEN"],
      "Content-Type": "application/json"
    },
    method: "DELETE",
  }, 9); // High priority

  let data = await response.json();

  // Check request status
  switch (response.status) {
    case 200:
    case 400:
    case 403:
      break;
    case 401:
      await testSession();
      data = await kickUser(groupId, userId);
      break;
  }

  return data;
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
 * Retrieves the current VRChat user data, either from cache or via an API call.
 * If the data is not in cache or `useCache` is false, it fetches fresh data from the VRChat API.
 * Automatically retries on unauthorized (401) response by testing the session and refetching.
 *
 * @async
 * @function getCurrentUser
 * @param {boolean} [useCache=true] - Whether to use cached data if available.
 * @returns {Promise<Object>} The current user data from VRChat.
 */
export async function getCurrentUser(useCache = true) {
  // Check cache
  const cachedData = await getCache('currentUser')
  if (cachedData && useCache) {
    logDebug(`[Cache]: Returning cached data for currentUser`)
    return cachedData
  }

  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/auth/user`, {
    headers: {
      "User-Agent": process.env["USERAGENT"],
      "Cookie": process.env["VRCHAT_TOKEN"]
    },
    method: "GET"
  }, 9)

  let data = await response.json()

  // Check request status
  switch (response.status) {
    case 200:
      // Store in cache
      await setCache(`currentUser`, data)
      break
    case 401:
      await testSession()
      data = await getCurrentUser(useCache)
      break
  }

  return data
}


/**
 * Responds to a a join request for a VRChat group.
 *
 * @async
 * @param {string} groupId - The ID of the group.
 * @param {string} userId - The ID of the user to target.
 * @param {boolean} [action=false] - true = accept, false = reject
 * @param {boolean} [block=false] - true = block the user from sending more requests, false = nothing
 * @returns {Promise<Object>} The response data from the VRChat API.
 */
export async function respondJoinRequest(groupId, userId, action = false, block = false) {
  if (action) {
    action = 'accept'
  } else {
    action = 'reject'
  }
  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/groups/${groupId}/requests/${userId}`, {
    headers: {
      "User-Agent": process.env["USERAGENT"],
      "Cookie": process.env["VRCHAT_TOKEN"],
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action: action, block: block}),
    method: "PUT",
  }, 9); // High priority

  let data = await response.json();

  // Check request status
  switch (response.status) {
    case 200:
    case 400:
    case 403:
      break;
    case 401:
      await testSession();
      data = await respondJoinRequest(groupId, userId, action = false, block = false);
      break;
  }

  return data;
}


// /**
//  * Fetches the manager note for a specific user in a VRChat group.
//  *
//  * @async
//  * @function getGroupNote
//  * @param {string} userId - The ID of the user whose group note is to be fetched.
//  * @param {boolean} [cache=true] - Whether to use cached data (currently unused in logic).
//  * @returns {Promise<Object>} The response data containing the user's group information.
//  *
//  * @throws {Error} Re-throws the error from `vrchatFetch` if the request fails.
//  * Automatically attempts to refresh session on 401 (unauthorized) response.
//  */
// export async function getGroupNote(userId, cache = true) {
//   // Fetch new data from API
//   const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/groups/${groupId}/members/${userId}`, {
//     headers: {
//       "User-Agent": process.env["USERAGENT"],
//       "Cookie": process.env["VRCHAT_TOKEN"],
//     },
//     method: "GET",
//   }, 9); // High priority

//   let data = await response.json();

//   // Check request status
//   switch (response.status) {
//     case 200:
//     case 400:
//     case 403:
//       break;
//     case 401:
//       await testSession();
//       data = await getGroupNote(userId);
//       break;
//   }

//   return data;
// }

// /**
//  * Sets or updates the manager note for a specific user in a VRChat group.
//  *
//  * @async
//  * @function setGroupNote
//  * @param {string} userId - The ID of the user whose group note is to be updated.
//  * @param {string} note - The note to set for the user.
//  * @returns {Promise<Object>} The response data after updating the user's note.
//  *
//  * @throws {Error} Re-throws the error from `vrchatFetch` if the request fails.
//  * Automatically attempts to refresh session on 401 (unauthorized) response.
//  */
// export async function setGroupNote(userId, note) {
//   // Fetch new data from API
//   const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/groups/${groupId}/members/${userId}`, {
//     headers: {
//       "User-Agent": process.env["USERAGENT"],
//       "Cookie": process.env["VRCHAT_TOKEN"],
//       "Content-Type": "application/json"
//     },
//     body: JSON.stringify({ managerNotes: note}),
//     method: "PUT",
//   }, 9); // High priority

//   let data = await response.json();

//   // Check request status
//   switch (response.status) {
//     case 200:
//     case 400:
//     case 403:
//       break;
//     case 401:
//       await testSession();
//       data = await setGroupNote(userId, note);
//       break;
//   }

//   return data;
// }


// Predefined list of animal emojis
const animalEmojis = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🐻', '🐼', '🐨', '🐯', '🦁',
  '🐮', '🐷', '🐸', '🦓', '🦒', '🐴', '🐍', '🦔', '🦦', '🐢',
  '🐥', '🐦', '🦉', '🦋', '🐋', '🐙'
];
/**
 * Assigns a random animal emoji to a group based on its groupId.
 * Ensures no collisions of the same emoji for different groups.
 * 
 * @param {string} groupId - The groupId to associate an emoji with (e.g., grp_3f579901-b1a3-4a7b-bf67-db07c7287735).
 * @returns {string} The assigned animal emoji.
 */
export function getGroupEmoji(groupId) {
  // Using a Map to keep track of assigned emojis
  const emojiMap = new Map();

  // Generate a pseudo-random index based on groupId to ensure it's repeatable and deterministic
  const hash = Array.from(groupId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % animalEmojis.length;  // Ensures we always pick from available emojis

  let assignedEmoji = animalEmojis[index];

  // Check if the emoji is already taken (this will try a different one if collision happens)
  // Optional: you can keep this simple or improve it further with more logic
  if (emojiMap.has(assignedEmoji)) {
    // Simple collision fallback: pick a random emoji from the list
    const randomIndex = Math.floor(Math.random() * animalEmojis.length);
    assignedEmoji = animalEmojis[randomIndex];
  }

  // Store the assigned emoji in the map for future references
  emojiMap.set(groupId, assignedEmoji);

  return assignedEmoji;
}


/**
 * Fetches detailed data for a specific avatar from the VRChat API using the given avatar ID.
 *
 * This function sends a GET request to `https://api.vrchat.cloud/api/1/avatars/{avatarId}`,
 * retrieving full metadata about an avatar including author, URLs, tags, and Unity packages.
 * If the request returns a 401 status code, it attempts to refresh or validate the session via `testSession()`.
 *
 * @async
 * @function getAvatar
 * @param {string} avatarId - The unique identifier of the avatar (e.g., `avtr_123456789abcdef`).
 * @returns {Promise<Object>} Resolves to an object containing avatar metadata with the following fields:
 *
 * @property {string} assetUrl - URL to the avatar asset bundle.
 * @property {Object} assetUrlObject - Deprecated. Empty object; use `assetUrl` instead.
 * @property {string} authorId - ID of the avatar's creator (user ID).
 * @property {string} authorName - Display name of the avatar's creator.
 * @property {string} created_at - ISO 8601 timestamp of avatar creation.
 * @property {string} description - Description of the avatar.
 * @property {boolean} featured - Whether the avatar is featured.
 * @property {string} id - Unique avatar ID.
 * @property {string} imageUrl - URL to the avatar's main image.
 * @property {string} name - Name of the avatar.
 * @property {"public"|"private"|"hidden"|"all"} releaseStatus - Visibility status of the avatar.
 * @property {Object} styles - Style metadata.
 * @property {string|null} styles.primary
 * @property {string|null} styles.secondary
 * @property {string[]} styles.supplementary
 * @property {string[]} tags - Array of system/admin/author/language tags associated with the avatar.
 * @property {string} thumbnailImageUrl - URL to the thumbnail image of the avatar.
 * @property {string} unityPackageUrl - URL to the Unity package for this avatar.
 * @property {Object} unityPackageUrlObject - Deprecated. Empty object; use `unityPackageUrl` instead.
 * @property {Object[]} unityPackages - Array of Unity package versions for different platforms.
 * @property {string} unityPackages[].id - Unity package ID.
 * @property {string|null} unityPackages[].assetUrl - URL to asset bundle (can be null).
 * @property {Object} unityPackages[].assetUrlObject - Deprecated. Empty object.
 * @property {number} unityPackages[].assetVersion - Version number of the asset.
 * @property {string} unityPackages[].created_at - Timestamp of the package creation.
 * @property {string} unityPackages[].impostorizerVersion
 * @property {"None"|"Excellent"|"Good"|"Medium"|"Poor"|"VeryPoor"} unityPackages[].performanceRating
 * @property {string} unityPackages[].platform - Target platform (e.g., android, standalonewindows).
 * @property {string} unityPackages[].pluginUrl
 * @property {Object} unityPackages[].pluginUrlObject - Deprecated. Empty object.
 * @property {number} unityPackages[].unitySortNumber
 * @property {string} unityPackages[].unityVersion - Unity version string.
 * @property {string|null} unityPackages[].worldSignature
 * @property {string|null} unityPackages[].impostorUrl
 * @property {string} unityPackages[].scanStatus
 * @property {string} unityPackages[].variant
 * @property {string} updated_at - ISO 8601 timestamp of last update.
 * @property {number} version - Version number of the avatar.
 *
 * @throws {Error} If the fetch request fails or the response cannot be parsed as JSON.
 */

export async function getAvatar(avatarId) {
  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/avatars/${avatarId}`, {
    headers: {
      "User-Agent": process.env["USERAGENT"],
      "Cookie": process.env["VRCHAT_TOKEN"]
    },
    method: "GET"
  }, 6)

  let data = await response.json()

  // Check request status
  switch (response.status) {
    case 200:
      // Store in cache
      break
    case 401:
      await testSession()
      break
  }

  return data
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

  return null;
}


export async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
              entry.id.startsWith("avtr_") ? avatarDb : null;

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

    // Check both DBs
    const inUserDb = await searchInDb(userDb);
    if (inUserDb) return true;

    const inAvatarDb = await searchInDb(avatarDb);
    if (inAvatarDb) return true;

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
