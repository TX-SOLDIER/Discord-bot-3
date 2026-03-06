'use strict';

// ★ SOLDIER² — Ultimate Mod & Rank Authority System ★ \\
//  TX-SOLDIER | Prefix: × \\

// ============================================================
// ☆ SECTION 1 START: IMPORTS & CLIENT SETUP ☆
// ============================================================
//  IMPORTS
// ============================================================
const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    Partials,
} = require('discord.js');
require('dotenv').config();
const express = require('express');
const fs      = require('fs');

// ============================================================
//  DISCORD CLIENT
// ============================================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.GuildMember,
        Partials.User
    ]
});

// ☆ END: IMPORTS & CLIENT SETUP ☆

// ============================================================
// ☆ SECTION 2 START: CONSTANTS & RANKS ☆
// ============================================================
//  CONSTANTS
// ============================================================
const DATA_FILE = './botData.json';
const PREFIX    = '×';
const OWNER_ID  = '782155864134909952';

const SYM_GENERAL  = '★';
const SYM_OFFICER  = '●';
const SYM_ENLISTED = '◆';

const GENERAL_RANKS = [
    '★★★★★ General of the Army',
    '★★★★ General',
    '★★★ Lieutenant General',
    '★★ Major General',
    '★ Brigadier General',
];

const OFFICER_RANKS = [
    '●●●●●● Colonel',
    '●●●●● Lieutenant Colonel',
    '●●●● Major',
    '●●● Captain',
    '●● First Lieutenant',
    '● Second Lieutenant',
];

const ENLISTED_RANKS = [
    '◆◆◆◆◆◆◆◆◆◆ Command Sergeant Major',
    '◆◆◆◆◆◆◆◆◆ Sergeant Major',
    '◆◆◆◆◆◆◆◆ Master Sergeant',
    '◆◆◆◆◆◆◆ Sergeant First Class',
    '◆◆◆◆◆◆ Staff Sergeant',
    '◆◆◆◆◆ Sergeant',
    '◆◆◆◆ Corporal',
    '◆◆◆ Private First Class',
    '◆◆ Private',
];

const CSM_RANK     = '◆◆◆◆◆◆◆◆◆◆ Command Sergeant Major';
const SGM_RANK     = '◆◆◆◆◆◆◆◆◆ Sergeant Major';
const COLONEL_RANK = '●●●●●● Colonel';

// ============================================================
//  GOLD COINS & XP — CONSTANTS
// ============================================================

const GOLD_SYMBOL = '💰';
const XP_SYMBOL = '⭐';
const PRESTIGE_SYMBOL = '👑';

const MAX_LEVEL = 100;
const MAX_PRESTIGE = 10;
const XP_PER_LEVEL = 500;
const XP_COOLDOWN = 10000; // 10 seconds between XP gains
// ==================================================
// GLOBAL MASTER LOG CHANNELS (HARDCODED)
// ==================================================
const MASTER_LOG_CHANNELS = [
    '1355199085631508641',
    'PUT_CHANNEL_ID_2_HERE'
];

// ============================================================
//  SLASH COMMANDS — /
// ============================================================
const slashCommands = [
    new SlashCommandBuilder().setName('hello').setDescription('Say hello to SOLDIER²'),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

// ☆ END: CONSTANTS & RANKS ☆

// ============================================================
// ☆ SECTION 3 START: DATA PERSISTENCE ☆
// ============================================================
//  PERSISTENCE — botData load / save
// ============================================================
let botData = {
    generals:           {},
    officers:           {},
    enlisted:           {},
    warnings:           {},
    modlog:             {},
    notes:              {},
    watchlist:          {},
    flaggedUsers:       {},
    trackedUsers:       {},
    blacklistedUsers:   {},
    blacklistedServers: {},
    automod:            {},
    birthdays:          {},  
    birthdayChannels:   {},  
    birthdayEnabled:    {},  
    birthdayConfig:     {},   
    antiraidSnapshot:   {},
    logChannels:        {},
    qotd:               {},
    mutedRoles:         {},
    verifyRoles:        {},
    reactionRoles:      {},
    staffList:          {},
    dutyStatus:         {},
    autoDeleteTargets:  {},
    counting:           {},
    timedBans:          [],
    timedMutes:         [],
    commandLog:         {},
    disabledCommands:   {},
    serverPrefixes:     {},
    currency:           {},      // { userId: { balance: 1000, lastUpdated: timestamp } }
    xp:                 {},      // { guildId: { userId: { xp, level, prestige } } }
    xpCooldowns:        {},      // { guildId: { userId: timestamp } }
    levelupChannels:    {},      // { guildId: channelId }
    };

let isDirty   = false;
let saveTimer = null;

function loadData() {
        try {
        if (fs.existsSync(DATA_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            botData = { ...botData, ...parsed };
            console.log('✅ Bot data loaded.');
    } else {
            console.log('ℹ️ No data file — starting fresh.');
    }
    } catch (e) { console.error('❌ Load error:', e); }
    }

function markDirty() { isDirty = true; }

function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        if (!isDirty) return;
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2), 'utf8');
            isDirty = false;
            console.log('💾 Saved.');
        } catch (e) { console.error('❌ Save error:', e); }
    }, 2000);
    }

loadData();

// ☆ END: DATA PERSISTENCE ☆

// ============================================================
// ☆SECTION 4 START: HELPER FUNCTIONS & LOGIC ENGINES ☆
// ============================================================
//  UTILITY FUNCTIONS
// ============================================================
function getRankValue(rank) {
    const all = [...GENERAL_RANKS, ...OFFICER_RANKS, ...ENLISTED_RANKS];
    const idx = all.indexOf(rank);
    return idx === -1 ? 9999 : idx;
    }

function parseDuration(str) {
    if (!str) return null;
    const match = str.match(/^(\d+)(s|m|h|d)$/i);
    if (!match) return null;
    const val  = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const map  = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return val * map[unit];
    }

function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60)    return `${s}s`;
    if (s < 3600)  return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
    }

async function resolveUser(client, arg) {
    if (!arg) return null;
    const id = arg.replace(/[<@!>]/g, '');
    return client.users.fetch(id).catch(() => null);
    }

async function resolveMember(guild, arg) {
    if (!arg) return null;
    const id = arg.replace(/[<@!>]/g, '');
    return guild.members.fetch(id).catch(() => null);
    }
// ==================================================
// MASTER LOG ENGINE
// ==================================================
async function sendMasterLog(embed) {
    for (const channelId of MASTER_LOG_CHANNELS) {
        const channel = client.channels.cache.get(channelId);
        if (!channel) continue;

        channel.send({ embeds: [embed] }).catch(() => {});
    }
}

function buildMasterEmbed(title, color, fields) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .addFields(fields)
        .setTimestamp()
        .setFooter({ text: 'Global MasterLog System' });
}
// ── Birthday Helpers ──

function parseBirthday(str) {
    const parts = str.trim().split('/');
    if (parts.length < 2) return null;
    const month = parseInt(parts[0], 10);
    const day   = parseInt(parts[1], 10);
    const year  = parts[2] ? parseInt(parts[2], 10) : null;
    if (isNaN(month) || isNaN(day)) return null;
    if (month < 1 || month > 12)    return null;
    if (day   < 1 || day   > 31)    return null;
    if (year !== null && (isNaN(year) || year < 1900 || year > new Date().getFullYear())) return null;
    return { month, day, year };
}

function formatBirthday(bd) {
    const m = String(bd.month).padStart(2, '0');
    const d = String(bd.day).padStart(2, '0');
    return bd.year ? `${m}/${d}/${bd.year}` : `${m}/${d}`;
}

function buildBirthdayEmbed(client, gid, mentionStr) {
    const cfg   = botData.birthdayConfig?.[gid] || {};
    const color = cfg.color   || 0xFF69B4;
    const msg   = (cfg.message || '🎂 Happy Birthday {user}! Wishing you an amazing day! 🎉')
                    .replace('{user}', mentionStr);

    return new EmbedBuilder()
        .setColor(color)
        .setTitle('🎂 Happy Birthday!')
        .setDescription(msg)
        .setImage('https://media.giphy.com/media/g5R9dok94mrIvplmZd/giphy.gif')
        .setThumbnail('https://media.giphy.com/media/3KC2jD2QcBOSc/giphy.gif')
        .setTimestamp();
}

function scheduleBirthdayCheck() {
    function getMsUntilMidnightCentral() {
        const now      = new Date();
        const ctString = now.toLocaleString('en-US', { timeZone: 'America/Chicago' });
        const ctNow    = new Date(ctString);
        const ctMidnight = new Date(ctNow);
        ctMidnight.setHours(24, 0, 0, 0);
        return ctMidnight - ctNow;
    }

    async function runBirthdayCheck() {
        const now        = new Date();
        const ctStr      = now.toLocaleString('en-US', { timeZone: 'America/Chicago' });
        const ctDate     = new Date(ctStr);
        const todayMonth = ctDate.getMonth() + 1;
        const todayDay   = ctDate.getDate();

        for (const [gid, guildBirthdays] of Object.entries(botData.birthdays || {})) {
            if (botData.birthdayEnabled?.[gid] === false) continue;
            const channelId = botData.birthdayChannels?.[gid];
            if (!channelId) continue;
            const channel = client.channels.cache.get(channelId);
            if (!channel) continue;

            for (const [userId, bd] of Object.entries(guildBirthdays)) {
                if (bd.month === todayMonth && bd.day === todayDay) {
                    const mention = `<@${userId}>`;
                    const embed   = buildBirthdayEmbed(client, gid, mention);
                    await channel.send({ content: mention, embeds: [embed] }).catch(() => {});
                }
            }
        }
        setTimeout(runBirthdayCheck, 24 * 60 * 60 * 1000);
    }

    setTimeout(runBirthdayCheck, getMsUntilMidnightCentral());
}
// ============================================================
//  COUNTING GAME — HELPERS
// ============================================================

function getCountingData(guildId) {
    if (!botData.counting) botData.counting = {};
    if (!botData.counting[guildId]) {
        botData.counting[guildId] = {
            channelId:           null,
            currentNumber:       0,
            highestNumber:       0,
            lastCounter:         null,
            participants:        {},
            doubleCountWarnings: {},
        };
    }
    return botData.counting[guildId];
}

function canSetCountingChannel(guildId, userId) {
    return (
        isFiveStar(userId)     ||
        isGeneral(userId)      ||
        isOfficer(userId)      ||
        isCSM(guildId, userId) ||
        isEnlisted(guildId, userId)
    );
}

function canSetNextCount(userId) {
    return isFiveStar(userId) || isGeneral(userId) || isOfficer(userId);
}

function isCountingExempt(userId) {
    return isFiveStar(userId) || isGeneral(userId);
}

function resetCount(guildId) {
    const cd = getCountingData(guildId);
    cd.currentNumber       = 0;
    cd.lastCounter         = null;
    cd.participants        = {};
    cd.doubleCountWarnings = {};
    markDirty(); scheduleSave();
}

async function handleMilestoneReward(guildId, currentNumber) {
    if (currentNumber % 100 !== 0) return undefined;
    const cd = getCountingData(guildId);
    const participantIds = Object.keys(cd.participants);
    for (const uid of participantIds) {
        addCoins(uid, 100);
    }
    cd.participants = {};
    markDirty(); scheduleSave();
    return participantIds.length;
}
// ============================================================
//  QOTD — QUESTIONS LIST & HELPERS
// ============================================================

const QOTD_QUESTIONS = [
    'If you could have dinner with anyone in history, who would it be and why?',
    'What is one skill you wish you had learned earlier in life?',
    'If you could live in any time period, past or future, which would you choose?',
    'What is the best piece of advice you have ever received?',
    'If you could instantly master any instrument, which would you pick?',
    'What movie or book has had the biggest impact on how you see the world?',
    'If you could wake up tomorrow with one new ability, what would it be?',
];

// ── QOTD placeholder GIF — replace this URL with your own any time ──
const QOTD_GIF = 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif';

function getQotdData(guildId) {
    if (!botData.qotd) botData.qotd = {};
    if (!botData.qotd[guildId]) {
        botData.qotd[guildId] = {
            channelId:    null,
            enabled:      false,
            pingEveryone: false,
            currentIndex: 0,
            nextSendAt:   null,
        };
    }
    return botData.qotd[guildId];
}

function canManageQotd(guildId, userId) {
    return (
        isFiveStar(userId)     ||
        isGeneral(userId)      ||
        isOfficer(userId)      ||
        isCSM(guildId, userId) ||
        isEnlisted(guildId, userId)
    );
}

async function sendQotd(guildId) {
    const qd = getQotdData(guildId);
    if (!qd.channelId || !qd.enabled) return;

    const channel = client.channels.cache.get(qd.channelId);
    if (!channel) return;

    const question = QOTD_QUESTIONS[qd.currentIndex % QOTD_QUESTIONS.length];
    const questionNumber = qd.currentIndex + 1;

    const embed = new EmbedBuilder()
        .setColor(0x24c718)
        .setTitle('❓ Question of the Day')
        .setDescription(`**${question}**`)
        .setThumbnail(QOTD_GIF)
        .setFooter({ text: `Question ${questionNumber} of ${QOTD_QUESTIONS.length} • SOLDIER²` })
        .setTimestamp();

    const content = qd.pingEveryone ? '@everyone' : null;
    await channel.send({ content, embeds: [embed] }).catch(() => {});

    // Advance to next question, loop back when list ends
    qd.currentIndex = (qd.currentIndex + 1) % QOTD_QUESTIONS.length;
    qd.nextSendAt   = Date.now() + 24 * 60 * 60 * 1000;
    markDirty(); scheduleSave();

    // Schedule next question
    scheduleQotd(guildId);
}

// In-memory timer map so we can cancel/reschedule
const qotdTimers = {};

function scheduleQotd(guildId) {
    // Clear any existing timer for this guild
    if (qotdTimers[guildId]) {
        clearTimeout(qotdTimers[guildId]);
        delete qotdTimers[guildId];
    }

    const qd = getQotdData(guildId);
    if (!qd.enabled || !qd.channelId) return;

    const now   = Date.now();
    const delay = Math.max((qd.nextSendAt || now) - now, 1000);

    qotdTimers[guildId] = setTimeout(() => sendQotd(guildId), delay);
}

// Called on bot startup to resume any active QOTD schedules
function resumeAllQotd() {
    if (!botData.qotd) return;
    for (const guildId of Object.keys(botData.qotd)) {
        const qd = botData.qotd[guildId];
        if (qd.enabled && qd.channelId) {
            // If the scheduled time already passed while bot was offline, send immediately
            if (qd.nextSendAt && qd.nextSendAt <= Date.now()) {
                sendQotd(guildId);
            } else {
                scheduleQotd(guildId);
            }
        }
    }
}

// ============================================================
//  GOLD COINS & XP HELPER FUNCTIONS
// ============================================================

// Coin rewards per level achieved
function getCoinRewardForLevel(level) {
    return 50 * level; // 50 coins per level
    }

// ── Currency Getters & Setters ──
function getUserBalance(userId) {
    if (!botData.currency) botData.currency = {};
    if (!botData.currency[userId]) {
        botData.currency[userId] = { balance: 0, lastUpdated: Date.now() };
    }
    return botData.currency[userId].balance || 0;
    }

function setUserBalance(userId, amount) {
    if (!botData.currency) botData.currency = {};
    botData.currency[userId] = { balance: Math.max(0, amount), lastUpdated: Date.now() };
        markDirty(); scheduleSave();
    }

function addCoins(userId, amount) {
    const current = getUserBalance(userId);
    setUserBalance(userId, current + amount);
    }

function removeCoins(userId, amount) {
    const current = getUserBalance(userId);
    if (current < amount) return false;
    setUserBalance(userId, current - amount);
    return true;
    }

// ── XP Getters & Data Functions ──
function getUserXPData(guildId, userId) {
    if (!botData.xp) botData.xp = {};
    if (!botData.xp[guildId]) botData.xp[guildId] = {};
    if (!botData.xp[guildId][userId]) {
        botData.xp[guildId][userId] = { xp: 0, level: 1, prestige: 0 };
    }
    return botData.xp[guildId][userId];
    }

function calculateLevelFromXP(totalXP, prestige) {
    // Calculate level based on prestige count and total XP
    if (prestige < 0 || prestige > MAX_PRESTIGE) prestige = Math.min(Math.max(prestige, 0), MAX_PRESTIGE);
    
    const xpFromPrestige = prestige * (MAX_LEVEL * XP_PER_LEVEL);
    if (totalXP < xpFromPrestige) return 1;
    
    const remainingXP = totalXP - xpFromPrestige;
    const levelGain = Math.floor(remainingXP / XP_PER_LEVEL);
    return Math.min(1 + levelGain, MAX_LEVEL);
    }

function canGainXP(guildId, userId) {
    // Check cooldown for XP gains (10 seconds)
    if (!botData.xpCooldowns) botData.xpCooldowns = {};
    if (!botData.xpCooldowns[guildId]) botData.xpCooldowns[guildId] = {};
    
    const lastGain = botData.xpCooldowns[guildId][userId] || 0;
        const now = Date.now();
    
    if (now - lastGain < XP_COOLDOWN) {
        return false;
    }
    
    botData.xpCooldowns[guildId][userId] = now;
    return true;
    }

function addXP(guildId, userId, amount) {
    if (!botData.xp) botData.xp = {};
    if (!botData.xp[guildId]) botData.xp[guildId] = {};
    
    const data = getUserXPData(guildId, userId);
    const oldLevel = data.level;
    
    data.xp += amount;
    const newLevel = calculateLevelFromXP(data.xp, data.prestige);
    data.level = newLevel;
    
    // Award coins for leveling up
    const levelUpAmount = newLevel - oldLevel;
    if (levelUpAmount > 0) {
        for (let i = oldLevel + 1; i <= newLevel; i++) {
            addCoins(userId, getCoinRewardForLevel(i));
    }
    }
    
        markDirty(); scheduleSave();
    return { levelUp: levelUpAmount > 0, newLevel, oldLevel };
    }

function removeXP(guildId, userId, amount) {
    const data = getUserXPData(guildId, userId);
    data.xp = Math.max(0, data.xp - amount);
    data.level = calculateLevelFromXP(data.xp, data.prestige);
        markDirty(); scheduleSave();
    }

function resetXP(guildId, userId) {
    if (!botData.xp) botData.xp = {};
    if (botData.xp[guildId]) {
        delete botData.xp[guildId][userId];
    }
        markDirty(); scheduleSave();
    }

function prestigeUser(guildId, userId) {
    const data = getUserXPData(guildId, userId);
    
    if (data.prestige >= MAX_PRESTIGE) {
        return { success: false, reason: `Already at max prestige (${MAX_PRESTIGE})` };
    }
    
    if (data.level !== MAX_LEVEL) {
        return { success: false, reason: `Must be level ${MAX_LEVEL}` };
    }
    
    const oldPrestige = data.prestige;
    data.prestige++;
    data.level = 1;
    data.xp = 0;
    
    // Award coins for prestige milestone
    addCoins(userId, 500 * data.prestige);
    
        markDirty(); scheduleSave();
    return { success: true, prestige: data.prestige, oldPrestige };
    }

// ── Leaderboard Functions ──
function getServerLeaderboard(guildId, type = 'coins', limit = 10) {
    const entries = [];
    
    if (type === 'coins') {
        if (!botData.xp?.[guildId]) return [];
        
        for (const [userId, xpData] of Object.entries(botData.xp[guildId])) {
            const balance = getUserBalance(userId);
            if (balance > 0) {
                entries.push({ userId, balance, level: xpData.level, prestige: xpData.prestige });
    }
    }
        entries.sort((a, b) => b.balance - a.balance);
    } else if (type === 'level') {
        if (!botData.xp?.[guildId]) return [];
        
        for (const [userId, xpData] of Object.entries(botData.xp[guildId])) {
                    entries.push({
                        userId,
                level: xpData.level,
                prestige: xpData.prestige,
                        balance: getUserBalance(userId)
});
    }
            entries.sort((a, b) => {
            if (b.prestige !== a.prestige) return b.prestige - a.prestige;
            return b.level - a.level;
});
    }
    
    return entries.slice(0, limit);
    }

function getGlobalLeaderboard(type = 'coins', limit = 10) {
    const entries = [];
    
    if (type === 'coins') {
        for (const [userId, data] of Object.entries(botData.currency || {})) {
            if (data.balance > 0) {
                entries.push({ userId, balance: data.balance });
    }
    }
        entries.sort((a, b) => b.balance - a.balance);
    } else if (type === 'level') {
        for (const [guildId, guildData] of Object.entries(botData.xp || {})) {
            for (const [userId, xpData] of Object.entries(guildData)) {
                const existing = entries.find(e => e.userId === userId);
                if (existing) {
                    existing.totalPrestige = Math.max(existing.totalPrestige, xpData.prestige);
                    existing.maxLevel = Math.max(existing.maxLevel, xpData.level);
    } else {
                    entries.push({
                        userId,
                        totalPrestige: xpData.prestige,
                        maxLevel: xpData.level,
                        balance: getUserBalance(userId)
});
    }
    }
    }
        
        if (type === 'level') {
            entries.sort((a, b) => {
                if (b.totalPrestige !== a.totalPrestige) return b.totalPrestige - a.totalPrestige;
                return b.maxLevel - a.maxLevel;
});
    }
    }
    
    return entries.slice(0, limit);
    }

// ── Permission & Hierarchy Functions ──
function canManageCurrency(actorId, targetId, guildId) {
    // Owner can manage everyone
    if (isFiveStar(actorId)) return { allowed: true };
    
    // Generals can manage everyone except owner
    if (isGeneral(actorId)) {
        if (isFiveStar(targetId)) return { allowed: false, reason: '❌ Cannot manage Owner.' };
            return { allowed: true };
    }
    
    // Officers can manage enlisted and other officers
    if (isOfficer(actorId)) {
        if (isFiveStar(targetId) || isGeneral(targetId)) {
            return { allowed: false, reason: '❌ Cannot manage Generals or Owner.' };
    }
            return { allowed: true };
    }
    
    // Enlisted can only manage lower enlisted in same server
    if (isEnlisted(guildId, actorId)) {
        if (isFiveStar(targetId) || isGeneral(targetId) || isOfficer(targetId)) {
            return { allowed: false, reason: '❌ Insufficient rank.' };
    }
        if (isCSM(guildId, actorId)) {
            return { allowed: true };
    }
        return { allowed: false, reason: '❌ Only CSM can manage currency in this server.' };
    }
    
    return { allowed: false, reason: '❌ You need a rank to manage currency.' };
    }

function isGlobalXPUser(uid) {
    // Only Owner, Generals, and Officers get global XP
    return isFiveStar(uid) || isGeneral(uid) || isOfficer(uid);
    }

// ============================================================
//  DATA FUNCTIONS — Getters, Setters, Removers
// ============================================================

// ── Getters ──
function getGeneralRank(uid)       { return botData.generals?.[uid]?.rank || null; }
function getOfficerRank(uid)       { return botData.officers?.[uid]?.rank || null; }
function getEnlistedRank(gid, uid) { return botData.enlisted?.[gid]?.[uid]?.rank || null; }
function getPrefix(gid)            { return botData.serverPrefixes?.[gid] || PREFIX; }

function getHighestRank(gid, uid) {
    if (uid === OWNER_ID) return GENERAL_RANKS[0];
    return getGeneralRank(uid) || getOfficerRank(uid) || getEnlistedRank(gid, uid) || null;
    }

// ── Role checks ──
function isFiveStar(uid)      { return uid === OWNER_ID; }
function isGeneral(uid)       { return isFiveStar(uid) || !!getGeneralRank(uid); }
function isOfficer(uid)       { return !!getOfficerRank(uid); }
function isCSM(gid, uid)      { return getEnlistedRank(gid, uid) === CSM_RANK; }
function isEnlisted(gid, uid) { return !!getEnlistedRank(gid, uid); }
function isStaff(gid, uid)    { return isGeneral(uid) || isOfficer(uid) || isCSM(gid, uid); }

function getCSMOfServer(gid) {
    const e = botData.enlisted?.[gid];
    if (!e) return null;
    for (const [uid, d] of Object.entries(e)) if (d.rank === CSM_RANK) return uid;
    return null;
    }

// ── Setters ──
function setGeneralRank(uid, rank, actor) {
    if (!botData.generals) botData.generals = {};
    botData.generals[uid] = { rank, assignedBy: actor, assignedAt: Date.now() };
        markDirty(); scheduleSave();
    }
function setOfficerRank(uid, rank, actor) {
    if (!botData.officers) botData.officers = {};
    botData.officers[uid] = { rank, assignedBy: actor, assignedAt: Date.now() };
        markDirty(); scheduleSave();
    }
function setEnlistedRank(gid, uid, rank, actor) {
    if (!botData.enlisted) botData.enlisted = {};
    if (!botData.enlisted[gid]) botData.enlisted[gid] = {};
    botData.enlisted[gid][uid] = { rank, assignedBy: actor, assignedAt: Date.now() };
        markDirty(); scheduleSave();
    }

// ── Removers ──
function removeGeneral(uid) {
    if (botData.generals?.[uid]) { delete botData.generals[uid]; markDirty(); scheduleSave(); }
    }
function removeOfficer(uid) {
    if (botData.officers?.[uid]) { delete botData.officers[uid]; markDirty(); scheduleSave(); }
    }
function removeEnlisted(gid, uid) {
    if (botData.enlisted?.[gid]?.[uid]) { delete botData.enlisted[gid][uid]; markDirty(); scheduleSave(); }
    }

// ── Auto-assign CSM ──
async function autoAssignCSM(guild) {
    const gid = guild.id;
    if (getCSMOfServer(gid)) return;
    const hasG = Object.keys(botData.generals || {}).length > 0;
    const hasO = Object.keys(botData.officers || {}).length > 0;
    if (!hasG && !hasO) {
        const owner = await guild.fetchOwner().catch(() => null);
        if (owner && !isFiveStar(owner.id)) {
            setEnlistedRank(gid, owner.id, CSM_RANK, 'AUTO');
            console.log(`🤖 Auto-CSM: ${owner.user.tag} in ${guild.name}`);
    }
    }
    }

// ── Mod case logger ──
function addModCase(gid, type, targetId, reason, actorId) {
    if (!botData.modlog[gid]) botData.modlog[gid] = { cases: [] };
    const id = botData.modlog[gid].cases.length + 1;
    botData.modlog[gid].cases.push({ id, type, userId: targetId, reason: reason || 'No reason provided', by: actorId, at: Date.now() });
        markDirty(); scheduleSave();
    return id;
    }

// ── Command logger ──
function logCommand(gid, uid, tag, command, args) {
    if (!botData.commandLog[gid]) botData.commandLog[gid] = [];
    botData.commandLog[gid].push({ command, by: uid, byTag: tag, args, at: Date.now() });
    if (botData.commandLog[gid].length > 500) botData.commandLog[gid].shift();
        markDirty(); scheduleSave();
    }

// ── Send embed to log channel ──
async function sendLog(client, gid, embed) {
    const cid = botData.logChannels?.[gid];
    if (!cid) return;
    const ch = client.channels.cache.get(cid);
    if (ch) ch.send({ embeds: [embed] }).catch(() => {});
    }

// ============================================================
//  AUTHORITY ENGINE
// ============================================================

// canAct — checks if actor has authority over target
function canAct(actorId, targetId, guildId) {
    if (isFiveStar(actorId))  return { allowed: true,  reason: 'ok' };
    if (isFiveStar(targetId)) return { allowed: false, reason: '❌ Nobody can act on the **5-Star General**.' };

    const aG = getGeneralRank(actorId),  aO = getOfficerRank(actorId),  aE = getEnlistedRank(guildId, actorId);
    const tG = getGeneralRank(targetId), tO = getOfficerRank(targetId), tE = getEnlistedRank(guildId, targetId);

    if (aG) {
        if (tG) return { allowed: false, reason: '❌ Generals cannot act on other **Generals**.' };
        return { allowed: true, reason: 'ok' };
    }
    if (aO) {
        if (tG) return { allowed: false, reason: '❌ Officers cannot act on **Generals**.' };
        if (tO) {
            if (aO === COLONEL_RANK && getRankValue(aO) < getRankValue(tO)) return { allowed: true, reason: 'ok' };
            return { allowed: false, reason: '❌ Only a **Colonel** can act on lower-ranked Officers.' };
    }
        return { allowed: true, reason: 'ok' };
    }
    if (aE) {
        if (tG || tO) return { allowed: false, reason: '❌ Enlisted cannot act on **Generals** or **Officers**.' };
        if (!tE)      return { allowed: false, reason: '❌ Target has no rank in this server.' };
        if (aE === CSM_RANK) {
            if (tE === CSM_RANK) return { allowed: false, reason: '❌ CSM cannot act on another **CSM**.' };
        return { allowed: true, reason: 'ok' };
    }
        if (getRankValue(tE) <= getRankValue(aE)) return { allowed: false, reason: '❌ You can only act on ranks **below** yours.' };
        if (tE === CSM_RANK) return { allowed: false, reason: '❌ Only Officers or Generals can act on the **CSM**.' };
        return { allowed: true, reason: 'ok' };
    }
    return { allowed: false, reason: '❌ You have no rank and cannot perform this action.' };
    }

// canPromoteTo — checks if actor can assign a specific rank
function canPromoteTo(actorId, targetRank, guildId) {
    if (isFiveStar(actorId)) return { allowed: true, reason: 'ok' };
    const aG = getGeneralRank(actorId), aO = getOfficerRank(actorId), aE = getEnlistedRank(guildId, actorId);
    if (GENERAL_RANKS.includes(targetRank))
        return { allowed: false, reason: '❌ Only the **5-Star General** can assign General ranks.' };
    if (OFFICER_RANKS.includes(targetRank)) {
        if (aG) return { allowed: true, reason: 'ok' };
        return { allowed: false, reason: '❌ Only **Generals** can assign Officer ranks.' };
    }
    if (ENLISTED_RANKS.includes(targetRank)) {
        if (targetRank === CSM_RANK) {
        if (aG || aO) return { allowed: true, reason: 'ok' };
            return { allowed: false, reason: '❌ Only Officers/Generals can assign CSM.' };
    }
        if (aG || aO) return { allowed: true, reason: 'ok' };
        if (aE === CSM_RANK) return { allowed: true, reason: 'ok' };
        if (aE && getRankValue(targetRank) > getRankValue(aE)) return { allowed: true, reason: 'ok' };
        return { allowed: false, reason: '❌ You can only promote to ranks **below** yours.' };
    }
    return { allowed: false, reason: '❌ No permission to assign this rank.' };
    }

// ============================================================
//  REACTION ROLE HELPER FUNCTIONS
// ============================================================

function addReactionRole(guildId, messageId, emoji, roleId) {
    if (!botData.reactionRoles) botData.reactionRoles = {};
    if (!botData.reactionRoles[guildId]) botData.reactionRoles[guildId] = {};
    if (!botData.reactionRoles[guildId][messageId]) botData.reactionRoles[guildId][messageId] = {};
    
    botData.reactionRoles[guildId][messageId][emoji] = roleId;
        markDirty(); scheduleSave();
    }

function getReactionRoles(guildId, messageId) {
    return botData.reactionRoles?.[guildId]?.[messageId] || null;
    }

function deleteReactionRoleMessage(guildId, messageId) {
    if (botData.reactionRoles?.[guildId]?.[messageId]) {
        delete botData.reactionRoles[guildId][messageId];
        markDirty(); scheduleSave();
    }
    }

function getAllReactionRoles(guildId) {
    return botData.reactionRoles?.[guildId] || {};
    }

// ============================================================
//  HELPER FUNCTIONS
// ============================================================

// ── Rank promotion handler ──
async function handlePromote(targetUser, rankInput, guild, actorId, reply) {
    const gid = guild.id;
    if (!rankInput)                return reply('❌ Please specify a rank.');
    if (targetUser.bot)            return reply('❌ Cannot promote bots.');
    if (targetUser.id === actorId) return reply('❌ Cannot promote yourself.');

        const resolved =
            GENERAL_RANKS.find(r => r.toLowerCase() === rankInput.toLowerCase()) ||
            OFFICER_RANKS.find(r => r.toLowerCase() === rankInput.toLowerCase()) ||
            ENLISTED_RANKS.find(r => r.toLowerCase() === rankInput.toLowerCase());

    if (!resolved) return reply(
        `❌ Invalid rank.\n**Generals:** \`${GENERAL_RANKS.join('`, `')}\`\n` +
        `**Officers:** \`${OFFICER_RANKS.join('`, `')}\`\n` +
        `**Enlisted:** \`${ENLISTED_RANKS.join('`, `')}\``
            );

        const p = canPromoteTo(actorId, resolved, gid);
        if (!p.allowed) return reply(p.reason);
    const a = canAct(actorId, targetUser.id, gid);
    if (!a.allowed) return reply(a.reason);

    if (resolved === CSM_RANK) {
        const ex = getCSMOfServer(gid);
        if (ex && ex !== targetUser.id) return reply(`❌ Server already has a CSM (<@${ex}>). Use \`×csmtransfer\`.`);
    }

    let prev     = null;
    const isEnl  = ENLISTED_RANKS.includes(resolved);
    const isOff  = OFFICER_RANKS.includes(resolved);

    if (GENERAL_RANKS.includes(resolved))  { prev = getGeneralRank(targetUser.id);     setGeneralRank(targetUser.id, resolved, actorId); }
    else if (isOff)                         { prev = getOfficerRank(targetUser.id);      setOfficerRank(targetUser.id, resolved, actorId); }
    else                                    { prev = getEnlistedRank(gid, targetUser.id); setEnlistedRank(gid, targetUser.id, resolved, actorId); }

    const embed = new EmbedBuilder().setColor(0x00FF7F).setTitle('🪖 Promotion')
            .addFields(
            { name: '👤 User',         value: `<@${targetUser.id}> (${targetUser.tag})`,          inline: true },
            { name: '🎖️ New Rank',     value: `**${resolved}**`,                                  inline: true },
            { name: '📈 Previous',     value: prev ? `**${prev}**` : '*(none)*',                  inline: true },
            { name: '🔑 Promoted By',  value: `<@${actorId}>`,                                    inline: true },
            { name: '📍 Server',       value: guild.name,                                          inline: true }
        ).setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setTimestamp().setFooter({ text: 'SOLDIER²' });
    await reply({ embeds: [embed] });
    targetUser.send(`🎖️ Promoted to **${resolved}**${isEnl ? ` in **${guild.name}**` : ' (globally)'}!`).catch(() => {});
    }

// ── Rank demotion handler ──
async function handleDemote(targetUser, rankInput, guild, actorId, reply) {
    const gid = guild.id;
    if (targetUser.bot)            return reply('❌ Cannot demote bots.');
    if (targetUser.id === actorId) return reply('❌ Cannot demote yourself.');

    const a = canAct(actorId, targetUser.id, gid);
    if (!a.allowed) return reply(a.reason);

    const curG = getGeneralRank(targetUser.id);
    const curO = getOfficerRank(targetUser.id);
    const curE = getEnlistedRank(gid, targetUser.id);
    const cur  = curG || curO || curE;
    if (!cur) return reply(`❌ <@${targetUser.id}> has no rank.`);

    if (rankInput) {
        const resolved =
            GENERAL_RANKS.find(r => r.toLowerCase() === rankInput.toLowerCase()) ||
            OFFICER_RANKS.find(r => r.toLowerCase() === rankInput.toLowerCase()) ||
            ENLISTED_RANKS.find(r => r.toLowerCase() === rankInput.toLowerCase());
        if (!resolved) return reply('❌ Invalid rank.');
        if (getRankValue(resolved) <= getRankValue(cur)) return reply('❌ New rank must be lower. Use `×promote` to upgrade.');
        const p = canPromoteTo(actorId, resolved, gid);
        if (!p.allowed) return reply(p.reason);
        if (GENERAL_RANKS.includes(resolved))      setGeneralRank(targetUser.id, resolved, actorId);
        else if (OFFICER_RANKS.includes(resolved)) setOfficerRank(targetUser.id, resolved, actorId);
        else                                       setEnlistedRank(gid, targetUser.id, resolved, actorId);

        const embed = new EmbedBuilder().setColor(0xFF4500).setTitle('📉 Demotion')
            .addFields(
                { name: '👤 User',        value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                { name: '🎖️ New Rank',    value: `**${resolved}**`,                        inline: true },
                { name: '📉 Was',         value: `**${cur}**`,                              inline: true },
                { name: '🔑 Demoted By',  value: `<@${actorId}>`,                          inline: true }
        ).setTimestamp().setFooter({ text: 'SOLDIER²' });
    await reply({ embeds: [embed] });
        targetUser.send(`📉 Demoted to **${resolved}**.`).catch(() => {});
    } else {
        if (curG)      removeGeneral(targetUser.id);
        else if (curO) removeOfficer(targetUser.id);
        else           removeEnlisted(gid, targetUser.id);

        const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('❌ Rank Removed')
            .addFields(
                { name: '👤 User',         value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                { name: '����️ Rank Removed', value: `**${cur}**`,                              inline: true },
                { name: '🔑 Action By',    value: `<@${actorId}>`,                           inline: true }
        ).setTimestamp().setFooter({ text: 'SOLDIER²' });
    await reply({ embeds: [embed] });
        targetUser.send(`❌ Rank **${cur}** removed.`).catch(() => {});
    }
    }

// ── CSM transfer handler ──
async function handleCSMTransfer(targetUser, guild, actorId, reply) {
    const gid = guild.id;
    if (targetUser.bot)            return reply('❌ Cannot transfer CSM to a bot.');
    if (targetUser.id === actorId) return reply('❌ You are already the CSM.');
    if (!isCSM(gid, actorId) && !isGeneral(actorId) && !isOfficer(actorId))
        return reply('❌ Only CSM, Generals, Officers, or 5-Star can transfer CSM.');

    const curCSM = getCSMOfServer(gid);
    if (curCSM && curCSM !== targetUser.id) {
        setEnlistedRank(gid, curCSM, SGM_RANK, actorId);
        const old = await client.users.fetch(curCSM).catch(() => null);
        if (old) old.send(`📉 Your CSM rank in **${guild.name}** was transferred. You are now Sergeant Major.`).catch(() => {});
    }
    setEnlistedRank(gid, targetUser.id, CSM_RANK, actorId);

    const embed = new EmbedBuilder().setColor(0xFFD700).setTitle('👑 CSM Transfer')
            .addFields(
            { name: '👑 New CSM',        value: `<@${targetUser.id}> (${targetUser.tag})`,                inline: true },
            { name: '📉 Old CSM',        value: curCSM ? `<@${curCSM}> *(now SGM)*` : '*(none)*',        inline: true },
            { name: '🔑 Transferred By', value: `<@${actorId}>`,                                         inline: false },
            { name: '📍 Server',         value: guild.name,                                               inline: false }
        ).setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setTimestamp().setFooter({ text: 'SOLDIER²' });
    await reply({ embeds: [embed] });
    targetUser.send(`👑 Appointed **Command Sergeant Major** of **${guild.name}**!`).catch(() => {});
    }

// ============================================================
//  EMBED BUILDERS
// ============================================================

// ── Global rank list embed ──
function buildGlobalRankEmbed() {
    const gL = Object.entries(botData.generals || {}).map(([id, d]) => `• <@${id}> — **${d.rank}**`);
    const oL = Object.entries(botData.officers || {}).map(([id, d]) => `• <@${id}> — **${d.rank}**`);
    return new EmbedBuilder().setColor(0xFFD700).setTitle('🌐 Global Rank List')
            .addFields(
            { name: `${SYM_GENERAL} Generals (${gL.length})`, value: gL.length ? gL.join('\n') : '*(none)*', inline: false },
            { name: `${SYM_OFFICER} Officers (${oL.length})`,  value: oL.length ? oL.join('\n') : '*(none)*', inline: false }
        ).setTimestamp().setFooter({ text: 'SOLDIER²' });
    }

// ── Server rank list embed ──
function buildServerRankEmbed(gid, gname) {
    const e      = botData.enlisted?.[gid] || {};
    const sorted = Object.entries(e).sort(([, a], [, b]) => getRankValue(a.rank) - getRankValue(b.rank));
    const lines  = sorted.map(([id, d]) => `• <@${id}> — **${d.rank}**${d.rank === CSM_RANK ? ' 👑' : ''}`);
    return new EmbedBuilder().setColor(0x1E90FF).setTitle(`${SYM_ENLISTED} Server Ranks — ${gname}`)
        .setDescription(lines.length ? lines.join('\n') : '*(none)*')
        .setTimestamp().setFooter({ text: `SOLDIER² — ${sorted.length} enlisted` });
    }

// ☆ END: HELPER FUNCTIONS & LOGIC ENGINES ☆

// ============================================================
// ☆SECTION 5 START: CORE EVENT LISTENERS ☆
// ============================================================
//  KEEP-ALIVE SERVER — Render / UptimeRobot
// ============================================================
const app = express();
app.get('/', (req, res) => res.send('SOLDIER² is alive! ★'));
app.listen(10000, () => console.log('✅ Keep-alive on port 10000'));

// ============================================================
//  READY EVENT
// ============================================================
client.once('clientReady', async () => {
    scheduleBirthdayCheck();
    resumeAllQotd();
    console.log(`✅ Logged in as ${client.user.tag}`);
    for (const guild of client.guilds.cache.values()) await autoAssignCSM(guild);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('✅ Slash commands registered.');
    } catch (e) { console.error('❌ Slash error:', e); }

    // ── Timed ban/mute interval — checks every 30 seconds ──
    setInterval(async () => {
        const now = Date.now();
        const activeBans = [];

        for (const entry of botData.timedBans) {
            if (now >= entry.unbanAt) {
                const guild = client.guilds.cache.get(entry.guildId);
                if (guild) await guild.members.unban(entry.userId).catch(() => {});
            } else {
                activeBans.push(entry);
            }
        }

        if (activeBans.length !== botData.timedBans.length) {
            botData.timedBans = activeBans;
            markDirty();
            scheduleSave();
        }

        const activeMutes = [];

        for (const entry of botData.timedMutes) {
            if (now >= entry.unmuteAt) {
                const guild = client.guilds.cache.get(entry.guildId);
                if (guild) {
                    const member = await guild.members.fetch(entry.userId).catch(() => null);
                    if (member) await member.timeout(null).catch(() => {});
                }
            } else {
                activeMutes.push(entry);
            }
        }

        if (activeMutes.length !== botData.timedMutes.length) {
            botData.timedMutes = activeMutes;
            markDirty();
            scheduleSave();
        }

    }, 30000);
});

client.on('guildCreate', async guild => await autoAssignCSM(guild));

// ============================================================
// MESSAGE EDIT — BEFORE & AFTER
// ============================================================
client.on('messageUpdate', async (oldMsg, newMsg) => {

    if (oldMsg.partial) {
        try { await oldMsg.fetch(); } catch { return; }
    }

    if (newMsg.partial) {
        try { await newMsg.fetch(); } catch { return; }
    }

    if (!oldMsg.guild || oldMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;
    // ── Counting — edit detection ──
    {
        const cd = getCountingData(oldMsg.guild.id);
        if (cd.channelId && newMsg.channel?.id === cd.channelId && !newMsg.author?.bot && oldMsg.content !== newMsg.content) {
            const embed = new EmbedBuilder()
                .setColor(0xE67E22)
                .setTitle('✏️ Message Edited in Counting Channel')
                .addFields(
                    { name: 'User',   value: `<@${newMsg.author?.id}>`, inline: true },
                    { name: 'Before', value: `\`${oldMsg.content || '*(unknown)*'}\``, inline: true },
                    { name: 'After',  value: `\`${newMsg.content || '*(unknown)*'}\``, inline: true },
                    { name: '🔢 Next Expected Number', value: `**${cd.currentNumber + 1}**` },
                )
                .setFooter({ text: 'Editing does not reset the count.' })
                .setTimestamp();
            await newMsg.channel.send({ embeds: [embed] }).catch(() => {});
        }
    }

    const embed = buildMasterEmbed(
        '✏️ Message Edited',
        0xF1C40F,
        [
            { name: 'User', value: `<@${oldMsg.author.id}> (${oldMsg.author.id})` },
            { name: 'Server', value: `${oldMsg.guild.name} (${oldMsg.guild.id})` },
            { name: 'Channel', value: `<#${oldMsg.channel.id}> (${oldMsg.channel.id})` },
            { name: 'Before', value: oldMsg.content || '*No text*' },
            { name: 'After', value: newMsg.content || '*No text*' }
        ]
    );

    sendMasterLog(embed);
});

// ============================================================
// Deleted messages and pictures
// ============================================================
client.on('messageDelete', async message => {

    if (message.partial) {
        try {
            await message.fetch();
        } catch {
            return;
        }
    }

    if (!message.guild || message.author?.bot) return;
    // ── Counting — delete detection ──
    {
        const cd = getCountingData(message.guild.id);
        if (cd.channelId && message.channel?.id === cd.channelId && !message.author?.bot) {
            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('🗑️ Message Deleted in Counting Channel')
                .addFields(
                    { name: 'User',    value: `<@${message.author?.id}>`, inline: true },
                    { name: 'Deleted', value: `\`${message.content || '*(unknown)*'}\``, inline: true },
                    { name: '🔢 Next Expected Number', value: `**${cd.currentNumber + 1}**` },
                )
                .setFooter({ text: 'Deleting does not reset the count.' })
                .setTimestamp();
            await message.channel.send({ embeds: [embed] }).catch(() => {});
        }
    }

    let executor = 'Unknown';

    try {
        const logs = await message.guild.fetchAuditLogs({ limit: 1 });
        const entry = logs.entries.first();

        if (entry && entry.target?.id === message.author.id) {
            executor = `<@${entry.executor.id}> (${entry.executor.id})`;
        }
    } catch {}

    const attachments = message.attachments.map(a => a.url);

    const embed = buildMasterEmbed(
        '🗑️ Message Deleted',
        0xE74C3C,
        [
            { name: 'Original Author', value: `<@${message.author.id}> (${message.author.id})` },
            { name: 'Deleted By', value: executor },
            { name: 'Server', value: `${message.guild.name} (${message.guild.id})` },
            { name: 'Channel', value: `<#${message.channel.id}> (${message.channel.id})` },
            { name: 'Content', value: message.content || '*No text*' }
        ]
    );

    if (attachments.length) {
        embed.setImage(attachments[0]);
    }

    sendMasterLog(embed);
});
// ============================================================
//  MESSAGE REACTION ADD — Reaction Roles
// ============================================================
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (!reaction.message.guild) return;
    
    const gid = reaction.message.guild.id;
    const roles = getReactionRoles(gid, reaction.message.id);
    
    if (!roles) return; // Not a reaction role message
    
    const roleId = roles[reaction.emoji.toString()];
    if (!roleId) return; // Emoji not mapped to a role
    
    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return;
    
    const role = reaction.message.guild.roles.cache.get(roleId);
    if (!role) return;
    
        await member.roles.add(role).catch(() => {});
});

// ============================================================
//  MESSAGE REACTION REMOVE — Reaction Roles
// ============================================================
client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (!reaction.message.guild) return;
    
    const gid = reaction.message.guild.id;
    const roles = getReactionRoles(gid, reaction.message.id);
    
    if (!roles) return; // Not a reaction role message
    
    const roleId = roles[reaction.emoji.toString()];
    if (!roleId) return; // Emoji not mapped to a role
    
    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return;
    
    const role = reaction.message.guild.roles.cache.get(roleId);
    if (!role) return;
    
        await member.roles.remove(role).catch(() => {});
});

// ============================================================
//  MESSAGE DELETE — Delete Reaction Role Data
// ============================================================
client.on('messageDelete', (message) => {
    if (!message.guild) return;
    
    const gid = message.guild.id;
    const roles = getReactionRoles(gid, message.id);
    
    if (roles) {
        // This is a reaction role message - delete it permanently
        deleteReactionRoleMessage(gid, message.id);
    }
});
// ── DM Detection — notify owner when someone DMs the bot ──
client.on('messageCreate', async message => {
    if (!message.author.bot && !message.guild) {
        const owner = await client.users.fetch(OWNER_ID).catch(() => null);
        if (!owner) return;

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('📩 Bot Received a DM')
            .addFields(
                { name: '👤 From',    value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
                { name: '🆔 User ID', value: `\`${message.author.id}\``,                         inline: true },
                { name: '💬 Message', value: message.content || '*(no text — possibly an attachment)*', inline: false },
            )
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setTimestamp()
            .setFooter({ text: 'SOLDIER² DM Alert' });

        await owner.send({ embeds: [embed] }).catch(() => {});
    }
});
// ── Guild Join — auto assign CSM + notify owner ──
client.on('guildCreate', async guild => {
    await autoAssignCSM(guild);

    const owner = await client.users.fetch(OWNER_ID).catch(() => null);
    if (!owner) return;

    const guildOwner = await guild.fetchOwner().catch(() => null);

    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('📬 Bot Added to a New Server')
        .addFields(
            { name: '🏠 Server Name',   value: guild.name,                                                          inline: true },
            { name: '🆔 Server ID',     value: `\`${guild.id}\``,                                                   inline: true },
            { name: '👥 Member Count',  value: `${guild.memberCount}`,                                              inline: true },
            { name: '👑 Server Owner',  value: guildOwner ? `${guildOwner.user.tag} (\`${guildOwner.id}\`)` : 'Unknown', inline: true },
            { name: '📅 Server Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,               inline: true },
            { name: '🌐 Total Servers', value: `Bot is now in **${client.guilds.cache.size}** servers`,             inline: false },
        )
        .setThumbnail(guild.iconURL({ dynamic: true }) || null)
        .setTimestamp()
        .setFooter({ text: 'SOLDIER² Server Join Alert' });

    await owner.send({ embeds: [embed] }).catch(() => {});
});

// ☆ END: CORE EVENT LISTENERS ☆

// ============================================================
// ☆SECTION 6 START: MASTER MESSAGE HANDLER ☆
// ============================================================
// ── Track user message watcher ──
// ============================================================
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    const uid = message.author.id;
    if (botData.trackedUsers?.[uid]) {
        const notifyUser = await client.users.fetch(botData.trackedUsers[uid].by).catch(() => null);
        if (notifyUser) notifyUser.send(
            `🔍 **Tracked user alert!**\n**User:** ${message.author.tag} (\`${uid}\`)\n` +
            `**Server:** ${message.guild.name}\n**Channel:** <#${message.channel.id}>\n` +
            `**Message:** ${message.content.slice(0, 200)}`
        ).catch(() => {});
    }
});

// ============================================================
//  MESSAGE CREATE — All Prefix Commands Prefix: ×
// ============================================================
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    const gid    = message.guild.id;
    const uid    = message.author.id;

if (botData.autoDeleteTargets?.[gid]?.[uid]) {

    const attachments = message.attachments.map(a => a.url);

    await message.delete().catch(() => {});

    const embed = buildMasterEmbed(
        '🎯 Target Message Deleted',
        0xFF0000,
        [
            { name: 'Target', value: `<@${uid}> (${uid})` },
            { name: 'Server', value: `${message.guild.name} (${gid})` },
            { name: 'Channel', value: `<#${message.channel.id}> (${message.channel.id})` },
            { name: 'Content', value: message.content || '*No text*' }
        ]
    );

    if (attachments.length) embed.setImage(attachments[0]);

    sendMasterLog(embed);
    sendLog(client, gid, embed);

    return;
}

    const prefix = getPrefix(gid);

    // ── Automod gate ──
    const am = botData.automod?.[gid];
    if (am?.automod !== false) {
        const content = message.content;
        if (am?.antilink && /https?:\/\/|discord\.gg\//i.test(content) && !isStaff(gid, uid) && !isFiveStar(uid)) {
        await message.delete().catch(() => {});
            return message.channel.send(`<@${uid}> ❌ Links are not allowed.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
        if (am?.anticaps && content.length > 10) {
            const caps = (content.match(/[A-Z]/g) || []).length;
            if ((caps / content.replace(/\s/g, '').length) * 100 >= (am.capsPercent || 70)) {
        await message.delete().catch(() => {});
                return message.channel.send(`<@${uid}> ❌ Too many caps.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
    }
        if (am?.antiemoji) {
            const ec = (content.match(/[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{26FF}]/gu) || []).length;
            if (ec > (am.emojiLimit || 10)) {
        await message.delete().catch(() => {});
                return message.channel.send(`<@${uid}> ❌ Too many emojis.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
    }
        if (am?.antimentions && message.mentions.users.size > (am.mentionLimit || 5)) {
        await message.delete().catch(() => {});
            return message.channel.send(`<@${uid}> ❌ Too many mentions.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
        if (am?.badwords?.length && am.badwords.some(w => content.toLowerCase().includes(w.toLowerCase()))) {
        await message.delete().catch(() => {});
            return message.channel.send(`<@${uid}> ❌ Prohibited word detected.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
    }
    // ══════════════════════════════════════════════════
    //  COUNTING CHANNEL INTERCEPT
    // ══════════════════════════════════════════════════
    {
        const cd = getCountingData(gid);
        if (cd.channelId && message.channel.id === cd.channelId) {

            const rawContent    = message.content.trim();
            const serverPrefix  = getPrefix(gid);
            const isCountingCmd = rawContent.startsWith(serverPrefix + 'counting');

            if (!isCountingCmd) {

                // Only plain integers — no "5.", "05", "5 lol", words, decimals, etc.
                const isPlainInteger = /^\d+$/.test(rawContent);

                if (!isPlainInteger) {
                    await message.delete().catch(() => {});
                    const warnEmbed = new EmbedBuilder()
                        .setColor(0xE74C3C)
                        .setTitle('🔢 Numbers Only!')
                        .setDescription(`<@${uid}>, only plain integers are allowed in this channel.`)
                        .addFields({ name: 'Next Expected Number', value: `**${cd.currentNumber + 1}**` })
                        .setTimestamp();
                    const warnMsg = await message.channel.send({ embeds: [warnEmbed] });
                    setTimeout(() => warnMsg.delete().catch(() => {}), 8000);
                    return;
                }

                const posted       = parseInt(rawContent, 10);
                const nextExpected = cd.currentNumber + 1;

                // ── Double-count guard (Owner + Generals are exempt) ──
                if (!isCountingExempt(uid) && cd.lastCounter === uid) {
                    await message.delete().catch(() => {});
                    if (!cd.doubleCountWarnings[uid]) {
                        cd.doubleCountWarnings[uid] = true;
                        markDirty(); scheduleSave();
                        const dcEmbed = new EmbedBuilder()
                            .setColor(0xF39C12)
                            .setTitle('⛔ You Cannot Count Twice in a Row')
                            .setDescription(`<@${uid}>, wait for someone else to count before going again.`)
                            .addFields({ name: 'Next Expected Number', value: `**${nextExpected}**` })
                            .setTimestamp();
                        const dcMsg = await message.channel.send({ embeds: [dcEmbed] });
                        setTimeout(() => dcMsg.delete().catch(() => {}), 8000);
                    }
                    return;
                }

                // ── Wrong number — react ❌ then delete and reset ──
                if (posted !== nextExpected) {
                    await message.react('❌').catch(() => {});
                    await message.delete().catch(() => {});
                    const resetEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('💥 Count Ruined!')
                        .setDescription(
                            `<@${uid}> ruined the count by sending **${posted}** instead of **${nextExpected}**.\n\n` +
                            `The count has been **reset to 0**.`
                        )
                        .addFields(
                            { name: '🔢 Next Expected Number', value: '**1**',                     inline: true },
                            { name: '📊 Count Before Reset',   value: `**${cd.currentNumber}**`,   inline: true },
                        )
                        // ↓ Replace these two GIF URLs with your own any time ↓
                        .setImage('https://media.giphy.com/media/3ohzdYJK1wAdPWVk88/giphy.gif')
                        .setThumbnail('https://media.giphy.com/media/l4FGpPki7jQrHmvSM/giphy.gif')
                        .setTimestamp();
                    await message.channel.send({ embeds: [resetEmbed] });
                    resetCount(gid);
                    return;
                }

                // ── Correct number — react ✅ and process ──
                await message.react('✅').catch(() => {});

                cd.currentNumber     = posted;
                cd.lastCounter       = uid;
                cd.participants[uid] = true;
                delete cd.doubleCountWarnings[uid];
                if (posted > cd.highestNumber) cd.highestNumber = posted;
                markDirty(); scheduleSave();

                // +2 gold per correct count
                addCoins(uid, 2);

                // Milestone bonus every 100 numbers
                const participantCount = await handleMilestoneReward(gid, posted);
                if (participantCount !== undefined) {
                    const milestoneEmbed = new EmbedBuilder()
                        .setColor(0xFFD700)
                        .setTitle('🏆 Milestone Reached!')
                        .setDescription(
                            `The count hit **${posted}**! 🎉\n` +
                            `**${participantCount}** participant(s) each received **+100 ${GOLD_SYMBOL} gold coins!**`
                        )
                        .setTimestamp();
                    await message.channel.send({ embeds: [milestoneEmbed] });
                }

                // Normal XP gain using existing XP engine
                if (canGainXP(gid, uid)) {
                    const xpGain   = Math.floor(Math.random() * 5) + 5;
                    const xpResult = addXP(gid, uid, xpGain);
                    if (xpResult.levelUp) {
                        const lvlCh = botData.levelupChannels?.[gid]
                            ? client.channels.cache.get(botData.levelupChannels[gid])
                            : message.channel;
                        if (lvlCh) {
                            const lvlEmbed = new EmbedBuilder()
                                .setColor(0x2ECC71)
                                .setTitle(`${XP_SYMBOL} Level Up!`)
                                .setDescription(
                                    `<@${uid}> reached **Level ${xpResult.newLevel}**! ` +
                                    `(+${getCoinRewardForLevel(xpResult.newLevel)} ${GOLD_SYMBOL})`
                                )
                                .setTimestamp();
                            lvlCh.send({ embeds: [lvlEmbed] }).catch(() => {});
                        }
                    }
                }

                return; // Message fully handled
            }
        }
    }
    // ══════════════════════════════════════════════════
    //  END COUNTING CHANNEL INTERCEPT
    // ══════════════════════════════════════════════════

    if (!message.content.startsWith(prefix)) return;
    if (botData.blacklistedServers?.[gid])    return;
    if (botData.blacklistedUsers?.[uid])       return;

    const args    = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (botData.disabledCommands?.[gid]?.includes(command))
        return message.reply('❌ This command is disabled in this server.');

    logCommand(gid, uid, message.author.tag, command, args.join(' '));
    sendMasterLog(
    buildMasterEmbed(
        '⚙️ Command Used',
        0x3498DB,
        [
            { name: 'User', value: `<@${message.author.id}> (${message.author.id})` },
            { name: 'Server', value: `${message.guild.name} (${message.guild.id})` },
            { name: 'Channel', value: `<#${message.channel.id}> (${message.channel.id})` },
            { name: 'Command', value: message.content }
        ]
    )
);

    const reply = async content => {
        if (typeof content === 'string') return message.reply(content);
        return message.channel.send(content);
    };

    sendLog(client, gid, new EmbedBuilder().setColor(0x5865F2).setTitle('📋 Command Used')
            .addFields(
            { name: '👤 User',     value: `<@${uid}> (${message.author.tag})`, inline: true },
            { name: '⌨️ Command',  value: `\`${prefix}${command}\``,           inline: true },
            { name: '📝 Args',     value: args.join(' ') || '*(none)*',        inline: true },
            { name: '📍 Channel',  value: `<#${message.channel.id}>`,          inline: true }
        ).setTimestamp()
            );

    // =========================================================
    //  GOLD COINS & XP — Award on message
    // =========================================================
    
    // ── Award XP to global users (Owner, Generals, Officers) ──
    if (isGlobalXPUser(uid)) {
        if (canGainXP('GLOBAL', uid)) {
            const result = addXP('GLOBAL', uid, 5);
            if (result.levelUp) {
                // Announce levelup to all servers for global users
        for (const [, srv] of client.guilds.cache) {
                    const ch = botData.levelupChannels?.[srv.id];
                if (ch) {
                    const chObj = client.channels.cache.get(ch);
                    if (chObj) {
                            const xpData = getUserXPData('GLOBAL', uid);
                            chObj.send(`${PRESTIGE_SYMBOL}✨ <@${uid}> reached **Level ${result.newLevel}**${result.newLevel === MAX_LEVEL && xpData.prestige < MAX_PRESTIGE ? ' — Ready to prestige!' : '!'}`).catch(() => {});
    }
    }
    }
    }
    }
    } else {
        // ── Award XP to per-server users (Enlisted & Regular) ──
        if (canGainXP(gid, uid)) {
            const result = addXP(gid, uid, 5);
            if (result.levelUp) {
                // Announce levelup in this server
                const ch = botData.levelupChannels?.[gid];
                if (ch) {
                    const chObj = client.channels.cache.get(ch);
                    if (chObj) {
                        const xpData = getUserXPData(gid, uid);
                        chObj.send(`${PRESTIGE_SYMBOL}✨ <@${uid}> reached **Level ${result.newLevel}**${result.newLevel === MAX_LEVEL && xpData.prestige < MAX_PRESTIGE ? ' in ' + message.guild.name + ' — Ready to prestige!' : '!'}`)
                            .catch(() => {});
    }
    }
    }
    }
    }


    //=========================================================
    // ★ COMMANDS ★ \\
    // =========================================================
    //  RANK COMMANDS
    // =========================================================

    // --------------------------------------------------
    // ×promote @user <rank>
    // --------------------------------------------------
    if (command === 'promote') {
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×promote @user <rank>`');
        return handlePromote(target, args.slice(1).join(' '), message.guild, uid, reply);
    }

    // --------------------------------------------------
    // ×demote @user [rank]
    // --------------------------------------------------
    if (command === 'demote') {
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×demote @user [rank]`');
        return handleDemote(target, args.slice(1).join(' '), message.guild, uid, reply);
    }

    // --------------------------------------------------
    // ×csmtransfer @user
    // --------------------------------------------------
    if (command === 'csmtransfer') {
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×csmtransfer @user`');
        return handleCSMTransfer(target, message.guild, uid, reply);
    }

    // --------------------------------------------------
    // ×myrank — View your own rank
    // --------------------------------------------------
    if (command === 'myrank') {
        if (isFiveStar(uid)) return reply('★★★★★ You are the **General of the Army** — absolute authority.');
        const rank = getHighestRank(gid, uid);
        if (!rank) return reply('❌ You have no rank. You are a **Civilian**.');
        return reply({ embeds: [new EmbedBuilder().setColor(0x00CED1).setTitle('🎖️ Your Rank')
            .addFields({ name: '🪖 Rank', value: `**${rank}**`, inline: true }, { name: '📍 Server', value: message.guild.name, inline: true })
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true })).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }

    // --------------------------------------------------
    // ×ranks — Full hierarchy (visible to all)
    // --------------------------------------------------
    if (command === 'ranks') {
        return reply({ embeds: [new EmbedBuilder().setColor(0x9B59B6).setTitle('📋 Full Rank Hierarchy — SOLDIER²')
            .addFields(
                { name: `${SYM_GENERAL} Generals (Global)`,     value: GENERAL_RANKS.map((r, i) => `${i + 1}. ${r}`).join('\n') },
                { name: `${SYM_OFFICER} Officers (Global)`,      value: OFFICER_RANKS.map((r, i) => `${i + 1}. ${r}`).join('\n') },
                { name: `${SYM_ENLISTED} Enlisted (Per-Server)`, value: ENLISTED_RANKS.map((r, i) => `${i + 1}. ${r}`).join('\n') }
            ).setTimestamp().setFooter({ text: 'SOLDIER² — ★ General  ● Officer  ◆ Enlisted' })] });
    }

    // --------------------------------------------------
    // ×globalranks — Generals/Officers/5-Star only
    // --------------------------------------------------
    if (command === 'globalranks') {
        if (!isFiveStar(uid) && !isGeneral(uid) && !isOfficer(uid)) return reply('❌ Generals and Officers only.');
        return reply({ embeds: [buildGlobalRankEmbed()] });
    }

    // --------------------------------------------------
    // ×serverranks — Officers/Generals/CSM only
    // --------------------------------------------------
    if (command === 'serverranks') {
        if (!isFiveStar(uid) && !isGeneral(uid) && !isOfficer(uid) && !isCSM(gid, uid)) return reply('❌ Officers, Generals, or CSM only.');
        return reply({ embeds: [buildServerRankEmbed(gid, message.guild.name)] });
    }


    // =========================================================
    //  BASIC MODERATION
    // =========================================================

    // --------------------------------------------------
    // ×kick @user/ID [reason]
    // --------------------------------------------------
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('�� You need **Kick Members** permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×kick @user [reason]`');
        const reason = args.slice(1).join(' ') || 'No reason provided';
        const check  = canAct(uid, target.id, gid);
        if (!check.allowed) return reply(check.reason);
        const member = await resolveMember(message.guild, target.id);
        if (!member) return reply('❌ Member not found.');
        await member.kick(reason).catch(() => {});
        const caseId = addModCase(gid, 'KICK', target.id, reason, uid);
        target.send(`👢 Kicked from **${message.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
        return reply({ embeds: [new EmbedBuilder().setColor(0xFF6600).setTitle('👢 User Kicked')
            .addFields(
                { name: '👤 User',    value: `<@${target.id}> (${target.tag})`, inline: true },
                { name: '📋 Case',   value: `#${caseId}`,                       inline: true },
                { name: '📝 Reason', value: reason,                             inline: false },
                { name: '🔑 By',     value: `<@${uid}>`,                        inline: true }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }

    // --------------------------------------------------
    // ×ban @user/ID [reason]
    // --------------------------------------------------
    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Ban Members** permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×ban @user [reason]`');
        const reason = args.slice(1).join(' ') || 'No reason provided';
        const check  = canAct(uid, target.id, gid);
        if (!check.allowed) return reply(check.reason);
        await message.guild.members.ban(target.id, { reason, deleteMessageSeconds: 604800 }).catch(() => {});
        const caseId = addModCase(gid, 'BAN', target.id, reason, uid);
        target.send(`🔨 Banned from **${message.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
        return reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('🔨 User Banned')
            .addFields(
                { name: '👤 User',    value: `<@${target.id}> (${target.tag})`, inline: true },
                { name: '📋 Case',   value: `#${caseId}`,                       inline: true },
                { name: '📝 Reason', value: reason,                             inline: false },
                { name: '🔑 By',     value: `<@${uid}>`,                        inline: true }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }

    // --------------------------------------------------
    // ×unban <userID>
    // --------------------------------------------------
    if (command === 'unban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Ban Members** permission.');
        if (!args[0]) return reply('❌ Usage: `×unban <userID>`');
        await message.guild.members.unban(args[0]).catch(() => {});
        return reply(`✅ User \`${args[0]}\` unbanned.`);
    }

    // --------------------------------------------------
    // ×mute @user/ID [duration] [reason]
    // --------------------------------------------------
    if (command === 'mute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Moderate Members** permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×mute @user [duration] [reason]`');
        const check = canAct(uid, target.id, gid);
        if (!check.allowed) return reply(check.reason);
        const dur    = parseDuration(args[1]);
        const reason = args.slice(dur ? 2 : 1).join(' ') || 'No reason provided';
        const ms     = dur || 600000;
        const member = await resolveMember(message.guild, target.id);
        if (!member) return reply('❌ Member not found.');
        await member.timeout(ms, reason).catch(() => {});
        const caseId = addModCase(gid, 'MUTE', target.id, reason, uid);
        target.send(`🔇 Muted in **${message.guild.name}** for **${formatDuration(ms)}**.\n**Reason:** ${reason}`).catch(() => {});
        return reply({ embeds: [new EmbedBuilder().setColor(0xFFA500).setTitle('🔇 User Muted')
            .addFields(
                { name: '👤 User',      value: `<@${target.id}>`,      inline: true },
                { name: '⏱️ Duration', value: formatDuration(ms),      inline: true },
                { name: '📋 Case',     value: `#${caseId}`,             inline: true },
                { name: '📝 Reason',   value: reason,                   inline: false },
                { name: '🔑 By',       value: `<@${uid}>`,              inline: true }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }

    // --------------------------------------------------
    // ×unmute @user/ID
    // --------------------------------------------------
    if (command === 'unmute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Moderate Members** permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×unmute @user`');
        const check = canAct(uid, target.id, gid);
        if (!check.allowed) return reply(check.reason);
        const member = await resolveMember(message.guild, target.id);
        if (!member) return reply('❌ Member not found.');
        await member.timeout(null).catch(() => {});
        return reply(`✅ <@${target.id}> unmuted.`);
    }

    // --------------------------------------------------
    // ×warn @user/ID <reason>
    // --------------------------------------------------
    if (command === 'warn') {
        if (!isStaff(gid, uid) && !isFiveStar(uid) && !message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return reply('❌ No permission to warn.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×warn @user <reason>`');
        const reason = args.slice(1).join(' ');
        if (!reason) return reply('❌ Please provide a reason.');
        const check = canAct(uid, target.id, gid);
        if (!check.allowed) return reply(check.reason);
        if (!botData.warnings[gid]) botData.warnings[gid] = {};
        if (!botData.warnings[gid][target.id]) botData.warnings[gid][target.id] = [];
        const wid   = botData.warnings[gid][target.id].length + 1;
        const total = botData.warnings[gid][target.id].push({ id: wid, reason, by: uid, at: Date.now() });
        markDirty(); scheduleSave();
        target.send(`⚠️ Warning in **${message.guild.name}**.\n**Reason:** ${reason}\n**Total warnings:** ${total}`).catch(() => {});
        return reply({ embeds: [new EmbedBuilder().setColor(0xFFFF00).setTitle('⚠️ Warning Issued')
            .addFields(
                { name: '👤 User',      value: `<@${target.id}>`, inline: true },
                { name: '⚠️ Warning #', value: `${wid}`,          inline: true },
                { name: '📊 Total',     value: `${total}`,         inline: true },
                { name: '📝 Reason',    value: reason,             inline: false },
                { name: '🔑 By',        value: `<@${uid}>`,        inline: true }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }

    // --------------------------------------------------
    // ×warnings @user/ID
    // --------------------------------------------------
    if (command === 'warnings') {
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×warnings @user`');
        const warns = botData.warnings?.[gid]?.[target.id] || [];
        if (!warns.length) return reply(`✅ <@${target.id}> has no warnings.`);
        return reply({ embeds: [new EmbedBuilder().setColor(0xFFFF00).setTitle(`⚠️ Warnings — ${target.tag}`)
            .setDescription(warns.map(w => `**#${w.id}** — ${w.reason} *(by <@${w.by}>)*`).join('\n'))
            .setFooter({ text: `${warns.length} total warning(s)` }).setTimestamp()] });
    }

    // --------------------------------------------------
    // ×clearwarnings @user/ID
    // --------------------------------------------------
    if (command === 'clearwarnings') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×clearwarnings @user`');
        if (botData.warnings?.[gid]) delete botData.warnings[gid][target.id];
        markDirty(); scheduleSave();
        return reply(`✅ Cleared all warnings for <@${target.id}>.`);
    }

    // --------------------------------------------------
    // ×removewarning @user/ID <id>
    // --------------------------------------------------
    if (command === 'removewarning') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target || !args[1]) return reply('❌ Usage: `×removewarning @user <warningID>`');
        const warns = botData.warnings?.[gid]?.[target.id];
        if (!warns?.length) return reply('❌ No warnings found.');
        const idx = warns.findIndex(w => w.id === parseInt(args[1]));
        if (idx === -1) return reply(`❌ Warning #${args[1]} not found.`);
        warns.splice(idx, 1);
        markDirty(); scheduleSave();
        return reply(`✅ Removed warning #${args[1]} from <@${target.id}>.`);
    }

    // --------------------------------------------------
    // ×softban @user/ID [reason]
    // --------------------------------------------------
    if (command === 'softban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Ban Members** permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×softban @user [reason]`');
        const reason = args.slice(1).join(' ') || 'No reason provided';
        const check  = canAct(uid, target.id, gid);
        if (!check.allowed) return reply(check.reason);
        await message.guild.members.ban(target.id, { reason, deleteMessageSeconds: 604800 }).catch(() => {});
        await message.guild.members.unban(target.id).catch(() => {});
        addModCase(gid, 'SOFTBAN', target.id, reason, uid);
        return reply(`✅ Soft-banned <@${target.id}> — messages cleared, not permanently banned.`);
    }

    // --------------------------------------------------
    // ×tempban @user/ID <duration> [reason]
    // --------------------------------------------------
    if (command === 'tempban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Ban Members** permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×tempban @user <duration> [reason]`');
        const dur = parseDuration(args[1]);
        if (!dur) return reply('❌ Invalid duration. Use: `10m`, `1h`, `2d`');
        const reason = args.slice(2).join(' ') || 'No reason provided';
        const check  = canAct(uid, target.id, gid);
        if (!check.allowed) return reply(check.reason);
        await message.guild.members.ban(target.id, { reason }).catch(() => {});
        botData.timedBans.push({ guildId: gid, userId: target.id, unbanAt: Date.now() + dur });
        markDirty(); scheduleSave();
        addModCase(gid, 'TEMPBAN', target.id, `${reason} (${formatDuration(dur)})`, uid);
        target.send(`🔨 Temp-banned from **${message.guild.name}** for **${formatDuration(dur)}**.\n**Reason:** ${reason}`).catch(() => {});
        return reply(`✅ Temp-banned <@${target.id}> for **${formatDuration(dur)}**.`);
    }

    // --------------------------------------------------
    // ×tempmute @user/ID <duration> [reason]
    // --------------------------------------------------
    if (command === 'tempmute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Moderate Members** permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×tempmute @user <duration> [reason]`');
        const dur = parseDuration(args[1]);
        if (!dur) return reply('❌ Invalid duration. Use: `10m`, `1h`, `2d`');
        const reason = args.slice(2).join(' ') || 'No reason provided';
        const check  = canAct(uid, target.id, gid);
        if (!check.allowed) return reply(check.reason);
        const member = await resolveMember(message.guild, target.id);
        if (!member) return reply('❌ Member not found.');
        await member.timeout(Math.min(dur, 2419200000), reason).catch(() => {});
        addModCase(gid, 'TEMPMUTE', target.id, `${reason} (${formatDuration(dur)})`, uid);
        return reply(`✅ Muted <@${target.id}> for **${formatDuration(dur)}**.`);
    }

    // --------------------------------------------------
    // ×massban @user1 @user2 ...
    // --------------------------------------------------
    if (command === 'massban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) && !isFiveStar(uid) && !isGeneral(uid))
            return reply('❌ You need **Ban Members** permission.');
        const targets = [...message.mentions.users.values()];
        if (!targets.length) return reply('❌ Usage: `×massban @user1 @user2 ...`');
        let banned = 0;
        for (const t of targets) {
            const check = canAct(uid, t.id, gid);
                if (!check.allowed) continue;
            await message.guild.members.ban(t.id, { reason: `Mass ban by ${message.author.tag}` }).catch(() => {});
            banned++;
    }
        return reply(`✅ Banned **${banned}** user(s).`);
    }
    // ──────────────────────────────────────────────────
    // ×spam @user/ID [count]
    // ──────────────────────────────────────────────────
    if (command === 'spam') {

        // ── Permission: Officers and above only ──
        if (!isFiveStar(uid) && !isGeneral(uid) && !isOfficer(uid))
            return reply('❌ Officers and above only.');

        // ── Resolve target ──
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×spam @user/ID [count]`');

        // ── No bots ──
        if (target.bot) return reply('❌ Cannot spam a bot.');

        // ── Rank hierarchy check ──
        const check = canAct(uid, target.id, gid);
        if (!check.allowed) return reply(check.reason);

        // ── Owner is fully immune ──
        if (isFiveStar(target.id))
            return reply('❌ The **5-Star General** is completely immune to this command.');

        // ── Parse count (1–500, default 5) ──
        const rawCount = parseInt(args[1]);
        const count    = (!isNaN(rawCount) && rawCount >= 1 && rawCount <= 500) ? rawCount : 5;

        // ── Delete the command message ──
        await message.delete().catch(() => {});

        // ══════════════════════════════════════════
        //  ANIMATION SEQUENCE
        //  6 frames over 4 seconds (~667ms each)
        //  then 3,2,1 countdown at 800ms each
        //  then ATTACKING for 2 seconds
        // ══════════════════════════════════════════

        const animFrames = [
            {
                bar:    '▱▱▱▱▱▱▱▱▱▱',
                label:  'Initializing...',
                status: '⚙️ Preparing attack on ' + target.tag,
            },
            {
                bar:    '██▱▱▱▱▱▱▱▱',
                label:  'Locking on target...',
                status: '🎯 Target acquired: ' + target.tag,
            },
            {
                bar:    '████▱▱▱▱▱▱',
                label:  'Loading payload...',
                status: '📦 Loading payload...',
            },
            {
                bar:    '██████▱▱▱▱',
                label:  'Arming systems...',
                status: '🔫 Systems armed.',
            },
            {
                bar:    '████████▱▱',
                label:  'Final checks...',
                status: '✅ All systems go.',
            },
            {
                bar:    '██████████',
                label:  'READY.',
                status: '🚨 ATTACK IMMINENT',
            },
        ];

        const buildAnimEmbed = (frame, countdown) => new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 SOLDIER² — SPAM ATTACK')
            .setDescription(
                `**${frame.status}**\n\n` +
                `\`[${frame.bar}]\`\n` +
                `*${frame.label}*\n\n` +
                (countdown !== null ? `**Attacking in ${countdown}...**` : '')
            )
            .addFields(
                { name: '🎯 Target', value: `<@${target.id}> (${target.tag})`, inline: true },
                { name: '🔢 Rounds', value: `**${count}**`,                    inline: true },
                { name: '⚡ By',     value: `<@${uid}>`,                       inline: true },
            )
            .setFooter({ text: 'SOLDIER² Spam System' })
            .setTimestamp();

        // Send initial animation frame
        const animMsg = await message.channel.send({ embeds: [buildAnimEmbed(animFrames[0], null)] });

        // Step through loading bar frames
        // 6 frames total, spread across 4 seconds = ~667ms per frame
        const frameDelay = 667;
        for (let i = 1; i < animFrames.length; i++) {
            await new Promise(r => setTimeout(r, frameDelay));
            await animMsg.edit({ embeds: [buildAnimEmbed(animFrames[i], null)] }).catch(() => {});
        }

        // Countdown: 3, 2, 1 at 800ms each
        for (let c = 3; c >= 1; c--) {
            await new Promise(r => setTimeout(r, 800));
            await animMsg.edit({ embeds: [buildAnimEmbed(animFrames[animFrames.length - 1], c)] }).catch(() => {});
        }

        // ATTACKING frame — stays for 2 full seconds
        await new Promise(r => setTimeout(r, 800));
        await animMsg.edit({ embeds: [
            new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('💥 ATTACKING!')
                .setDescription(`**Opening fire on <@${target.id}>...**`)
                .setFooter({ text: 'SOLDIER² Spam System' })
                .setTimestamp()
        ]}).catch(() => {});

        await new Promise(r => setTimeout(r, 2000));

        // Delete animation then begin spam
        await animMsg.delete().catch(() => {});

        // ══════════════════════════════════════════
        //  SPAM LOOP — 2 second rate limit between tags
        // ══════════════════════════════════════════

        const spamMessages = [];

        for (let i = 0; i < count; i++) {
            const m = await message.channel.send(`<@${target.id}>`).catch(() => null);
            if (m) spamMessages.push(m);
            await new Promise(r => setTimeout(r, 2000));
        }

        // ══════════════════════════════════════════
        //  DM THE TARGET — one DM, stop if it fails
        // ══════════════════════════════════════════

        let dmSuccess = true;
        for (let i = 0; i < count; i++) {
            const dmResult = await target.send(
                `🚨 You have been pinged **${count}** time(s) in **${message.guild.name}** by <@${uid}>.`
            ).catch(() => null);

            if (!dmResult) {
                dmSuccess = false;
                break;
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        // ── Notify if DMs failed ──
        if (!dmSuccess) {
            const notifyEmbed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('📵 DM Delivery Failed')
                .setDescription(`Target's DM is off. Could not send DMs to <@${target.id}> (${target.tag}).`)
                .addFields(
                    { name: '🎯 Target',      value: `${target.tag} (\`${target.id}\`)`, inline: true },
                    { name: '⚡ Executed By', value: `<@${uid}>`,                         inline: true },
                    { name: '🏠 Server',      value: message.guild.name,                  inline: true },
                )
                .setTimestamp();

            // Notify the person who ran the command
            await message.author.send({ embeds: [notifyEmbed] }).catch(() => {});

            // Also notify owner if it wasn't the owner who ran it
            if (uid !== OWNER_ID) {
                const owner = await client.users.fetch(OWNER_ID).catch(() => null);
                if (owner) await owner.send({ embeds: [notifyEmbed] }).catch(() => {});
            }
        }

        // ══════════════════════════════════════════
        //  AUTO DELETE TAGS after 25 seconds
        // ══════════════════════════════════════════

        setTimeout(async () => {
            for (const m of spamMessages) {
                await m.delete().catch(() => {});
            }
        }, 25000);

        // ══════════════════════════════════════════
        //  LOG IT
        // ══════════════════════════════════════════

        const caseId = addModCase(gid, 'SPAM', target.id, `Spammed ${count} times by <@${uid}>`, uid);

        const logEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 Spam Attack Executed')
            .addFields(
                { name: '🎯 Target', value: `<@${target.id}> (${target.tag})`, inline: true },
                { name: '🔢 Count',  value: `**${count}**`,                    inline: true },
                { name: '⚡ By',     value: `<@${uid}>`,                       inline: true },
                { name: '🏠 Server', value: message.guild.name,                inline: true },
                { name: '📋 Case',   value: `#${caseId}`,                      inline: true },
                { name: '📵 DMs',    value: dmSuccess ? '✅ Delivered' : '❌ Failed', inline: true },
            )
            .setTimestamp()
            .setFooter({ text: 'SOLDIER² Spam Log' });

        sendLog(client, gid, logEmbed);
        sendMasterLog(logEmbed);

        return;
    }
    // ── END ×spam ───────────────────────────────────────


    // =========================================================
    //  MESSAGE MANAGEMENT
    // =========================================================

    // --------------------------------------------------
    // ×purge <amount>
    // --------------------------------------------------
    if (command === 'purge') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Messages** permission.');
        const amt = parseInt(args[0]);
        if (isNaN(amt) || amt < 1 || amt > 100) return reply('❌ Amount must be 1–100.');
        await message.channel.bulkDelete(amt + 1, true).catch(() => {});
        return message.channel.send(`✅ Deleted **${amt}** messages.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
    }

    // --------------------------------------------------
    // ×purgeuser @user/ID <amount>
    // --------------------------------------------------
    if (command === 'purgeuser') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Messages** permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×purgeuser @user <amount>`');
        const amt  = parseInt(args[1]) || 10;
        const msgs = await message.channel.messages.fetch({ limit: 100 });
        const del  = msgs.filter(m => m.author.id === target.id).first(amt);
        await message.channel.bulkDelete(del, true).catch(() => {});
        return reply(`✅ Deleted messages from <@${target.id}>.`);
    }

    // --------------------------------------------------
    // ×purgebot <amount>
    // --------------------------------------------------
    if (command === 'purgebot') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Messages** permission.');
        const amt  = parseInt(args[0]) || 10;
        const msgs = await message.channel.messages.fetch({ limit: 100 });
        const del  = msgs.filter(m => m.author.bot).first(amt);
        await message.channel.bulkDelete(del, true).catch(() => {});
        return reply(`✅ Deleted bot messages.`);
    }

    // --------------------------------------------------
    // ×purgelinks <amount>
    // --------------------------------------------------
    if (command === 'purgelinks') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Messages** permission.');
        const amt  = parseInt(args[0]) || 10;
        const msgs = await message.channel.messages.fetch({ limit: 100 });
        const del  = msgs.filter(m => /https?:\/\/|discord\.gg\//i.test(m.content)).first(amt);
        await message.channel.bulkDelete(del, true).catch(() => {});
        return reply(`✅ Deleted messages with links.`);
    }

    // --------------------------------------------------
    // ×lock [#channel]
    // --------------------------------------------------
    if (command === 'lock') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Channels** permission.');
        const ch = message.mentions.channels.first() || message.channel;
            await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }).catch(() => {});
        return reply(`🔒 <#${ch.id}> locked.`);
    }

    // --------------------------------------------------
    // ×unlock [#channel]
    // --------------------------------------------------
    if (command === 'unlock') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Channels** permission.');
        const ch = message.mentions.channels.first() || message.channel;
            await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }).catch(() => {});
        return reply(`🔓 <#${ch.id}> unlocked.`);
    }

    // --------------------------------------------------
    // ×slowmode <seconds> [#channel]
    // --------------------------------------------------
    if (command === 'slowmode') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Channels** permission.');
        const sec = parseInt(args[0]);
        if (isNaN(sec) || sec < 0 || sec > 21600) return reply('❌ Must be 0–21600 seconds.');
        const ch = message.mentions.channels.first() || message.channel;
        await ch.setRateLimitPerUser(sec).catch(() => {});
        return reply(sec === 0 ? `✅ Slowmode disabled in <#${ch.id}>.` : `✅ Slowmode set to **${sec}s** in <#${ch.id}>.`);
    }

    // ──────────────────────────────────────────────────
    // ×counting
    // ──────────────────────────────────────────────────
    if (command === 'counting') {
        const subCommand = args[0]?.toLowerCase();

        // ×counting setchannel #channel
        if (subCommand === 'setchannel') {
            if (!canSetCountingChannel(gid, uid))
                return reply('❌ You need at least an Enlisted rank to set the counting channel.');

            const targetChannel =
                message.mentions.channels.first() ||
                (args[1] ? message.guild.channels.cache.get(args[1]) : null);

            if (!targetChannel || targetChannel.type !== 0)
                return reply('❌ Please mention a valid text channel. Example: `×counting setchannel #counting`');

            const cd = getCountingData(gid);
            cd.channelId = targetChannel.id;
            markDirty(); scheduleSave();

            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('✅ Counting Channel Set')
                .setDescription(`Counting channel set to <#${targetChannel.id}>.`)
                .addFields(
                    { name: 'Current Count', value: `**${cd.currentNumber}**`, inline: true },
                    { name: 'Next Expected', value: `**${cd.currentNumber + 1}**`, inline: true },
                )
                .setFooter({ text: `Set by ${message.author.tag}` })
                .setTimestamp();
            return message.channel.send({ embeds: [embed] });
        }

        // ×counting setnext <number>
        if (subCommand === 'setnext') {
            if (!canSetNextCount(uid))
                return reply('❌ Only **Generals**, **Officers**, or the **Bot Owner** can use this.');

            const rawNum = args[1];
            if (!rawNum || !/^\d+$/.test(rawNum))
                return reply('❌ Provide a valid integer. Example: `×counting setnext 500`');

            const targetNext = parseInt(rawNum, 10);
            if (targetNext < 1)
                return reply('❌ The next number must be at least 1.');

            const cd = getCountingData(gid);
            cd.currentNumber       = targetNext - 1;
            cd.lastCounter         = null;
            cd.doubleCountWarnings = {};
            markDirty(); scheduleSave();

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('🔧 Count Manually Adjusted')
                .setDescription(`Next expected number is now **${targetNext}**.`)
                .addFields(
                    { name: 'Next Expected', value: `**${targetNext}**`, inline: true },
                    { name: 'Set By',        value: `<@${uid}>`,         inline: true },
                )
                .setTimestamp();
            return message.channel.send({ embeds: [embed] });
        }

        // ×counting leaderboard
        if (subCommand === 'leaderboard') {
            if (!botData.counting || Object.keys(botData.counting).length === 0)
                return reply('📊 No counting data recorded yet.');

            const entries = [];
            for (const [gId, data] of Object.entries(botData.counting)) {
                if (!data.highestNumber || data.highestNumber === 0) continue;
                const g    = client.guilds.cache.get(gId);
                const name = g ? g.name : `Unknown Server (${gId})`;
                entries.push({ name, highest: data.highestNumber });
            }

            if (entries.length === 0)
                return reply('📊 No milestone counts recorded yet.');

            entries.sort((a, b) => b.highest - a.highest);
            const medals = ['🥇', '🥈', '🥉'];
            const lines  = entries.slice(0, 10).map((e, i) =>
                `${medals[i] || `**${i + 1}.**`} **${e.name}** — ${e.highest.toLocaleString()}`
            );

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🌍 Global Counting Leaderboard')
                .setDescription(lines.join('\n'))
                .setFooter({ text: 'Highest number ever reached per server' })
                .setTimestamp();
            return message.channel.send({ embeds: [embed] });
        }

        // ×counting — no subcommand, show status and help
        const cd     = getCountingData(gid);
        const pfx    = getPrefix(gid);
        const helpEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🔢 Counting Game')
            .setDescription(
                `**Current Count:** ${cd.currentNumber}\n` +
                `**Next Expected:** ${cd.currentNumber + 1}\n` +
                `**All-Time High:** ${cd.highestNumber}\n` +
                (cd.channelId ? `**Channel:** <#${cd.channelId}>` : '**Channel:** *Not set*')
            )
            .addFields({
                name: 'Commands',
                value:
                    `\`${pfx}counting setchannel #channel\` — Set counting channel *(Enlisted+)*\n` +
                    `\`${pfx}counting setnext <number>\` — Jump to a number *(Officers+)*\n` +
                    `\`${pfx}counting leaderboard\` — Global server leaderboard`,
            })
            .setFooter({ text: 'SOLDIER² Counting Game' })
            .setTimestamp();
        return message.channel.send({ embeds: [helpEmbed] });
    }
    // ── END ×counting ──────────────────────────────────

// ──────────────────────────────────────────────────
    // ×qotd
    // ──────────────────────────────────────────────────
    if (command === 'qotd') {
        if (!canManageQotd(gid, uid))
            return reply('❌ You need at least an Enlisted rank to manage QOTD.');

        const sub = args[0]?.toLowerCase();

        // ×qotd setchannel #channel
        if (sub === 'setchannel') {
            const targetChannel =
                message.mentions.channels.first() ||
                (args[1] ? message.guild.channels.cache.get(args[1]) : null);

            if (!targetChannel || targetChannel.type !== 0)
                return reply('❌ Please mention a valid text channel. Example: `×qotd setchannel #qotd`');

            const qd = getQotdData(gid);
            qd.channelId = targetChannel.id;
            markDirty(); scheduleSave();

            const embed = new EmbedBuilder()
                .setColor(0x24c718)
                .setTitle('✅ QOTD Channel Set')
                .setDescription(`Question of the Day will be posted in <#${targetChannel.id}>.`)
                .setFooter({ text: `Set by ${message.author.tag}` })
                .setTimestamp();
            return message.channel.send({ embeds: [embed] });
        }

        // ×qotd start — begins the 24-hour cycle from now
        if (sub === 'start') {
            const qd = getQotdData(gid);
            if (!qd.channelId)
                return reply('❌ No QOTD channel set. Use `×qotd setchannel #channel` first.');

            qd.enabled    = true;
            qd.nextSendAt = Date.now() + 24 * 60 * 60 * 1000;
            markDirty(); scheduleSave();
            scheduleQotd(gid);

            // Send the first question right now
            await sendQotd(gid);

            const embed = new EmbedBuilder()
                .setColor(0x24c718)
                .setTitle('✅ QOTD Started')
                .setDescription(
                    `Question of the Day is now **active** in <#${qd.channelId}>.\n` +
                    `A new question will be sent every **24 hours**.`
                )
                .addFields(
                    { name: 'Ping Everyone', value: qd.pingEveryone ? '✅ Yes' : '❌ No', inline: true },
                    { name: 'Channel',       value: `<#${qd.channelId}>`,                 inline: true },
                )
                .setFooter({ text: `Started by ${message.author.tag}` })
                .setTimestamp();
            return message.channel.send({ embeds: [embed] });
        }

        // ×qotd stop — pauses the schedule
        if (sub === 'stop') {
            const qd = getQotdData(gid);
            qd.enabled = false;

            if (qotdTimers[gid]) {
                clearTimeout(qotdTimers[gid]);
                delete qotdTimers[gid];
            }

            markDirty(); scheduleSave();

            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('⛔ QOTD Stopped')
                .setDescription('Question of the Day has been **disabled** for this server.')
                .setFooter({ text: `Stopped by ${message.author.tag}` })
                .setTimestamp();
            return message.channel.send({ embeds: [embed] });
        }

        // ×qotd send — immediately sends a question (for a second question in one day)
        if (sub === 'send') {
            const qd = getQotdData(gid);
            if (!qd.channelId)
                return reply('❌ No QOTD channel set. Use `×qotd setchannel #channel` first.');

            await sendQotd(gid);

            return message.channel.send({ embeds: [
                new EmbedBuilder()
                    .setColor(0x24c718)
                    .setTitle('✅ Question Sent')
                    .setDescription(`A question was sent to <#${qd.channelId}>.`)
                    .setTimestamp()
            ]});
        }

        // ×qotd ping on/off — toggle @everyone ping
        if (sub === 'ping') {
            const toggle = args[1]?.toLowerCase();
            if (!['on', 'off'].includes(toggle))
                return reply('❌ Usage: `×qotd ping on` or `×qotd ping off`');

            const qd = getQotdData(gid);
            qd.pingEveryone = toggle === 'on';
            markDirty(); scheduleSave();

            return reply(`✅ QOTD **@everyone** ping is now **${toggle === 'on' ? 'enabled' : 'disabled'}**.`);
        }

        // ×qotd status — show current config
        if (sub === 'status') {
            const qd   = getQotdData(gid);
            const next = qd.nextSendAt
                ? `<t:${Math.floor(qd.nextSendAt / 1000)}:R>`
                : '*(not scheduled)*';

            const embed = new EmbedBuilder()
                .setColor(0x24c718)
                .setTitle('❓ QOTD Status')
                .addFields(
                    { name: 'Status',        value: qd.enabled ? '✅ Active' : '❌ Stopped',                    inline: true },
                    { name: 'Channel',       value: qd.channelId ? `<#${qd.channelId}>` : '*(not set)*',        inline: true },
                    { name: 'Ping Everyone', value: qd.pingEveryone ? '✅ Yes' : '❌ No',                        inline: true },
                    { name: 'Next Question', value: next,                                                         inline: true },
                    { name: 'Up Next',       value: `**"${QOTD_QUESTIONS[qd.currentIndex % QOTD_QUESTIONS.length]}"**`, inline: false },
                )
                .setFooter({ text: `${QOTD_QUESTIONS.length} questions in rotation` })
                .setTimestamp();
            return message.channel.send({ embeds: [embed] });
        }

        // ×qotd — no subcommand, show help
        const pfx = getPrefix(gid);
        const helpEmbed = new EmbedBuilder()
            .setColor(0x24c718)
            .setTitle('❓ Question of the Day — Commands')
            .setDescription(
                `\`${pfx}qotd setchannel #channel\` — Set the QOTD channel\n` +
                `\`${pfx}qotd start\` — Start sending questions every 24 hours\n` +
                `\`${pfx}qotd stop\` — Stop the question schedule\n` +
                `\`${pfx}qotd send\` — Send a question right now (extra question)\n` +
                `\`${pfx}qotd ping on/off\` — Toggle @everyone ping on questions\n` +
                `\`${pfx}qotd status\` — View current QOTD config`
            )
            .setFooter({ text: 'SOLDIER² QOTD System • Enlisted and above' })
            .setTimestamp();
        return message.channel.send({ embeds: [helpEmbed] });
    }
    // ── END ×qotd ──────────────────────────────────────
    // =========================================================
    //  USER & SERVER INFO
    // =========================================================

    // --------------------------------------------------
    // ×userinfo @user/ID
    // --------------------------------------------------
    if (command === 'userinfo') {
        const target = message.mentions.users.first() || await resolveUser(client, args[0]) || message.author;
        const member = await resolveMember(message.guild, target.id);
        const rank   = getHighestRank(gid, target.id) || 'Civilian';
        const warns  = botData.warnings?.[gid]?.[target.id]?.length || 0;
        return reply({ embeds: [new EmbedBuilder().setColor(0x00CED1).setTitle(`👤 User Info — ${target.tag}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🆔 ID',             value: target.id,                                                                                                  inline: true },
                { name: '🎖️ Bot Rank',       value: rank,                                                                                                       inline: true },
                { name: '⚠️ Warnings',       value: `${warns}`,                                                                                                 inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`,                                                     inline: true },
                { name: '📅 Joined Server',   value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'N/A',                                     inline: true },
                { name: '🎭 Roles',           value: member ? member.roles.cache.filter(r => r.id !== gid).map(r => `<@&${r.id}>`).join(', ').slice(0, 1000) || 'None' : 'N/A', inline: false }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }

    // --------------------------------------------------
    // ×serverinfo [serverID]
    // --------------------------------------------------
    if (command === 'serverinfo') {
        let guild = message.guild;
        if (args[0] && (isFiveStar(uid) || isGeneral(uid))) {
            const g = client.guilds.cache.get(args[0]);
            if (!g) return reply('❌ Server not found.');
            guild = g;
    }
        return reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle(`🏠 Server Info — ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '🆔 ID',      value: guild.id,                                          inline: true },
                { name: '👑 Owner',   value: `<@${guild.ownerId}>`,                              inline: true },
                { name: '👥 Members', value: `${guild.memberCount}`,                             inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '📢 Channels',value: `${guild.channels.cache.size}`,                     inline: true },
                { name: '🎭 Roles',   value: `${guild.roles.cache.size}`,                        inline: true }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }

    // --------------------------------------------------
    // ×avatar @user/ID
    // --------------------------------------------------
    if (command === 'avatar') {
        const target = message.mentions.users.first() || await resolveUser(client, args[0]) || message.author;
        return reply({ embeds: [new EmbedBuilder().setColor(0x9B59B6).setTitle(`🖼️ Avatar — ${target.tag}`)
            .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 })).setFooter({ text: 'SOLDIER²' })] });
    }

    // --------------------------------------------------
    // ×roleinfo @role/roleID — Role name, ID, color, members, permissions
    // --------------------------------------------------
    if (command === 'roleinfo') {
        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
        if (!role) return reply('❌ Usage: `×roleinfo @role` or `×roleinfo <roleID>`');
        return reply({ embeds: [new EmbedBuilder().setColor(role.color || 0x5865F2).setTitle(`🎭 Role Info — ${role.name}`)
            .addFields(
                { name: '🆔 Role ID',          value: role.id,                                          inline: true },
                { name: '🎨 Color',             value: role.hexColor,                                   inline: true },
                { name: '👥 Members',           value: `${role.members.size}`,                          inline: true },
                { name: '📅 Created',           value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '📌 Position',          value: `${role.position}`,                              inline: true },
                { name: '🔑 Mentionable',       value: role.mentionable ? 'Yes' : 'No',                 inline: true },
                { name: '⚡ Key Permissions',   value: role.permissions.toArray().slice(0, 10).join(', ') || 'None', inline: false }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }

    // --------------------------------------------------
    // ×rolelist
    // --------------------------------------------------
    if (command === 'rolelist') {
        const roles = message.guild.roles.cache.sort((a, b) => b.position - a.position)
            .map(r => `• **${r.name}** — ID: \`${r.id}\` — ${r.members.size} members`);
        return reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle(`🎭 Roles — ${message.guild.name}`)
            .setDescription(roles.join('\n').slice(0, 4000)).setFooter({ text: `${roles.length} roles` }).setTimestamp()] });
    }

    // --------------------------------------------------
    // ×membercount
    // --------------------------------------------------
    if (command === 'membercount') {
        await message.guild.members.fetch();
        const total  = message.guild.memberCount;
        const bots   = message.guild.members.cache.filter(m => m.user.bot).size;
        const humans = total - bots;
        return reply({ embeds: [new EmbedBuilder().setColor(0x00FF7F).setTitle(`👥 Member Count — ${message.guild.name}`)
            .addFields(
                { name: '👥 Total',  value: `${total}`,  inline: true },
                { name: '👤 Humans', value: `${humans}`, inline: true },
                { name: '🤖 Bots',   value: `${bots}`,   inline: true }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }

    // --------------------------------------------------
    // ×lookup <userID>
    // --------------------------------------------------
    if (command === 'lookup') {
        const target = await client.users.fetch(args[0]).catch(() => null);
        if (!target) return reply('❌ User not found.');
        return reply({ embeds: [new EmbedBuilder().setColor(0x00CED1).setTitle(`🔎 Lookup — ${target.tag}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🆔 ID',      value: target.id,                                          inline: true },
                { name: '🤖 Bot',     value: target.bot ? 'Yes' : 'No',                          inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }

    // --------------------------------------------------
    // ×joinpos @user/ID
    // --------------------------------------------------
    if (command === 'joinpos') {
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×joinpos @user`');
        await message.guild.members.fetch();
        const sorted = message.guild.members.cache.sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);
        const pos    = [...sorted.keys()].indexOf(target.id) + 1;
        return reply(`📋 <@${target.id}> joined at position **#${pos}** out of **${sorted.size}**.`);
    }

    // --------------------------------------------------
    // ×newaccounts [days]
    // --------------------------------------------------
    if (command === 'newaccounts') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const days    = parseInt(args[0]) || 30;
        const cutoff  = Date.now() - days * 86400000;
        await message.guild.members.fetch();
        const newMems = message.guild.members.cache
            .filter(m => !m.user.bot && m.user.createdTimestamp > cutoff)
            .map(m => `• ${m.user.tag} — <t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`);
        return reply({ embeds: [new EmbedBuilder().setColor(0xFF6600).setTitle(`🆕 New Accounts (< ${days} days)`)
            .setDescription(newMems.slice(0, 30).join('\n') || '*(none)*')
            .setFooter({ text: `${newMems.length} account(s) found` }).setTimestamp()] });
    }


    // =========================================================
    //  MODERATION LOGS
    // =========================================================

    // --------------------------------------------------
    // ×modlog @user/ID
    // --------------------------------------------------
    if (command === 'modlog') {
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×modlog @user`');
        const cases = botData.modlog?.[gid]?.cases?.filter(c => c.userId === target.id) || [];
        if (!cases.length) return reply(`✅ No mod history for <@${target.id}>.`);
        return reply({ embeds: [new EmbedBuilder().setColor(0xFF6600).setTitle(`📋 Mod Log — ${target.tag}`)
            .setDescription(cases.slice(-20).map(c => `**#${c.id} [${c.type}]** — ${c.reason} *(by <@${c.by}>)*`).join('\n'))
            .setFooter({ text: `${cases.length} total cases` }).setTimestamp()] });
    }

    // --------------------------------------------------
    // ×modstats
    // --------------------------------------------------
    if (command === 'modstats') {
        const cases  = botData.modlog?.[gid]?.cases || [];
        const counts = {};
        cases.forEach(c => { counts[c.type] = (counts[c.type] || 0) + 1; });
        return reply({ embeds: [new EmbedBuilder().setColor(0xFF6600).setTitle(`📊 Mod Stats — ${message.guild.name}`)
            .setDescription(Object.entries(counts).map(([k, v]) => `**${k}:** ${v}`).join('\n') || '*(no cases)*')
            .addFields({ name: '📋 Total Cases', value: `${cases.length}`, inline: true })
            .setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }

    // --------------------------------------------------
    // ×setlogchannel #channel
    // --------------------------------------------------
    if (command === 'setlogchannel') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Server** permission.');
        const ch = message.mentions.channels.first();
        if (!ch) return reply('❌ Usage: `×setlogchannel #channel`');
        botData.logChannels[gid] = ch.id;
        markDirty(); scheduleSave();
        return reply(`✅ Log channel set to <#${ch.id}>. All commands will be logged there.`);
    }

    // --------------------------------------------------
    // ×modreason <caseID> <reason>
    // --------------------------------------------------
    if (command === 'modreason') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const caseId    = parseInt(args[0]);
        const newReason = args.slice(1).join(' ');
        if (!caseId || !newReason) return reply('❌ Usage: `×modreason <caseID> <reason>`');
        const c = botData.modlog?.[gid]?.cases?.find(x => x.id === caseId);
        if (!c) return reply(`❌ Case #${caseId} not found.`);
        c.reason = newReason;
        markDirty(); scheduleSave();
        return reply(`✅ Case #${caseId} reason updated.`);
    }
    //Autodelete
    if (command === 'target') {

    const sub = args[0];

    if (!sub) return reply('Provide a user.');

    if (!botData.autoDeleteTargets[gid])
        botData.autoDeleteTargets[gid] = {};

    if (sub === 'off') {
        const target = message.mentions.users.first() || await resolveUser(client, args[1]);
        if (!target) return reply('Invalid user.');

        delete botData.autoDeleteTargets[gid][target.id];
        markDirty(); scheduleSave();

        return reply(`Removed ${target.tag} from target list.`);
    }

    if (sub === 'list') {
        const list = botData.autoDeleteTargets[gid];
        if (!list || !Object.keys(list).length)
            return reply('No targets.');

        const lines = Object.entries(list).map(([id, data]) =>
            `• <@${id}> (${id}) | Tagged <t:${Math.floor(data.taggedAt/1000)}:R>`
        );

        return reply(lines.join('\n'));
    }

    const target = message.mentions.users.first() || await resolveUser(client, sub);
    if (!target) return reply('Invalid user.');

    botData.autoDeleteTargets[gid][target.id] = {
        taggedBy: message.author.id,
        taggedAt: Date.now()
    };

    markDirty(); scheduleSave();

    return reply(`${target.tag} is now targeted.`);
    }


    // =========================================================
    //  SERVER PROTECTION & AUTOMOD
    // =========================================================

    // --------------------------------------------------
    // ×lockdown — Lock ALL channels
    // --------------------------------------------------
    if (command === 'lockdown') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Channels** permission.');
        for (const [, ch] of message.guild.channels.cache.filter(c => c.type === 0))
            await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }).catch(() => {});
        return reply('🔒 **Server lockdown activated.**');
    }

    // --------------------------------------------------
    // ×unlockdown — Unlock ALL channels
    // --------------------------------------------------
    if (command === 'unlockdown') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Channels** permission.');
        for (const [, ch] of message.guild.channels.cache.filter(c => c.type === 0))
            await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }).catch(() => {});
        return reply('🔓 **Lockdown lifted.**');
    }

    // --------------------------------------------------
    // ×antiraid on/off — Snapshot & restore on off
    // --------------------------------------------------
    if (command === 'antiraid') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const toggle = args[0]?.toLowerCase();
        if (toggle === 'on') {
            const snapshot = {};
            for (const [cid2, ch] of message.guild.channels.cache.filter(c => c.type === 0)) {
                snapshot[cid2] = ch.permissionOverwrites.cache.map(o => ({
                    id: o.id, type: o.type,
                    allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString()
                }));
                await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false, AddReactions: false }).catch(() => {});
    }
            if (!botData.antiraidSnapshot) botData.antiraidSnapshot = {};
            botData.antiraidSnapshot[gid] = { snapshot };
        if (!botData.automod[gid]) botData.automod[gid] = {};
            botData.automod[gid].antiraid = true;
        markDirty(); scheduleSave();
            return reply('🚨 **Anti-raid ON.** All channels locked. Use `×antiraid off` to restore.');
    }
        if (toggle === 'off') {
            const snap = botData.antiraidSnapshot?.[gid]?.snapshot;
            for (const [cid2, ch] of message.guild.channels.cache.filter(c => c.type === 0)) {
                await ch.permissionOverwrites.set([]).catch(() => {});
                if (snap?.[cid2]) {
                    for (const o of snap[cid2])
                        await ch.permissionOverwrites.edit(o.id, { allow: BigInt(o.allow), deny: BigInt(o.deny) }).catch(() => {});
    }
    }
            delete botData.antiraidSnapshot?.[gid];
            if (botData.automod[gid]) botData.automod[gid].antiraid = false;
        markDirty(); scheduleSave();
            return reply('✅ **Anti-raid OFF.** Server restored to previous state.');
    }
        return reply('❌ Usage: `×antiraid on/off`');
    }

    // --------------------------------------------------
    // ×antispam on/off | ×antilink on/off | ×automod on/off
    // --------------------------------------------------
    if (['antispam', 'antilink', 'automod'].includes(command)) {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const toggle = args[0]?.toLowerCase();
        if (!['on', 'off'].includes(toggle)) return reply(`❌ Usage: \`×${command} on/off\``);
        if (!botData.automod[gid]) botData.automod[gid] = {};
        botData.automod[gid][command] = toggle === 'on';
        markDirty(); scheduleSave();
        return reply(`✅ **${command}** ${toggle === 'on' ? 'enabled' : 'disabled'}.`);
    }

    // --------------------------------------------------
    // ×anticaps <percent> | ×antiemoji <limit> | ×antimentions <limit>
    // --------------------------------------------------
    if (command === 'anticaps') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const pct = parseInt(args[0]);
        if (isNaN(pct) || pct < 1 || pct > 100) return reply('❌ Usage: `×anticaps <percent>`');
        if (!botData.automod[gid]) botData.automod[gid] = {};
        botData.automod[gid].anticaps    = true;
        botData.automod[gid].capsPercent = pct;
        markDirty(); scheduleSave();
        return reply(`✅ Anti-caps set to **${pct}%**.`);
    }
    if (command === 'antiemoji') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const lim = parseInt(args[0]);
        if (isNaN(lim)) return reply('❌ Usage: `×antiemoji <limit>`');
        if (!botData.automod[gid]) botData.automod[gid] = {};
        botData.automod[gid].antiemoji  = true;
        botData.automod[gid].emojiLimit = lim;
        markDirty(); scheduleSave();
        return reply(`✅ Anti-emoji limit set to **${lim}**.`);
    }
    if (command === 'antimentions') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const lim = parseInt(args[0]);
        if (isNaN(lim)) return reply('❌ Usage: `×antimentions <limit>`');
        if (!botData.automod[gid]) botData.automod[gid] = {};
        botData.automod[gid].antimentions  = true;
        botData.automod[gid].mentionLimit  = lim;
        markDirty(); scheduleSave();
        return reply(`✅ Anti-mentions limit set to **${lim}**.`);
    }

    // --------------------------------------------------
    // ×badwords add/remove <word> | ×badwordslist
    // --------------------------------------------------
    if (command === 'badwords') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        if (!botData.automod[gid]) botData.automod[gid] = {};
        if (!botData.automod[gid].badwords) botData.automod[gid].badwords = [];
        const action = args[0]?.toLowerCase(), word = args[1];
        if (!word) return reply('❌ Usage: `×badwords add/remove <word>`');
        if (action === 'add')    { if (!botData.automod[gid].badwords.includes(word)) botData.automod[gid].badwords.push(word); markDirty(); scheduleSave(); return reply(`✅ Added **${word}** to banned words.`); }
        if (action === 'remove') { botData.automod[gid].badwords = botData.automod[gid].badwords.filter(w => w !== word); markDirty(); scheduleSave(); return reply(`✅ Removed **${word}**.`); }
        return reply('❌ Usage: `×badwords add/remove <word>`');
    }
    if (command === 'badwordslist') {
        const words = botData.automod?.[gid]?.badwords || [];
        return reply(words.length ? `🚫 **Banned words:** ${words.map(w => `\`${w}\``).join(', ')}` : '✅ No banned words set.');
    }

    // --------------------------------------------------
    // ×setmuterole @role
    // --------------------------------------------------
    if (command === 'setmuterole') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Roles** permission.');
        const role = message.mentions.roles.first();
        if (!role) return reply('❌ Usage: `×setmuterole @role`');
        botData.mutedRoles[gid] = role.id;
        markDirty(); scheduleSave();
        return reply(`✅ Mute role set to **${role.name}**.`);
    }


    // =========================================================
    //  ANNOUNCEMENTS & UTILITIES
    // =========================================================

    // --------------------------------------------------
    // ×announce #channel <message>
    // --------------------------------------------------
    if (command === 'announce') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Server** permission.');
        const ch   = message.mentions.channels.first();
        const text = args.slice(1).join(' ');
        if (!ch || !text) return reply('❌ Usage: `×announce #channel <message>`');
        await ch.send({ embeds: [new EmbedBuilder().setColor(0xFF6600).setTitle('📢 Announcement').setDescription(text)
            .setFooter({ text: `Announced by ${message.author.tag}` }).setTimestamp()] });
        return reply(`✅ Announcement sent to <#${ch.id}>.`);
    }

    // --------------------------------------------------
    // ×say <message>
    // --------------------------------------------------
    if (command === 'say') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const text = args.join(' ');
        if (!text) return reply('❌ Usage: `×say <message>`');
        await message.delete().catch(() => {});
        return message.channel.send(text);
    }

    // --------------------------------------------------
    // ×info [#hexcolor] | <title> | <description> [| gifURL]
    // Repeatable title|description blocks. Optional color + gif.
    // --------------------------------------------------
    if (command === 'info') {
        const full  = message.content.slice(prefix.length + 5).trim();
        const parts = full.split('|').map(p => p.trim());
        let color   = 0x5865F2;
        let idx     = 0;
        if (/^#?[0-9a-f]{6}$/i.test(parts[0])) { color = parseInt(parts[0].replace('#', ''), 16); idx++; }
        const embed  = new EmbedBuilder().setColor(color).setTimestamp().setFooter({ text: 'SOLDIER²' });
        let gifUrl   = null;
        let firstTitle = true;
        let i = idx;
        while (i < parts.length) {
            const f = parts[i];
            if (/^https?:\/\/.+\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i.test(f)) { gifUrl = f; i++; continue; }
            if (firstTitle) { embed.setTitle(f); firstTitle = false; i++; if (parts[i] && !/^https?/.test(parts[i])) { embed.setDescription(parts[i]); i++; } }
            else { embed.addFields({ name: f, value: parts[i + 1] || '\u200b', inline: false }); i += 2; }
    }
        if (gifUrl) embed.setImage(gifUrl);
        return reply({ embeds: [embed] });
    }

    // --------------------------------------------------
    // ×poll <question> | <opt1> | <opt2> ...
    // --------------------------------------------------
    if (command === 'poll') {
        const parts = args.join(' ').split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length < 3) return reply('❌ Usage: `×poll <question> | <option1> | <option2>`');
        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
        const msg2   = await message.channel.send({ embeds: [new EmbedBuilder().setColor(0x00CED1)
            .setTitle(`📊 Poll: ${parts[0]}`).setDescription(parts.slice(1).map((o, i) => `${emojis[i]} ${o}`).join('\n'))
            .setFooter({ text: `Poll by ${message.author.tag}` }).setTimestamp()] });
        for (let i = 0; i < Math.min(parts.length - 1, 10); i++) await msg2.react(emojis[i]).catch(() => {});
        return;
    }

    // --------------------------------------------------
    // ×botstats
    // --------------------------------------------------
    if (command === 'botstats') {
        const up = process.uptime();
        const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = Math.floor(up % 60);
        return reply(`🤖 **SOLDIER²** | ⏱️ **${h}h ${m}m ${s}s** | 🏠 **${client.guilds.cache.size}** servers | 💾 **${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB** | 📡 **${client.ws.ping}ms**`);
    }

    // --------------------------------------------------
    // ×botinfo
    // --------------------------------------------------
    if (command === 'botinfo') {
        const up = process.uptime();
        const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = Math.floor(up % 60);
        let totalUsers = 0; client.guilds.cache.forEach(g => totalUsers += g.memberCount);
        return reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('🤖 Bot Info — SOLDIER²')
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '⏱️ Uptime',  value: `${h}h ${m}m ${s}s`,                                 inline: true },
                { name: '🏠 Servers', value: `${client.guilds.cache.size}`,                        inline: true },
                { name: '👥 Users',   value: `${totalUsers}`,                                     inline: true },
                { name: '💾 Memory',  value: `${(process.memoryUsage().heapUsed/1024/1024).toFixed(2)} MB`, inline: true },
                { name: '📡 Ping',    value: `${client.ws.ping}ms`,                               inline: true },
                { name: '📦 Version', value: `discord.js v14`,                                    inline: true }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }
    // ── ×birthday <MM/DD> or <MM/DD/YYYY> ──
    if (command === 'birthday') {
        if (!args[0]) return reply('❌ Usage: `×birthday <MM/DD>` or `×birthday <MM/DD/YYYY>`');
        const bd = parseBirthday(args[0]);
        if (!bd) return reply('❌ Invalid date. Use `MM/DD` or `MM/DD/YYYY`.');

        if (!botData.birthdays[gid]) botData.birthdays[gid] = {};
        botData.birthdays[gid][uid] = bd;
        markDirty(); scheduleSave();

        await message.delete().catch(() => {});
        const tempMsg = await message.channel.send(
            `✅ <@${uid}> Your birthday (**${formatBirthday(bd)}**) has been registered! 🎂`
        );
        setTimeout(() => tempMsg.delete().catch(() => {}), 10000);
        return;
    }

// ── ×removebirthday ──
    if (command === 'removebirthday') {
        if (!botData.birthdays?.[gid]?.[uid])
            return reply('❌ You have no birthday registered in this server.');
        delete botData.birthdays[gid][uid];
        markDirty(); scheduleSave();
        return reply('✅ Your birthday has been removed.');
    }

// ── ×setbirthday @user <MM/DD or MM/DD/YYYY>  — Officers+ only ──
    if (command === 'setbirthday') {
        if (!isFiveStar(uid) && !isGeneral(uid) && !isOfficer(uid))
            return reply('❌ Generals and Officers only.');
        const target = message.mentions.users.first();
        if (!target)  return reply('❌ Usage: `×setbirthday @user <MM/DD>`');
        if (!args[1]) return reply('❌ Please provide a date. Example: `×setbirthday @user 07/04`');
        const bd = parseBirthday(args[1]);
        if (!bd) return reply('❌ Invalid date. Use `MM/DD` or `MM/DD/YYYY`.');

        if (!botData.birthdays[gid]) botData.birthdays[gid] = {};
        botData.birthdays[gid][target.id] = bd;
        markDirty(); scheduleSave();
        return reply(`✅ Birthday for **${target.tag}** set to **${formatBirthday(bd)}**. 🎂`);
    }

// ── ×birthdaylist — Officers+ only ──
    if (command === 'birthdaylist') {
        if (!isFiveStar(uid) && !isGeneral(uid) && !isOfficer(uid))
            return reply('❌ Generals and Officers only.');

        const guildBirthdays = botData.birthdays?.[gid];
        if (!guildBirthdays || Object.keys(guildBirthdays).length === 0)
            return reply('📋 No birthdays registered in this server yet.');

        const entries = Object.entries(guildBirthdays)
            .sort(([, a], [, b]) => a.month - b.month || a.day - b.day);

        const lines = [];
        for (const [userId, bd] of entries) {
            const member = await message.guild.members.fetch(userId).catch(() => null);
            const name   = member ? member.user.tag : 'Unknown User';
            lines.push(`• **${name}** (${userId}) — ${formatBirthday(bd)}`);
        }

        const chunks = [];
        for (let i = 0; i < lines.length; i += 20)
            chunks.push(lines.slice(i, i + 20));

        for (let i = 0; i < chunks.length; i++) {
            const embed = new EmbedBuilder()
                .setColor(0xFF69B4)
                .setTitle(`🎂 Birthday List — ${message.guild.name} (${i + 1}/${chunks.length})`)
                .setDescription(chunks[i].join('\n'))
                .setFooter({ text: `${entries.length} total birthdays` })
                .setTimestamp();
            await message.channel.send({ embeds: [embed] });
        }
        return;
    }
    //BIRTHDAY COMMANDS\\
// ── ×setbirthdaychannel <channelID> — Enlisted and above ──
    if (command === 'setbirthdaychannel') {
        if (!isFiveStar(uid) && !isGeneral(uid) && !isOfficer(uid) && !isCSM(gid, uid) && !isEnlisted(gid, uid))
            return reply('❌ You do not have permission to use this command.');
        if (!args[0]) return reply('❌ Usage: `×setbirthdaychannel <channelID>`');
        const ch = message.guild.channels.cache.get(args[0]);
        if (!ch)  return reply('❌ Channel not found. Make sure the ID is correct.');

        botData.birthdayChannels[gid] = args[0];
        markDirty(); scheduleSave();
        return reply(`✅ Birthday announcements will be posted in <#${args[0]}>.`);
    }

// ── ×disablebirthdays — Enlisted and above ──
    if (command === 'disablebirthdays') {
        if (!isFiveStar(uid) && !isGeneral(uid) && !isOfficer(uid) && !isCSM(gid, uid) && !isEnlisted(gid, uid))
            return reply('❌ You do not have permission to use this command.');
        botData.birthdayEnabled[gid] = false;
        markDirty(); scheduleSave();
        return reply('✅ Birthday announcements have been **disabled** for this server.');
    }

// ── ×enablebirthdays — Enlisted and above ──
    if (command === 'enablebirthdays') {
        if (!isFiveStar(uid) && !isGeneral(uid) && !isOfficer(uid) && !isCSM(gid, uid) && !isEnlisted(gid, uid))
            return reply('❌ You do not have permission to use this command.');
        botData.birthdayEnabled[gid] = true;
        markDirty(); scheduleSave();
        return reply('✅ Birthday announcements have been **enabled** for this server.');
    }

// ── ×setbirthdaymessage <#hexColor> <message> — Enlisted and above ──
//    Example: ×setbirthdaymessage #FF69B4 Happy Birthday {user}! 🎉
    if (command === 'setbirthdaymessage') {
        if (!isFiveStar(uid) && !isGeneral(uid) && !isOfficer(uid) && !isCSM(gid, uid) && !isEnlisted(gid, uid))
            return reply('❌ You do not have permission to use this command.');
        if (args.length < 2)
            return reply('❌ Usage: `×setbirthdaymessage <#hexColor> <message>`\nUse `{user}` as a placeholder. Example: `×setbirthdaymessage #FF69B4 Happy Birthday {user}! 🎉`');

        const colorInt = parseInt(args[0].replace('#', ''), 16);
        if (isNaN(colorInt)) return reply('❌ Invalid hex color. Example: `#FF69B4`');

        const customMsg = args.slice(1).join(' ');
        if (!botData.birthdayConfig[gid]) botData.birthdayConfig[gid] = {};
        botData.birthdayConfig[gid].color   = colorInt;
        botData.birthdayConfig[gid].message = customMsg;
        markDirty(); scheduleSave();

        const embed = buildBirthdayEmbed(client, gid, `<@${uid}>`);
        return reply({ content: '✅ Birthday message updated! Here\'s a preview:', embeds: [embed] });
    }

// ── ×testbirthday — preview embed, no ping ──
    if (command === 'testbirthday') {
        const embed = buildBirthdayEmbed(client, gid, '**[Birthday Person]**');
        return reply({ content: '🎂 Birthday embed preview:', embeds: [embed] });
    }


    // =========================================================
    //  VERIFICATION
    // =========================================================

    // --------------------------------------------------
    // ×verify / ×unverify / ×setverifyrole
    // --------------------------------------------------
    if (command === 'verify') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×verify @user`');
        const vrole = botData.verifyRoles?.[gid];
        if (!vrole) return reply('❌ No verify role set. Use `×setverifyrole @role`.');
        const member = await resolveMember(message.guild, target.id);
        if (!member) return reply('❌ Member not found.');
        await member.roles.add(vrole).catch(() => {});
        return reply(`✅ <@${target.id}> verified.`);
    }
    if (command === 'unverify') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×unverify @user`');
        const vrole = botData.verifyRoles?.[gid];
        if (!vrole) return reply('❌ No verify role set.');
        const member = await resolveMember(message.guild, target.id);
        if (!member) return reply('❌ Member not found.');
        await member.roles.remove(vrole).catch(() => {});
        return reply(`✅ Verification removed from <@${target.id}>.`);
    }
    if (command === 'setverifyrole') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Roles** permission.');
        const role = message.mentions.roles.first();
        if (!role) return reply('❌ Usage: `×setverifyrole @role`');
        botData.verifyRoles[gid] = role.id;
        markDirty(); scheduleSave();
        return reply(`✅ Verify role set to **${role.name}**.`);
    }


    // =========================================================
    //  ROLE MANAGEMENT
    // =========================================================

    // --------------------------------------------------
    // ×giverole / ×removerole / ×createrole / ×deleterole / ×rolecolor
    // --------------------------------------------------
    if (command === 'giverole') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Roles** permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        const role   = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
        if (!target || !role) return reply('❌ Usage: `×giverole @user @role`');
        const member = await resolveMember(message.guild, target.id);
        if (!member) return reply('❌ Member not found.');
        await member.roles.add(role).catch(() => {});
        return reply(`✅ Gave <@&${role.id}> to <@${target.id}>.`);
    }
    if (command === 'removerole') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Roles** permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        const role   = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
        if (!target || !role) return reply('❌ Usage: `×removerole @user @role`');
        const member = await resolveMember(message.guild, target.id);
        if (!member) return reply('❌ Member not found.');
        await member.roles.remove(role).catch(() => {});
        return reply(`✅ Removed <@&${role.id}> from <@${target.id}>.`);
    }
    if (command === 'createrole') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isFiveStar(uid))
            return reply('❌ You need **Manage Roles** permission.');
        if (!args[0]) return reply('❌ Usage: `×createrole <n> [#hexcolor]`');
        const color = args[1] ? parseInt(args[1].replace('#', ''), 16) : undefined;
        const role  = await message.guild.roles.create({ name: args[0], color }).catch(() => null);
        return reply(role ? `✅ Created role **${role.name}** (\`${role.id}\`).` : '❌ Failed to create role.');
    }
    if (command === 'deleterole') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isFiveStar(uid))
            return reply('❌ You need **Manage Roles** permission.');
        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
        if (!role) return reply('❌ Usage: `×deleterole @role`');
        await role.delete().catch(() => {});
        return reply(`✅ Deleted role **${role.name}**.`);
    }
    if (command === 'rolecolor') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isFiveStar(uid))
            return reply('❌ You need **Manage Roles** permission.');
        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
        const hex  = args[message.mentions.roles.size ? 1 : 1];
        if (!role || !hex) return reply('❌ Usage: `×rolecolor @role <#hexcolor>`');
        await role.setColor(parseInt(hex.replace('#', ''), 16)).catch(() => {});
        return reply(`✅ Role **${role.name}** color updated.`);
    }


    // =========================================================
    //  NICK MANAGEMENT
    // =========================================================

    // --------------------------------------------------
    // ×nick / ×resetnick
    // --------------------------------------------------
    if (command === 'nick') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Nicknames** permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×nick @user <nickname>`');
        const nick   = args.slice(1).join(' ');
        if (!nick) return reply('❌ Please provide a nickname.');
        const member = await resolveMember(message.guild, target.id);
        if (!member) return reply('❌ Member not found.');
        await member.setNickname(nick).catch(() => {});
        return reply(`✅ Nickname set to **${nick}** for <@${target.id}>.`);
    }
    if (command === 'resetnick') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Nicknames** permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×resetnick @user`');
        const member = await resolveMember(message.guild, target.id);
        if (!member) return reply('❌ Member not found.');
        await member.setNickname(null).catch(() => {});
        return reply(`✅ Nickname reset for <@${target.id}>.`);
    }


    // =========================================================
    //  STAFF MANAGEMENT
    // =========================================================

    // --------------------------------------------------
    // ×stafflist / ×staffadd / ×staffremove / ×duty / ×onduty
    // --------------------------------------------------
    if (command === 'stafflist') {
        const staff = botData.staffList?.[gid] || {};
        if (!Object.keys(staff).length) return reply('❌ No staff registered.');
        const lines = Object.entries(staff).map(([id]) => {
            const rank = getHighestRank(gid, id) || 'Staff';
            const duty = botData.dutyStatus?.[gid]?.[id] ? '🟢 On Duty' : '🔴 Off Duty';
            return `• <@${id}> — **${rank}** ${duty}`;
});
        return reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle(`👮 Staff List — ${message.guild.name}`)
            .setDescription(lines.join('\n')).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }
    if (command === 'staffadd') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×staffadd @user`');
        if (!botData.staffList[gid]) botData.staffList[gid] = {};
        botData.staffList[gid][target.id] = { addedBy: uid, addedAt: Date.now() };
        markDirty(); scheduleSave();
        return reply(`✅ <@${target.id}> added to staff list.`);
    }
    if (command === 'staffremove') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×staffremove @user`');
        if (botData.staffList?.[gid]) delete botData.staffList[gid][target.id];
        markDirty(); scheduleSave();
        return reply(`✅ <@${target.id}> removed from staff list.`);
    }
    if (command === 'duty') {
        const toggle = args[0]?.toLowerCase();
        if (!['on', 'off'].includes(toggle)) return reply('❌ Usage: `×duty on/off`');
        if (!botData.dutyStatus[gid]) botData.dutyStatus[gid] = {};
        botData.dutyStatus[gid][uid] = toggle === 'on';
        markDirty(); scheduleSave();
        return reply(toggle === 'on' ? '🟢 You are now **On Duty**.' : '🔴 You are now **Off Duty**.');
    }
    if (command === 'onduty') {
        const duty   = botData.dutyStatus?.[gid] || {};
        const onDuty = Object.entries(duty).filter(([, v]) => v).map(([id]) => `• <@${id}>`);
        return reply(onDuty.length ? `🟢 **On Duty:**\n${onDuty.join('\n')}` : '❌ Nobody is currently on duty.');
    }


    // =========================================================
    //  NOTES, WATCHLIST & INVESTIGATION
    // =========================================================

    // --------------------------------------------------
    // ×note / ×notes / ×watchlist / ×unwatchlist / ×watchlistview
    // ×userlookup / ×globalhistory
    // --------------------------------------------------
    if (command === 'note') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×note @user <note>`');
        const note = args.slice(1).join(' ');
        if (!note) return reply('❌ Please provide a note.');
        if (!botData.notes[gid]) botData.notes[gid] = {};
        if (!botData.notes[gid][target.id]) botData.notes[gid][target.id] = [];
        botData.notes[gid][target.id].push({ note, by: uid, at: Date.now() });
        markDirty(); scheduleSave();
        return reply(`✅ Note added for <@${target.id}>.`);
    }
    if (command === 'notes') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×notes @user`');
        const notes = botData.notes?.[gid]?.[target.id] || [];
        if (!notes.length) return reply(`✅ No notes for <@${target.id}>.`);
        return reply({ embeds: [new EmbedBuilder().setColor(0xFFFF00).setTitle(`📝 Notes — ${target.tag}`)
            .setDescription(notes.map((n, i) => `**${i + 1}.** ${n.note} *(by <@${n.by}>)*`).join('\n'))
            .setFooter({ text: `${notes.length} note(s)` }).setTimestamp()] });
    }
    if (command === 'watchlist') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×watchlist @user <reason>`');
        const reason = args.slice(1).join(' ') || 'No reason';
        if (!botData.watchlist[gid]) botData.watchlist[gid] = {};
        botData.watchlist[gid][target.id] = { reason, by: uid, at: Date.now() };
        markDirty(); scheduleSave();
        return reply(`👁️ <@${target.id}> added to watchlist.`);
    }
    if (command === 'unwatchlist') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const target = message.mentions.users.first() || await resolveUser(client, args[0]);
        if (!target) return reply('❌ Usage: `×unwatchlist @user`');
        if (botData.watchlist?.[gid]) delete botData.watchlist[gid][target.id];
        markDirty(); scheduleSave();
        return reply(`✅ <@${target.id}> removed from watchlist.`);
    }
    if (command === 'watchlistview') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const list = Object.entries(botData.watchlist?.[gid] || {});
        if (!list.length) return reply('✅ No users on watchlist.');
        return reply({ embeds: [new EmbedBuilder().setColor(0xFF6600).setTitle(`👁️ Watchlist — ${message.guild.name}`)
            .setDescription(list.map(([id, d]) => `• <@${id}> — ${d.reason} *(by <@${d.by}>)*`).join('\n'))
            .setFooter({ text: `${list.length} watched user(s)` }).setTimestamp()] });
    }
    if (command === 'userlookup') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const tgtId  = args[0];
        if (!tgtId) return reply('❌ Usage: `×userlookup <userID>`');
        const target = await client.users.fetch(tgtId).catch(() => null);
        const genRank = getGeneralRank(tgtId), offRank = getOfficerRank(tgtId);
        let totalWarns = 0;
        for (const g of Object.values(botData.warnings || {})) totalWarns += g[tgtId]?.length || 0;
        return reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle(`🔎 User Lookup — ${target?.tag || tgtId}`)
            .setThumbnail(target?.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🆔 ID',             value: tgtId,                                                         inline: true },
                { name: '🎖️ General Rank',   value: genRank || 'None',                                            inline: true },
                { name: '🎖️ Officer Rank',   value: offRank || 'None',                                            inline: true },
                { name: '⚠️ Total Warnings', value: `${totalWarns}`,                                              inline: true },
                { name: '🚩 Flagged',         value: botData.flaggedUsers?.[tgtId] ? `Yes — ${botData.flaggedUsers[tgtId].reason}` : 'No', inline: true },
                { name: '🔍 Tracked',         value: botData.trackedUsers?.[tgtId] ? 'Yes' : 'No',                inline: true }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }
    if (command === 'globalhistory') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const tgtId = args[0];
        if (!tgtId) return reply('❌ Usage: `×globalhistory <userID>`');
        const cases = [];
        for (const [guildId, data] of Object.entries(botData.modlog || {}))
            (data.cases?.filter(c => c.userId === tgtId) || []).forEach(c => cases.push({ ...c, guildId }));
        if (!cases.length) return reply(`✅ No global mod history for \`${tgtId}\`.`);
        return reply({ embeds: [new EmbedBuilder().setColor(0xFF6600).setTitle(`📋 Global Mod History — \`${tgtId}\``)
            .setDescription(cases.slice(-20).map(c => `**[${c.type}]** ${c.reason} — Server: \`${c.guildId}\``).join('\n'))
            .setFooter({ text: `${cases.length} total cases` }).setTimestamp()] });
    }

    // =========================================================
    //  GOLD COINS & XP SYSTEM
    // =========================================================

    // --------------------------------------------------
    // ×balance [@user]
    // --------------------------------------------------
    if (command === 'balance') {
        const target = message.mentions.users.first() || message.author;
        const balance = getUserBalance(target.id);
        const isGlobal = isGlobalXPUser(target.id);
        const xpData = getUserXPData(isGlobal ? 'GLOBAL' : gid, target.id);
        const xpNeeded = xpData.level * XP_PER_LEVEL;
        const xpProgress = xpData.xp % XP_PER_LEVEL;
        
        return reply({ embeds: [new EmbedBuilder().setColor(0xFFD700)
            .setTitle(`${GOLD_SYMBOL} Wallet — ${target.username}`)
            .addFields(
                { name: `${GOLD_SYMBOL} Gold Coins`, value: `**${balance.toLocaleString()}**`, inline: true },
                { name: `${XP_SYMBOL} Level`, value: `**${xpData.level}**`, inline: true },
                { name: `${PRESTIGE_SYMBOL} Prestige`, value: `**${xpData.prestige}**`, inline: true },
                { name: '📊 XP Progress', value: `\`${xpProgress}/${XP_PER_LEVEL}\``, inline: false },
                { name: '🌍 XP Type', value: isGlobal ? '**Global** (All Servers)' : `**Per-Server** (${message.guild.name})`, inline: false }
            ).setThumbnail(target.displayAvatarURL()).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }

    // --------------------------------------------------
    // ×richest [server|global]
    // --------------------------------------------------
    if (command === 'richest') {
        const scope = args[0]?.toLowerCase() || 'server';
        if (!['server', 'global'].includes(scope)) return reply('❌ Usage: `×richest [server|global]`');
        
        const lb = scope === 'global' ? getGlobalLeaderboard('coins', 15) : getServerLeaderboard(gid, 'coins', 15);
        if (!lb.length) return reply('❌ No currency data yet.');
        
        const desc = lb.map((e, i) => `${i + 1}. <@${e.userId}> — **${e.balance.toLocaleString()}** ${GOLD_SYMBOL}`).join('\n');
        return reply({ embeds: [new EmbedBuilder().setColor(0xFFD700)
            .setTitle(`${GOLD_SYMBOL} Richest Players — ${scope === 'global' ? 'Global' : message.guild.name}`)
            .setDescription(desc)
            .setTimestamp().setFooter({ text: `SOLDIER² — Top 15 ${scope}` })] });
    }

    // --------------------------------------------------
    // ×levels [server|global]
    // --------------------------------------------------
    if (command === 'levels') {
        const scope = args[0]?.toLowerCase() || 'server';
        if (!['server', 'global'].includes(scope)) return reply('❌ Usage: `×levels [server|global]`');
        
        const lb = scope === 'global' ? getGlobalLeaderboard('level', 15) : getServerLeaderboard(gid, 'level', 15);
        if (!lb.length) return reply('❌ No XP data yet.');
        
        const desc = lb.map((e, i) => {
            if (scope === 'global') {
                return `${i + 1}. <@${e.userId}> — ${PRESTIGE_SYMBOL} **${e.totalPrestige}** | Level **${e.maxLevel}**`;
    }
            return `${i + 1}. <@${e.userId}> — ${PRESTIGE_SYMBOL} **${e.prestige}** | Level **${e.level}**`;
        }).join('\n');
        
        return reply({ embeds: [new EmbedBuilder().setColor(0xFF6900)
            .setTitle(`${XP_SYMBOL} Top Players — ${scope === 'global' ? 'Global' : message.guild.name}`)
            .setDescription(desc)
            .setTimestamp().setFooter({ text: `SOLDIER² — Top 15 ${scope}` })] });
    }

    // --------------------------------------------------
    // ×prestige — User initiates prestige (Level 100 only)
    // --------------------------------------------------
    if (command === 'prestige') {
        const isGlobal = isGlobalXPUser(uid);
        const gidToCheck = isGlobal ? 'GLOBAL' : gid;
        const result = prestigeUser(gidToCheck, uid);
        
        if (!result.success) return reply(`❌ **Cannot Prestige:** ${result.reason}`);
        
        return reply(`✨ **PRESTIGE!** Congratulations! You are now ${PRESTIGE_SYMBOL} **Prestige ${result.prestige}** Level 1!`);
    }

    // --------------------------------------------------
    // ×givecoin @user <amount> — Rank hierarchy
    // --------------------------------------------------
    if (command === 'givecoin') {
        const target = message.mentions.users.first();
        const amt = parseInt(args[1]);
        if (!target || !amt || amt < 1) return reply('❌ Usage: `×givecoin @user <amount>`');
        
        const perm = canManageCurrency(uid, target.id, gid);
        if (!perm.allowed) return reply(perm.reason);
        
        addCoins(target.id, amt);
        addModCase(gid, 'COIN_GIVE', target.id, `Gave ${amt} coins`, uid);
        return reply(`✅ Gave **${amt}** ${GOLD_SYMBOL} to <@${target.id}>`);
    }

    // --------------------------------------------------
    // ×takecoin @user <amount> — Rank hierarchy
    // --------------------------------------------------
    if (command === 'takecoin') {
        const target = message.mentions.users.first();
        const amt = parseInt(args[1]);
        if (!target || !amt || amt < 1) return reply('❌ Usage: `×takecoin @user <amount>`');
        
        const perm = canManageCurrency(uid, target.id, gid);
        if (!perm.allowed) return reply(perm.reason);
        
        const removed = removeCoins(target.id, amt);
        if (!removed) return reply(`❌ <@${target.id}> only has **${getUserBalance(target.id)}** coins.`);
        
        addModCase(gid, 'COIN_REMOVE', target.id, `Removed ${amt} coins`, uid);
        return reply(`✅ Took **${amt}** ${GOLD_SYMBOL} from <@${target.id}>`);
    }

    // --------------------------------------------------
    // ×addxp @user <amount> — Rank hierarchy
    // --------------------------------------------------
    if (command === 'addxp') {
        const target = message.mentions.users.first();
        const amt = parseInt(args[1]);
        if (!target || !amt || amt < 1) return reply('❌ Usage: `×addxp @user <amount>`');
        
        const perm = canManageCurrency(uid, target.id, gid);
        if (!perm.allowed) return reply(perm.reason);
        
        const isGlobal = isGlobalXPUser(target.id);
        const gidToUse = isGlobal ? 'GLOBAL' : gid;
        const result = addXP(gidToUse, target.id, amt);
        const xpData = getUserXPData(gidToUse, target.id);
        
        addModCase(gid, 'XP_ADD', target.id, `Added ${amt} XP`, uid);
        return reply(`✅ Added **${amt}** XP to <@${target.id}> — Now **Level ${xpData.level}** ${PRESTIGE_SYMBOL} **Prestige ${xpData.prestige}**`);
    }

    // --------------------------------------------------
    // ×removexp @user <amount> — Rank hierarchy
    // --------------------------------------------------
    if (command === 'removexp') {
        const target = message.mentions.users.first();
        const amt = parseInt(args[1]);
        if (!target || !amt || amt < 1) return reply('❌ Usage: `×removexp @user <amount>`');
        
        const perm = canManageCurrency(uid, target.id, gid);
        if (!perm.allowed) return reply(perm.reason);
        
        const isGlobal = isGlobalXPUser(target.id);
        const gidToUse = isGlobal ? 'GLOBAL' : gid;
        removeXP(gidToUse, target.id, amt);
        const xpData = getUserXPData(gidToUse, target.id);
        
        addModCase(gid, 'XP_REMOVE', target.id, `Removed ${amt} XP`, uid);
        return reply(`✅ Removed **${amt}** XP from <@${target.id}> — Now **Level ${xpData.level}** ${PRESTIGE_SYMBOL} **Prestige ${xpData.prestige}**`);
    }

    // --------------------------------------------------
    // ×resetxp @user — Rank hierarchy
    // --------------------------------------------------
    if (command === 'resetxp') {
        const target = message.mentions.users.first();
        if (!target) return reply('❌ Usage: `×resetxp @user`');
        
        const perm = canManageCurrency(uid, target.id, gid);
        if (!perm.allowed) return reply(perm.reason);
        
        const isGlobal = isGlobalXPUser(target.id);
        resetXP(isGlobal ? 'GLOBAL' : gid, target.id);
        
        addModCase(gid, 'XP_RESET', target.id, 'XP reset', uid);
        return reply(`✅ Reset XP for <@${target.id}>`);
    }

    // --------------------------------------------------
    // ×setlevelupchannel #channel
    // --------------------------------------------------
    if (command === 'setlevelupchannel') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Server** permission.');
        
        const ch = message.mentions.channels.first();
        if (!ch) return reply('❌ Usage: `×setlevelupchannel #channel`');
        
        botData.levelupChannels[gid] = ch.id;
        markDirty(); scheduleSave();
        return reply(`✅ Level-up announcements will be sent to <#${ch.id}>.`);
    }

    // --------------------------------------------------
    // ×howtoearnxp — Show how to earn XP
    // --------------------------------------------------
    if (command === 'howtoearnxp') {
        const isGlobal = isGlobalXPUser(uid);
        return reply({ embeds: [new EmbedBuilder().setColor(0xFF6900)
            .setTitle(`${XP_SYMBOL} How to Earn XP`)
            .addFields(
                { name: '📝 By Sending Messages', value: `**5 XP** per message (10 second cooldown)\nRegular users and enlisted earn **per-server**\n${isGlobal ? `*You earn **global XP** (${PRESTIGE_SYMBOL} Owner/General/Officer)*` : ''}`, inline: false },
                { name: '⬆️ Leveling System', value: `Each level requires **${XP_PER_LEVEL} XP**\nMax level: **${MAX_LEVEL}**\nMax prestige: **${MAX_PRESTIGE}**\n\nEach level grants **50 × level coins**\nExample: Level 10 = 500 coins`, inline: false },
                { name: `${PRESTIGE_SYMBOL} Prestige System`, value: `Reach Level ${MAX_LEVEL} to prestige!\nReset to Level 1\nEarn **500 × prestige coins**\nMax: **${MAX_PRESTIGE}** times`, inline: false },
                { name: '🎯 XP Scope', value: isGlobal ? `**Your XP:** Global (across all servers)\n*Only Owners, Generals, Officers get global XP*` : `**Your XP:** Per-Server\n**This Server:** ${message.guild.name}\nEnlisted & regular users earn per-server XP`, inline: false },
                { name: '💰 Earning Coins', value: `Gain coins by:\n• Leveling up (**automatic**)\n• Commands from staff (+rewards)\n• Prestige milestones`, inline: false }
            ).setTimestamp().setFooter({ text: 'SOLDIER² — Keep grinding!' })] });
    }

    // =========================================================
    //  REACTION ROLES
    // =========================================================

    // --------------------------------------------------
    // ×reactionrole <emoji> <@role|roleID|roleName> [emoji2] [@role2|roleID|roleName]...
    // --------------------------------------------------
    if (command === 'reactionrole') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isStaff(gid, uid) && !isFiveStar(uid))
            return reply('❌ You need **Manage Roles** permission.');
        
        if (args.length < 2 || args.length % 2 !== 0) 
            return reply('❌ Usage: `×reactionrole <emoji> <@role|roleID|roleName> [emoji2] [@role2|roleID|roleName]...`\n\n**Examples:**\n`×reactionrole 🎮 @Gamer 🎨 @Artist`\n`×reactionrole 🎮 1234567890 🎨 Artist`');
        
        // Parse emoji-role pairs
        const pairs = [];
        for (let i = 0; i < args.length; i += 2) {
            const emoji = args[i];
            const roleArg = args[i + 1];
            let role = null;
            
            // Try to get role by mention
            role = message.mentions.roles.first();
            
            // Try to get role by ID
            if (!role) {
                role = message.guild.roles.cache.get(roleArg.replace(/[<@&>]/g, ''));
    }
            
            // Try to get role by name (case-insensitive)
            if (!role) {
                role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase());
    }
            
            if (!role) return reply(`❌ Role not found: **${roleArg}**. Use @role, roleID, or role name.`);
            if (role.managed) return reply(`❌ Cannot use managed role **${role.name}**.`);
            if (role.position >= message.member.roles.highest.position && !isFiveStar(uid)) 
                return reply(`❌ Role **${role.name}** is too high in hierarchy.`);
            
            pairs.push({ emoji, roleId: role.id, roleName: role.name });
    }
        
        // Build embed
        const roleList = pairs.map(p => `${p.emoji} — **${p.roleName}**`).join('\n');
        const embed = new EmbedBuilder()
            .setColor(0x7521FC)
            .setTitle('✨ Reaction Roles')
            .setDescription(`React below to receive a role!\n\n${roleList}`)
            .setImage('https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif')
            .setTimestamp()
            .setFooter({ text: 'SOLDIER² — React to get your role!' });
        
        // Send the embed message
        const sentMessage = await message.channel.send({ embeds: [embed] }).catch(() => null);
        
        if (!sentMessage) return reply('❌ Failed to send reaction role message.');
        
        // Add reactions
        for (const pair of pairs) {
            await sentMessage.react(pair.emoji).catch(() => {});
    }
        
        // Store in database
        for (const pair of pairs) {
            addReactionRole(gid, sentMessage.id, pair.emoji, pair.roleId);
    }
        
        // Delete user's command
        await message.delete().catch(() => {});
        
        return;
    }


    // =========================================================
    //  REMOTE SERVER CONTROL — Generals/Owner only 
    // =========================================================

    if (command === 'serverlist') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const guilds = client.guilds.cache.map(g => `• **${g.name}** | ID: \`${g.id}\` | Members: **${g.memberCount}**`);
        return reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('🌐 Bot Server List')
            .setDescription(guilds.join('\n').slice(0, 4000)).setFooter({ text: `${guilds.length} servers` }).setTimestamp()] });
    }
    if (command === 'remotekick') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const [srvId, tgtId, ...rArr] = args;
        if (!srvId || !tgtId) return reply('❌ Usage: `×remotekick <serverID> <userID> [reason]`');
        const srv = client.guilds.cache.get(srvId);
        if (!srv) return reply('❌ Server not found.');
        const check = canAct(uid, tgtId, srvId);
        if (!check.allowed) return reply(check.reason);
        const mem = await srv.members.fetch(tgtId).catch(() => null);
        if (!mem) return reply('❌ Member not found in that server.');
        await mem.kick(rArr.join(' ') || 'Remote kick').catch(() => {});
        return reply(`✅ Kicked \`${tgtId}\` from **${srv.name}**.`);
    }
    if (command === 'remoteban') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const [srvId, tgtId, ...rArr] = args;
        if (!srvId || !tgtId) return reply('❌ Usage: `×remoteban <serverID> <userID> [reason]`');
        const srv = client.guilds.cache.get(srvId);
        if (!srv) return reply('❌ Server not found.');
        const check = canAct(uid, tgtId, srvId);
        if (!check.allowed) return reply(check.reason);
        await srv.members.ban(tgtId, { reason: rArr.join(' ') || 'Remote ban' }).catch(() => {});
        return reply(`✅ Banned \`${tgtId}\` from **${srv.name}**.`);
    }
    if (command === 'remoteunban') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const [srvId, tgtId] = args;
        if (!srvId || !tgtId) return reply('❌ Usage: `×remoteunban <serverID> <userID>`');
        const srv = client.guilds.cache.get(srvId);
        if (!srv) return reply('❌ Server not found.');
        await srv.members.unban(tgtId).catch(() => {});
        return reply(`✅ Unbanned \`${tgtId}\` from **${srv.name}**.`);
    }
    if (command === 'remotelockdown') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const srv = client.guilds.cache.get(args[0]);
        if (!srv) return reply('❌ Server not found.');
            for (const [, ch] of srv.channels.cache.filter(c => c.type === 0))
                await ch.permissionOverwrites.edit(srv.roles.everyone, { SendMessages: false }).catch(() => {});
        return reply(`✅ Locked all channels in **${srv.name}**.`);
    }
    if (command === 'remoteunlockdown') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const srv = client.guilds.cache.get(args[0]);
        if (!srv) return reply('❌ Server not found.');
            for (const [, ch] of srv.channels.cache.filter(c => c.type === 0))
                await ch.permissionOverwrites.edit(srv.roles.everyone, { SendMessages: null }).catch(() => {});
        return reply(`✅ Unlocked all channels in **${srv.name}**.`);
    }
    if (command === 'remotenuke') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const srv = client.guilds.cache.get(args[0]);
        if (!srv) return reply('❌ Server not found.');
        await reply(`⚠️ Remote nuking **${srv.name}**...`);
            await srv.members.fetch();
        let count = 0;
            for (const [, mem] of srv.members.cache) {
                if (mem.user.bot) continue;
                const check = canAct(uid, mem.user.id, srv.id);
                if (!check.allowed) continue;
            await mem.kick('Remote nuke').catch(() => {});
            count++;
    }
        return message.channel.send(`✅ Remote nuke complete. **${count}** members removed from **${srv.name}**.`);
    }
    if (command === 'remoteannounce') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const srvId = args[0], text = args.slice(1).join(' ');
        if (!srvId || !text) return reply('❌ Usage: `×remoteannounce <serverID> <message>`');
        const srv = client.guilds.cache.get(srvId);
        if (!srv) return reply('❌ Server not found.');
            const ch = srv.systemChannel || srv.channels.cache.filter(c => c.type === 0 && c.permissionsFor(srv.members.me).has('SendMessages')).first();
        if (!ch) return reply('❌ No suitable channel found.');
        await ch.send({ embeds: [new EmbedBuilder().setColor(0xFF6600).setTitle('📢 Remote Announcement').setDescription(text).setFooter({ text: `From: ${message.author.tag}` }).setTimestamp()] });
        return reply(`✅ Announcement sent to **${srv.name}**.`);
    }
    if (command === 'servermembers') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const srv = client.guilds.cache.get(args[0]);
        if (!srv) return reply('❌ Server not found.');
            await srv.members.fetch();
        const members = srv.members.cache.filter(m => !m.user.bot).map(m => `• ${m.user.tag} (\`${m.user.id}\`)`);
        return reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle(`👥 Members — ${srv.name}`)
            .setDescription(members.slice(0, 50).join('\n') + (members.length > 50 ? `\n...and ${members.length - 50} more` : ''))
            .setFooter({ text: `${members.length} human members` }).setTimestamp()] });
    }
    if (command === 'serverleave') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        const srv = client.guilds.cache.get(args[0]);
        if (!srv) return reply('❌ Server not found.');
        const name = srv.name;
        await srv.leave().catch(() => {});
        return reply(`✅ Left **${name}**.`);
    }


    // =========================================================
    //  SURVEILLANCE — Generals/Owner only
    // =========================================================

    if (command === 'flaguser') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const tgtId = args[0], reason = args.slice(1).join(' ');
        if (!tgtId || !reason) return reply('❌ Usage: `×flaguser <userID> <reason>`');
        botData.flaggedUsers[tgtId] = { reason, by: uid, at: Date.now() };
        markDirty(); scheduleSave();
        return reply(`🚩 User \`${tgtId}\` globally flagged.`);
    }
    if (command === 'unflaguser') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        if (!args[0]) return reply('❌ Usage: `×unflaguser <userID>`');
        delete botData.flaggedUsers[args[0]];
        markDirty(); scheduleSave();
        return reply(`✅ Flag removed from \`${args[0]}\`.`);
    }
        if (command === 'flaggedlist') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const flagged = Object.entries(botData.flaggedUsers || {});
        if (!flagged.length) return reply('✅ No flagged users.');
        return reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('🚩 Globally Flagged Users')
            .setDescription(flagged.map(([id, d]) => `• \`${id}\` — ${d.reason} *(by <@${d.by}>)*`).join('\n'))
            .setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }
    if (command === 'trackuser') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        if (!args[0]) return reply('❌ Usage: `×trackuser <userID>`');
        botData.trackedUsers[args[0]] = { by: uid, at: Date.now() };
        markDirty(); scheduleSave();
        return reply(`🔍 Now tracking \`${args[0]}\`. You will be DM'd when they send messages.`);
    }
    if (command === 'untrackuser') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        if (!args[0]) return reply('❌ Usage: `×untrackuser <userID>`');
        delete botData.trackedUsers[args[0]];
        markDirty(); scheduleSave();
        return reply(`✅ Stopped tracking \`${args[0]}\`.`);
    }
    if (command === 'tracklist') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const tracked = Object.entries(botData.trackedUsers || {});
        if (!tracked.length) return reply('✅ No tracked users.');
        return reply(`🔍 **Tracked users:** ${tracked.map(([id]) => `\`${id}\``).join(', ')}`);
    }
    if (command === 'crosswarn') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const tgtId = args[0], reason = args.slice(1).join(' ');
        if (!tgtId || !reason) return reply('❌ Usage: `×crosswarn <userID> <reason>`');
        let count = 0;
        for (const [guildId] of client.guilds.cache) {
            if (!botData.warnings[guildId]) botData.warnings[guildId] = {};
            if (!botData.warnings[guildId][tgtId]) botData.warnings[guildId][tgtId] = [];
            botData.warnings[guildId][tgtId].push({ id: botData.warnings[guildId][tgtId].length + 1, reason, by: uid, at: Date.now() });
            count++;
    }
        markDirty(); scheduleSave();
        return reply(`✅ Cross-warned \`${tgtId}\` across **${count}** servers.`);
    }


    // =========================================================
    //  GLOBAL ACTIONS — Generals/Owner only
    // =========================================================

    if (command === 'globalban') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const tgtId = args[0], reason = args.slice(1).join(' ') || 'Global ban';
        if (!tgtId) return reply('❌ Usage: `×globalban <userID> [reason]`');
        let count = 0;
        for (const [, guild] of client.guilds.cache) { await guild.members.ban(tgtId, { reason }).catch(() => {}); count++; }
        return reply(`✅ Banned \`${tgtId}\` from **${count}** servers.`);
    }
    if (command === 'globalunban') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        if (!args[0]) return reply('❌ Usage: `×globalunban <userID>`');
        let count = 0;
        for (const [, guild] of client.guilds.cache) { await guild.members.unban(args[0]).catch(() => {}); count++; }
        return reply(`✅ Unbanned \`${args[0]}\` from **${count}** servers.`);
    }
    if (command === 'globalannounce') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const text = args.join(' ');
        if (!text) return reply('❌ Usage: `×globalannounce <message>`');
        let count = 0;
        for (const [, guild] of client.guilds.cache) {
            const ch = guild.systemChannel || guild.channels.cache.filter(c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages')).first();
            if (ch) { await ch.send({ embeds: [new EmbedBuilder().setColor(0xFF6600).setTitle('📢 Global Announcement').setDescription(text).setTimestamp()] }); count++; }
    }
        return reply(`✅ Announced to **${count}** servers.`);
    }
    if (command === 'globaldm') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const tgtId = args[0], text = args.slice(1).join(' ');
        if (!tgtId || !text) return reply('❌ Usage: `×globaldm <userID> <message>`');
        const target = await client.users.fetch(tgtId).catch(() => null);
        if (!target) return reply('❌ User not found.');
        await target.send(text).catch(() => {});
        return reply(`✅ DM sent to **${target.tag}**.`);
    }
    if (command === 'massdm') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const srvId = args[0], text = args.slice(1).join(' ');
        if (!srvId || !text) return reply('❌ Usage: `×massdm <serverID> <message>`');
        const srv = client.guilds.cache.get(srvId);
        if (!srv) return reply('❌ Server not found.');
            await srv.members.fetch();
        let count = 0;
        for (const [, mem] of srv.members.cache) { if (!mem.user.bot) { await mem.send(text).catch(() => {}); count++; } }
        return reply(`✅ DM sent to **${count}** members in **${srv.name}**.`);
    }
    if (command === 'broadcast') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const text = args.join(' ');
        if (!text) return reply('❌ Usage: `×broadcast <message>`');
        let count = 0;
        for (const [, srv] of client.guilds.cache) {
            const ch = srv.systemChannel || srv.channels.cache.filter(c => c.type === 0 && c.permissionsFor(srv.members.me).has('SendMessages')).first();
            if (ch) { await ch.send(text).catch(() => {}); count++; }
    }
        return reply(`✅ Broadcast sent to **${count}** servers.`);
    }


    // =========================================================
    //  RANK SYSTEM CONTROL — Generals/Owner only
    // =========================================================

    if (command === 'rankaudit') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        if (args[0]) {
        const srv = client.guilds.cache.get(args[0]);
        if (!srv) return reply('❌ Server not found.');
            return reply({ embeds: [buildServerRankEmbed(args[0], srv.name)] });
    }
        return reply({ embeds: [buildGlobalRankEmbed()] });
    }
    if (command === 'rankwipe') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        if (!args[0]) return reply('❌ Usage: `×rankwipe <serverID>`');
        delete botData.enlisted[args[0]];
        markDirty(); scheduleSave();
        return reply(`✅ All enlisted ranks wiped from server \`${args[0]}\`.`);
    }
    if (command === 'globalrankwipe') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        botData.generals = {}; botData.officers = {}; botData.enlisted = {};
        markDirty(); scheduleSave();
        return reply('✅ All ranks globally wiped.');
    }
    if (command === 'rankreport') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const genCount = Object.keys(botData.generals || {}).length;
        const offCount = Object.keys(botData.officers || {}).length;
        let enlCount   = 0;
        for (const g of Object.values(botData.enlisted || {})) enlCount += Object.keys(g).length;
        return reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('📊 Global Rank Report')
            .addFields(
                { name: `${SYM_GENERAL} Generals`, value: `${genCount}`, inline: true },
                { name: `${SYM_OFFICER} Officers`,  value: `${offCount}`, inline: true },
                { name: `${SYM_ENLISTED} Enlisted`, value: `${enlCount}`, inline: true },
                { name: '📋 Total Ranked',          value: `${genCount + offCount + enlCount}`, inline: true },
                { name: '🏠 Servers',               value: `${client.guilds.cache.size}`, inline: true }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }


    // =========================================================
    //  GLOBAL ANALYTICS — Generals/Owner only
    // =========================================================

    if (command === 'globalstats') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        let totalUsers = 0, totalWarns = 0, totalCases = 0;
        client.guilds.cache.forEach(g => totalUsers += g.memberCount);
        for (const g of Object.values(botData.warnings || {})) for (const w of Object.values(g)) totalWarns += w.length;
        for (const g of Object.values(botData.modlog   || {})) totalCases += g.cases?.length || 0;
        return reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('📊 Global Stats — SOLDIER²')
            .addFields(
                { name: '🏠 Servers',     value: `${client.guilds.cache.size}`, inline: true },
                { name: '👥 Total Users', value: `${totalUsers}`,               inline: true },
                { name: '⚠️ Warnings',   value: `${totalWarns}`,               inline: true },
                { name: '📋 Cases',       value: `${totalCases}`,               inline: true }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }
    if (command === 'topservers') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const sorted = [...client.guilds.cache.values()].sort((a, b) => b.memberCount - a.memberCount);
        return reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('🏆 Top Servers by Member Count')
            .setDescription(sorted.slice(0, 20).map((g, i) => `**${i + 1}.** ${g.name} — **${g.memberCount}** members | \`${g.id}\``).join('\n'))
            .setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }
    if (command === 'serverstats') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        const srv = args[0] ? client.guilds.cache.get(args[0]) : message.guild;
        if (!srv) return reply('❌ Server not found.');
        const cases  = botData.modlog?.[srv.id]?.cases?.length || 0;
        let warns    = 0;
        for (const w of Object.values(botData.warnings?.[srv.id] || {})) warns += w.length;
        return reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle(`📊 Server Stats — ${srv.name}`)
            .addFields(
                { name: '👥 Members',   value: `${srv.memberCount}`,                   inline: true },
                { name: '📢 Channels',  value: `${srv.channels.cache.size}`,           inline: true },
                { name: '🎭 Roles',     value: `${srv.roles.cache.size}`,              inline: true },
                { name: '⚠️ Warnings', value: `${warns}`,                             inline: true },
                { name: '📋 Cases',     value: `${cases}`,                             inline: true }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }


    // =========================================================
    //  SECURITY & EMERGENCY — Owner only
    // =========================================================

    if (command === 'nuke') {
        if (!isFiveStar(uid) && !isGeneral(uid)) return reply('❌ Generals and Owner only.');
        await reply('⚠️ **NUKE INITIATED** — Kicking all members...');
        await message.guild.members.fetch();
        let count = 0;
        for (const [, mem] of message.guild.members.cache) {
                if (mem.user.bot) continue;
            const check = canAct(uid, mem.user.id, gid);
                if (!check.allowed) continue;
            await mem.kick('Server nuke').catch(() => {});
            count++;
    }
        return message.channel.send(`✅ Nuke complete. **${count}** members removed.`);
    }
    if (command === 'nukeall') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        await reply('⚠️ **GLOBAL NUKE** — Kicking all members from all servers...');
        let total = 0;
        for (const [, srv] of client.guilds.cache) {
            await srv.members.fetch();
            for (const [, mem] of srv.members.cache) {
                if (mem.user.bot) continue;
                const check = canAct(uid, mem.user.id, srv.id);
                if (!check.allowed) continue;
                await mem.kick('Global nuke').catch(() => {});
                total++;
    }
    }
        return message.channel.send(`✅ Global nuke complete. **${total}** members removed.`);
    }
    if (command === 'emergency') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        const srv = client.guilds.cache.get(args[0]);
        if (!srv) return reply('❌ Usage: `×emergency <serverID>`');
        await reply(`🚨 Activating emergency in **${srv.name}**...`);
            for (const [, ch] of srv.channels.cache.filter(c => c.type === 0))
                await ch.permissionOverwrites.edit(srv.roles.everyone, { SendMessages: false }).catch(() => {});
            await srv.members.fetch();
            for (const [, mem] of srv.members.cache)
                if (!mem.user.bot) await mem.timeout(3600000, 'Emergency mode').catch(() => {});
        return message.channel.send(`✅ Emergency active in **${srv.name}**. All locked + members muted 1h.`);
    }
    if (command === 'emergencyoff') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        const srv = client.guilds.cache.get(args[0]);
        if (!srv) return reply('❌ Usage: `×emergencyoff <serverID>`');
            for (const [, ch] of srv.channels.cache.filter(c => c.type === 0))
                await ch.permissionOverwrites.edit(srv.roles.everyone, { SendMessages: null }).catch(() => {});
            await srv.members.fetch();
            for (const [, mem] of srv.members.cache)
                if (!mem.user.bot) await mem.timeout(null).catch(() => {});
        return reply(`✅ Emergency lifted in **${srv.name}**.`);
    }
    if (command === 'emergencyall') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        await reply('🚨 Activating emergency across ALL servers...');
        for (const [, srv] of client.guilds.cache) {
            for (const [, ch] of srv.channels.cache.filter(c => c.type === 0))
                await ch.permissionOverwrites.edit(srv.roles.everyone, { SendMessages: false }).catch(() => {});
            await srv.members.fetch();
            for (const [, mem] of srv.members.cache)
                if (!mem.user.bot) await mem.timeout(3600000, 'Emergency mode').catch(() => {});
    }
        return message.channel.send(`✅ Emergency active in **${client.guilds.cache.size}** servers.`);
    }
    if (command === 'emergencyoffall') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        await reply('🔓 Lifting emergency across ALL servers...');
        for (const [, srv] of client.guilds.cache) {
            for (const [, ch] of srv.channels.cache.filter(c => c.type === 0))
                await ch.permissionOverwrites.edit(srv.roles.everyone, { SendMessages: null }).catch(() => {});
            await srv.members.fetch();
            for (const [, mem] of srv.members.cache)
                if (!mem.user.bot) await mem.timeout(null).catch(() => {});
    }
        return message.channel.send('✅ Emergency lifted in all servers.');
    }


    // =========================================================
    //  BOT MANAGEMENT — Owner only
    // =========================================================

    if (command === 'botstatus') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        const text = args.join(' ');
        if (!text) return reply('❌ Usage: `×botstatus <text>`');
        client.user.setActivity(text);
        return reply(`✅ Status set to **${text}**.`);
    }
    if (command === 'botavatar') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        if (!args[0]) return reply('❌ Usage: `×botavatar <imageURL>`');
        await client.user.setAvatar(args[0]).catch(() => {});
        return reply('✅ Bot avatar updated.');
    }
    if (command === 'botname') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        const name = args.join(' ');
        if (!name) return reply('❌ Usage: `×botname <n>`');
        await client.user.setUsername(name).catch(() => {});
        return reply(`✅ Bot name set to **${name}**.`);
    }
    if (command === 'restart') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        await reply('🔄 Restarting...');
        process.exit(0);
    }
    if (command === 'shutdown') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        await reply('⛔ Shutting down...');
        process.exit(1);
    }
    if (command === 'eval') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        const code = args.join(' ');
        if (!code) return reply('❌ Usage: `×eval <code>`');
        try {
            let result = eval(code);
            if (result instanceof Promise) result = await result;
            return reply(`\`\`\`js\n${String(typeof result === 'object' ? JSON.stringify(result, null, 2) : result).slice(0, 1900)}\n\`\`\``);
        } catch (e) { return reply(`\`\`\`js\nERROR: ${e.message}\n\`\`\``); }
    }
    if (command === 'blacklistuser') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        if (!args[0]) return reply('❌ Usage: `×blacklistuser <userID>`');
        botData.blacklistedUsers[args[0]] = { by: uid, at: Date.now() };
        markDirty(); scheduleSave();
        return reply(`✅ User \`${args[0]}\` blacklisted.`);
    }
    if (command === 'unblacklistuser') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        if (!args[0]) return reply('❌ Usage: `×unblacklistuser <userID>`');
        delete botData.blacklistedUsers[args[0]];
        markDirty(); scheduleSave();
        return reply(`✅ User \`${args[0]}\` removed from blacklist.`);
    }
    if (command === 'blacklistserver') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        if (!args[0]) return reply('❌ Usage: `×blacklistserver <serverID>`');
        botData.blacklistedServers[args[0]] = { by: uid, at: Date.now() };
        markDirty(); scheduleSave();
        return reply(`✅ Server \`${args[0]}\` blacklisted.`);
    }
    if (command === 'unblacklistserver') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        if (!args[0]) return reply('❌ Usage: `×unblacklistserver <serverID>`');
        delete botData.blacklistedServers[args[0]];
        markDirty(); scheduleSave();
        return reply(`✅ Server \`${args[0]}\` removed from blacklist.`);
    }
    if (command === 'blacklistedlist') {
        if (!isFiveStar(uid)) return reply('❌ Owner only.');
        const users   = Object.keys(botData.blacklistedUsers   || {});
        const servers = Object.keys(botData.blacklistedServers || {});
        return reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('🚫 Blacklist')
            .addFields(
                { name: `👤 Users (${users.length})`,     value: users.length   ? users.map(id => `\`${id}\``).join('\n')   : '*(none)*', inline: false },
                { name: `🏠 Servers (${servers.length})`, value: servers.length ? servers.map(id => `\`${id}\``).join('\n') : '*(none)*', inline: false }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }


    // =========================================================
    //  CONFIG
    // =========================================================

    if (command === 'setprefix') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isFiveStar(uid))
            return reply('❌ You need **Manage Server** permission.');
        if (!args[0]) return reply('❌ Usage: `×setprefix <prefix>`');
        botData.serverPrefixes[gid] = args[0];
        markDirty(); scheduleSave();
        return reply(`✅ Prefix changed to \`${args[0]}\` for this server.`);
    }
    if (command === 'settings') {
        if (!isStaff(gid, uid) && !isFiveStar(uid)) return reply('❌ No permission.');
        const am   = botData.automod?.[gid] || {};
        return reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle(`⚙️ Settings — ${message.guild.name}`)
            .addFields(
                { name: '⌨️ Prefix',       value: getPrefix(gid),                                        inline: true },
                { name: '📋 Log Channel',  value: botData.logChannels?.[gid]  ? `<#${botData.logChannels[gid]}>`  : 'Not set', inline: true },
                { name: '🔇 Mute Role',    value: botData.mutedRoles?.[gid]   ? `<@&${botData.mutedRoles[gid]}>`  : 'Not set', inline: true },
                { name: '✅ Verify Role',  value: botData.verifyRoles?.[gid]  ? `<@&${botData.verifyRoles[gid]}>` : 'Not set', inline: true },
                { name: '🤖 Automod',      value: am.automod    !== false ? '✅ On' : '❌ Off',                    inline: true },
                { name: '🔗 Anti-Link',    value: am.antilink   ? '✅ On' : '❌ Off',                              inline: true },
                { name: '🚨 Anti-Raid',    value: am.antiraid   ? '✅ On' : '❌ Off',                              inline: true },
                { name: '📢 Anti-Spam',    value: am.antispam   ? '✅ On' : '❌ Off',                              inline: true },
                { name: '🔠 Anti-Caps',    value: am.anticaps   ? `✅ ${am.capsPercent || 70}%`    : '❌ Off',     inline: true },
                { name: '😀 Anti-Emoji',   value: am.antiemoji  ? `✅ Max ${am.emojiLimit || 10}`  : '❌ Off',     inline: true },
                { name: '📣 Anti-Mention', value: am.antimentions ? `✅ Max ${am.mentionLimit || 5}` : '❌ Off',   inline: true },
                { name: '🚫 Bad Words',    value: `${am.badwords?.length || 0} words`,                            inline: true }
            ).setTimestamp().setFooter({ text: 'SOLDIER²' })] });
    }
    if (command === 'disable') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isFiveStar(uid))
            return reply('❌ You need **Manage Server** permission.');
        const cmd = args[0]?.toLowerCase();
        if (!cmd) return reply('❌ Usage: `×disable <command>`');
        if (!botData.disabledCommands[gid]) botData.disabledCommands[gid] = [];
        if (!botData.disabledCommands[gid].includes(cmd)) botData.disabledCommands[gid].push(cmd);
        markDirty(); scheduleSave();
        return reply(`✅ Command \`${cmd}\` disabled.`);
    }
    if (command === 'enable') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isFiveStar(uid))
            return reply('❌ You need **Manage Server** permission.');
        const cmd = args[0]?.toLowerCase();
        if (!cmd) return reply('❌ Usage: `×enable <command>`');
        if (botData.disabledCommands[gid])
            botData.disabledCommands[gid] = botData.disabledCommands[gid].filter(c => c !== cmd);
        markDirty(); scheduleSave();
        return reply(`✅ Command \`${cmd}\` re-enabled.`);
    }

// =========================================================
//  HELP COMMANDS
// =========================================================

    if (command === 'help') {
        const embed1 = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('📖 SOLDIER² — Commands (1/3)')
            .setDescription(
                `**━━━ RANK COMMANDS ━━━**\n` +
                `• \`${prefix}ranks\` — View full rank hierarchy\n` +
                `• \`${prefix}myrank\` — View your current rank\n` +
                `• \`${prefix}promote @user <rank>\` — Promote a user\n` +
                `• \`${prefix}demote @user [rank]\` — Demote a user\n` +
                `• \`${prefix}csmtransfer @user\` — Transfer CSM rank\n` +
                `• \`${prefix}globalranks\` — View global rank list *(Officers+)*\n` +
                `• \`${prefix}serverranks\` — View server rank list *(Officers+/CSM)*\n\n` +
                `**━━━ MODERATION ━━━**\n` +
                `• \`${prefix}kick @user [reason]\` — Kick a user\n` +
                `• \`${prefix}ban @user [reason]\` — Permanently ban a user\n` +
                `• \`${prefix}target\` — Autodelete user's messages\n` +
                `• \`${prefix}unban <userID>\` — Unban by ID\n` +
                `• \`${prefix}mute @user [duration] [reason]\` — Timeout a user\n` +
                `• \`${prefix}unmute @user\` — Remove timeout\n` +
                `• \`${prefix}warn @user <reason>\` — Issue a warning\n` +
                `• \`${prefix}warnings @user\` — View all warnings\n` +
                `• \`${prefix}clearwarnings @user\` — Clear all warnings\n` +
                `• \`${prefix}removewarning @user <id>\` — Remove one warning\n` +
                `• \`${prefix}softban @user [reason]\` — Ban+unban (clears messages)\n` +
                `• \`${prefix}tempban @user <duration> [reason]\` — Temp ban\n` +
                `• \`${prefix}tempmute @user <duration> [reason]\` — Temp mute\n` +
                `• \`${prefix}massban @user1 @user2...\` — Ban multiple users\n\n` +
               `**━━━ BIRTHDAYS ━━━**\n` +
                `• \`${prefix}birthday <MM/DD> or <MM/DD/YYYY>\` — Register your own birthday\n` +
               `• \`${prefix}removebirthday\` — Remove your registered birthday\n` +
               `• \`${prefix}birthdaylist\` — View all birthdays in this server *(Officers+)*\n` +
               `• \`${prefix}setbirthday @user <MM/DD> or <MM/DD/YYYY>\` — Set a birthday for someone *(Officers+)*\n` +
               `• \`${prefix}setbirthdaychannel <channelID>\` — Set the birthday announcement channel *(Enlisted+)*\n` +
               `• \`${prefix}enablebirthdays\` — Enable birthday announcements *(Enlisted+)*\n` +
               `• \`${prefix}disablebirthdays\` — Disable birthday announcements *(Enlisted+)*\n` +
               `• \`${prefix}setbirthdaymessage <#hexColor> <message>\` — Custom birthday message & color *(Enlisted+)*\n` +
               `• \`${prefix}testbirthday\` — Preview the birthday embed\n\n` +
                `**━━━ MESSAGE MANAGEMENT ━━━**\n` +
                `• \`${prefix}purge <amount>\` ��� Delete X messages\n` +
                `• \`${prefix}purgeuser @user <amount>\` — Delete user messages\n` +
                `• \`${prefix}purgebot <amount>\` — Delete bot messages\n` +
                `• \`${prefix}purgelinks <amount>\` — Delete link messages\n` +
                `• \`${prefix}lock [#channel]\` — Lock a channel\n` +
                `• \`${prefix}unlock [#channel]\` — Unlock a channel\n` +
                `• \`${prefix}slowmode <seconds>\` — Set slowmode`
            );

        const embed2 = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('📖 SOLDIER² — Commands (2/3)')
            .setDescription(
                `**━━━ USER & SERVER INFO ━━━**\n` +
                `• \`${prefix}userinfo [@user]\` — Detailed user info\n` +
                `• \`${prefix}serverinfo [serverID]\` — Server info\n` +
                `• \`${prefix}avatar [@user]\` — View avatar\n` +
                `• \`${prefix}roleinfo @role/roleID\` — Role name, ID, color, perms\n` +
                `• \`${prefix}rolelist\` — List all roles\n` +
                `• \`${prefix}membercount\` — Total members, bots, humans\n` +
                `• \`${prefix}lookup <userID>\` — Look up any user\n` +
                `• \`${prefix}joinpos @user\` — Server join position\n` +
                `• \`${prefix}newaccounts [days]\` — List new accounts\n\n` +
                `**━━━ MODERATION LOGS ━━━**\n` +
                `• \`${prefix}modlog @user\` — View mod history\n` +
                `• \`${prefix}modstats\` — Server mod stats\n` +
                `• \`${prefix}setlogchannel #channel\` — Set log channel\n` +
                `• \`${prefix}modreason <caseID> <reason>\` — Edit case reason\n\n` +
                `**━━━ SERVER PROTECTION ━━━**\n` +
                `• \`${prefix}lockdown\` — Lock ALL channels\n` +
                `• \`${prefix}unlockdown\` — Unlock all channels\n` +
                `• \`${prefix}antiraid on/off\` — Toggle anti-raid (auto-restores)\n` +
                `• \`${prefix}antispam on/off\` — Toggle anti-spam\n` +
                `• \`${prefix}antilink on/off\` — Toggle anti-link\n` +
                `• \`${prefix}anticaps <percent>\` — Auto-warn on caps %\n` +
                `• \`${prefix}antiemoji <limit>\` — Limit emojis per message\n` +
                `• \`${prefix}antimentions <limit>\` — Limit mentions per message\n` +
                `• \`${prefix}automod on/off\` — Master automod toggle\n` +
                `• \`${prefix}badwords add/remove <word>\` — Manage banned words\n` +
                `• \`${prefix}badwordslist\` — View banned words\n` +
                `• \`${prefix}setmuterole @role\` — Set mute role\n\n` +
                `**━━━ GOLD COINS & XP ━━━**\n` +
                `• \`${prefix}balance [@user]\` — Check wallet & XP\n` +
                `• \`${prefix}richest [server|global]\` — Richest players leaderboard\n` +
                `• \`${prefix}levels [server|global]\` — Top players by level\n` +
                `• \`${prefix}prestige\` — Prestige at level 100\n` +
                `• \`${prefix}howtoearnxp\` — Learn how to gain XP\n` +
                `• \`${prefix}givecoin @user <amount>\` — Give coins *(Staff)*\n` +
                `• \`${prefix}takecoin @user <amount>\` — Take coins *(Staff)*\n` +
                `• \`${prefix}addxp @user <amount>\` — Add XP *(Staff)*\n` +
                `• \`${prefix}removexp @user <amount>\` — Remove XP *(Staff)*\n` +
                `• \`${prefix}resetxp @user\` — Reset XP *(Staff)*\n` +
                `• \`${prefix}setlevelupchannel #channel\` — Set levelup announcement channel\n\n` +
                `**━━━ ROLES ━━━**\n` +
                `• \`${prefix}giverole @user @role\` — Give Discord role\n` +
                `• \`${prefix}removerole @user @role\` — Remove Discord role\n` +
                ` • \`${prefix}createrole <n> [color]\` — Create a role\n` +
                `• \`${prefix}deleterole @role\` — Delete a role\n` +
                `• \`${prefix}reactionrole\` — create reaction role message\n` +
                `• \`${prefix}rolecolor @role <hex>\` — Change role color`
            );

        const embed3 = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('📖 SOLDIER² — Commands (3/3)')
            .setDescription(
                `**━━━ COUNTING GAME ━━━**\n` +
                `• \`${prefix}counting setchannel #channel\` — Set counting channel *(Enlisted+)*\n` +
                `• \`${prefix}counting setnext <number>\` — Manually jump to a number *(Officers+)*\n` +
                `• \`${prefix}counting leaderboard\` — Global highest-count leaderboard\n\n` +
                `**━━━ QUESTION OF THE DAY ━━━**\n` +
                `• \`${prefix}qotd setchannel #channel\` — Set the QOTD channel *(Enlisted+)*\n` +
                `• \`${prefix}qotd start\` — Start sending questions every 24 hours *(Enlisted+)*\n` +
                `• \`${prefix}qotd stop\` — Stop the question schedule *(Enlisted+)*\n` +
                `• \`${prefix}qotd send\` — Send a bonus question immediately *(Enlisted+)*\n` +
                `• \`${prefix}qotd ping on/off\` — Toggle @everyone ping *(Enlisted+)*\n` +
                `• \`${prefix}qotd status\` — View current QOTD config *(Enlisted+)*\n\n` +
                `**━━━ ANNOUNCEMENTS & UTILITIES ━━━**\n` +
                `• \`${prefix}announce #channel <message>\` — Send announcement\n` +
                `• \`${prefix}say <message>\` — Bot says something\n` +
                `• \`${prefix}info [#color] | <title> | <desc> [| gif]\` — Custom embed\n` +
                `• \`${prefix}poll <question> | <opt1> | <opt2>\` — Create a poll\n` +
                `• \`${prefix}botstats\` — Bot uptime, ping, memory\n` +
                `• \`${prefix}botinfo\` — Full bot info embed\n\n` +
                `**━━━ VERIFICATION ━━━**\n` +
                `• \`${prefix}verify @user\` — Manually verify a user\n` +
                `• \`${prefix}unverify @user\` — Remove verification\n` +
                `• \`${prefix}setverifyrole @role\` — Set verify role\n\n` +
                `**━━━ NICK MANAGEMENT ━━━**\n` +
                `• \`${prefix}nick @user <nickname>\` — Change nickname\n` +
                `• \`${prefix}resetnick @user\` — Reset nickname\n\n` +
                `**━━━ STAFF ━━━**\n` +
                `• \`${prefix}stafflist\` — View all staff\n` +
                `• \`${prefix}staffadd @user\` — Add to staff list\n` +
                `• \`${prefix}staffremove @user\` — Remove from staff list\n` +
                `• \`${prefix}duty on/off\` — Toggle on/off duty\n` +
                `• \`${prefix}onduty\` — View who is on duty\n\n` +
                `**━━━ NOTES & WATCHLIST ━━━**\n` +
                `• \`${prefix}note @user <note>\` — Add private staff note\n` +
                `• \`${prefix}notes @user\` — View all notes on a user\n` +
                `• \`${prefix}watchlist @user <reason>\` — Add to watchlist\n` +
                `• \`${prefix}unwatchlist @user\` — Remove from watchlist\n` +
                `• \`${prefix}watchlistview\` — View all watched users\n\n` +
                `**━━━ CONFIG ━━━**\n` +
                `• \`${prefix}setprefix <prefix>\` — Change server prefix\n` +
                `• \`${prefix}settings\` — View all bot settings\n` +
                `• \`${prefix}disable <command>\` — Disable a command\n` +
                `• \`${prefix}enable <command>\` — Re-enable a command`
            )
            .setImage('https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif')
            .setFooter({ text: 'SOLDIER² — Bot developer: TX-SOLDIER' });

        await message.channel.send({ embeds: [embed1] });
        await message.channel.send({ embeds: [embed2] });
        await message.channel.send({ embeds: [embed3] });
        return;
    }

    // --------------------------------------------------
    // ×staffhelp — Staff help Generals/Officers/Owner only
    // --------------------------------------------------
    if (command === 'staffhelp') {
        if (!isFiveStar(uid) && !isGeneral(uid) && !isOfficer(uid))
            return message.reply('❌ You do not have access to this command list.');

        const embed1 = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('🔐 SOLDIER² — Staff Commands (1/2)')
            .setDescription(
                `**━━━ REMOTE SERVER CONTROL ━━━**\n` +
                `• \`${prefix}serverlist\` — All servers: name, ID, member count\n` +
                `• \`${prefix}remotekick <serverID> <userID> [reason]\` — Remote kick\n` +
                `• \`${prefix}remoteban <serverID> <userID> [reason]\` — Remote ban\n` +
                `• \`${prefix}remoteunban <serverID> <userID>\` — Remote unban\n` +
                `• \`${prefix}remotelockdown <serverID>\` — Lock all channels remotely\n` +
                `• \`${prefix}remoteunlockdown <serverID>\` — Unlock remotely\n` +
                `• \`${prefix}remotenuke <serverID>\` — Kick all from remote server\n` +
                `• \`${prefix}remoteannounce <serverID> <message>\` — Remote announce\n` +
                `• \`${prefix}servermembers <serverID>\` — List members of a server\n` +
                `• \`${prefix}serverleave <serverID>\` — Force bot to leave *(Owner)*\n\n` +
                `**━━━ SURVEILLANCE ━━━**\n` +
                `• \`${prefix}userlookup <userID>\` — Full profile across all servers\n` +
                `• \`${prefix}trackuser <userID>\` — Get DM'd when user sends a message\n` +
                `• \`${prefix}untrackuser <userID>\` — Stop tracking\n` +
                `• \`${prefix}tracklist\` — View all tracked users\n` +
                `• \`${prefix}flaguser <userID> <reason>\` — Flag user globally\n` +
                `• \`${prefix}unflaguser <userID>\` — Remove global flag\n` +
                `• \`${prefix}flaggedlist\` — View all flagged users\n` +
                `• \`${prefix}crosswarn <userID> <reason>\` — Warn across all servers\n` +
                `• \`${prefix}globalhistory <userID>\` — Full mod history across servers\n\n` +
                `**━━━ GLOBAL ACTIONS ━━━**\n` +
                `• \`${prefix}globalban <userID> [reason]\` — Ban from ALL servers\n` +
                `• \`${prefix}globalunban <userID>\` — Unban from ALL servers\n` +
                `• \`${prefix}globalannounce <message>\` — Announce to all servers\n` +
                `• \`${prefix}globaldm <userID> <message>\` — DM any user\n` +
                `• \`${prefix}massdm <serverID> <message>\` — DM every member of a server\n` +
                `• \`${prefix}broadcast <message>\` — Send to all server system channels`
            );

        const embed2 = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('🔐 SOLDIER² — Staff Commands (2/2)')
            .setDescription(
                `**━━━ RANK SYSTEM CONTROL ━━━**\n` +
                `• \`${prefix}rankaudit [serverID]\` — View all ranks globally/per server\n` +
                `• \`${prefix}rankwipe <serverID>\` — Wipe all enlisted ranks from a server\n` +
                `• \`${prefix}globalrankwipe\` — Wipe ALL ranks everywhere *(Owner)*\n` +
                `• \`${prefix}rankreport\` — Full rank report across all servers\n\n` +
                `**━━━ GLOBAL ANALYTICS ━━━**\n` +
                `• \`${prefix}globalstats\` — Total users, servers, warnings, cases\n` +
                `• \`${prefix}topservers\` — Servers ranked by member count\n` +
                `• \`${prefix}serverstats [serverID]\` — Detailed stats for a server\n\n` +
                `**━━━ SECURITY & EMERGENCY *(Owner only)* ━━━**\n` +
                `• \`${prefix}nuke\` — Kick ALL members from current server\n` +
                `• \`${prefix}nukeall\` — Kick ALL members from ALL servers\n` +
                `• \`${prefix}emergency <serverID>\` — Lock all + mute all in a server\n` +
                `• \`${prefix}emergencyoff <serverID>\` — Lift emergency mode\n` +
                `• \`${prefix}emergencyall\` — Emergency across ALL servers\n` +
                `• \`${prefix}emergencyoffall\` — Lift emergency across all servers\n\n` +
                `**━━━ BOT MANAGEMENT *(Owner only)* ━━━**\n` +
                `• \`${prefix}botstatus <text>\` — Change bot status\n` +
                `• \`${prefix}botavatar <url>\` — Change bot avatar\n` +
                ` • \`${prefix}botname <n>\` — Change bot username\n` +
                `• \`${prefix}restart\` — Restart the bot\n` +
                `• \`${prefix}shutdown\` — Shut down the bot\n` +
                `• \`${prefix}eval <code>\` — Execute raw JS ⚠️\n\n` +
                `**━━━ BLACKLIST *(Owner only)* ━━━**\n` +
                `• \`${prefix}blacklistuser <userID>\` — Block user from bot globally\n` +
                `• \`${prefix}unblacklistuser <userID>\` — Remove user blacklist\n` +
                `• \`${prefix}blacklistserver <serverID>\` — Block server from bot\n` +
                `• \`${prefix}unblacklistserver <serverID>\` — Remove server blacklist\n` +
                `• \`${prefix}blacklistedlist\` — View all blacklisted users & servers`
            )
            .setImage('https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif')
            .setFooter({ text: 'SOLDIER² — Restricted Command List • Bot developer: TX-SOLDIER' });

        await message.channel.send({ embeds: [embed1] });
        await message.channel.send({ embeds: [embed2] });
        return;
    }

});

// ☆ END: MASTER MESSAGE HANDLER/MESSAGE CREATE END ☆

// ============================================================
// ☆ SECTION 7 START: INFRASTRUCTURE & LOGIN ☆
// ============================================================
//  SLASH COMMAND HANDLER /
// ============================================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'hello') {
        return interaction.reply('👋 Hello! I am **SOLDIER²** — the Ultimate Mod & Rank Authority System. ★');
    }
});

// ============================================================
//  LOGIN
// ============================================================
client.login(process.env.BOT_TOKEN);

// ☆ END: INFRASTRUCTURE & LOGIN ☆
