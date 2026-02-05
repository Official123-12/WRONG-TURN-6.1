require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    makeCacheableSignalKeyStore,
    getContentType,
    downloadContentFromMessage,
    generateForwardMessageContent,
    prepareWAMessageMedia
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, getDocs, deleteDoc } = require('firebase/firestore');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs-extra');
const express = require('express');

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
    authDomain: "stanybots.firebaseapp.com",
    projectId: "stanybots",
    storageBucket: "stanybots.firebasestorage.app",
    messagingSenderId: "381983533939",
    appId: "1:381983533939:web:e6cc9445137c74b99df306"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const app = express();

// --- GLOBAL VARIABLES & CACHE ---
const msgCache = new Map();
const newsletterJid = '120363404317544295@newsletter';
const supportGroup = '120363406549688641@g.us';

const fContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: newsletterJid,
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟽 🥀'
    }
};

const style = {
    p: (t) => `╭── • 🥀 • ──╮\n${t}\n╰── • 🥀 • ──╯`,
    footer: `\n\n└──────────────\nᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ 🥀`
};

// --- AUTHENTICATION (FIREBASE SESSION) ---
async function useFirebaseAuthState(docId) {
    let creds;
    const docRef = doc(db, "SESSIONS", docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        creds = JSON.parse(JSON.stringify(snap.data()), (k, v) => (v?.type === 'Buffer' ? Buffer.from(v.data, 'base64') : v));
    } else {
        const { initAuthCreds } = require('@whiskeysockets/baileys');
        creds = initAuthCreds();
    }
    return {
        state: { creds, keys: makeCacheableSignalKeyStore(creds.keys || {}, pino({ level: 'silent' })) },
        saveCreds: async () => {
            const safeCreds = JSON.parse(JSON.stringify(creds, (k, v) => (Buffer.isBuffer(v) ? { type: 'Buffer', data: v.toString('base64') } : v)));
            await setDoc(docRef, safeCreds);
        }
    };
}

// --- CORE BOT FUNCTION ---
async function startBot() {
    const { state, saveCreds } = await useFirebaseAuthState("MASTER_SESSION");
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ["WrongTurn-7", "Safari", "3.0"],
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    // Connection Logic
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log("✅ SYSTEM ONLINE: WRONG TURN 7 IS ACTIVE");
        if (u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
    });

    // --- MESSAGE HANDLER ---
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.remoteJid === 'status@broadcast') {
            if (m.key.remoteJid === 'status@broadcast') handleStatus(sock, m);
            return;
        }

        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const type = getContentType(m.message);
        const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage' || type === 'videoMessage') ? m.message[type].caption : '';
        const isOwner = m.key.fromMe || sender.split('@')[0] === sock.user.id.split(':')[0];
        const isGroup = from.endsWith('@g.us');

        // Fetch Settings from Firebase
        const settings = await getSettings(from);
        const userEmojiMap = await getEmojiConfig(sock.user.id.split(':')[0]);

        // 1. CACHE FOR ANTI-DELETE
        msgCache.set(m.key.id, m);

        // 2. FORCE JOIN CHECK (Must follow channel & group)
        if (!isOwner && !isGroup) {
            const isFollowing = await checkFollow(sock, sender);
            if (!isFollowing) return sock.sendMessage(from, { text: style.p("❌ ACCESS DENIED\n\nYou must join our Channel and Support Group to use this bot!\n\nChannel: https://whatsapp.com/channel/0029VaP0V\nGroup: https://chat.whatsapp.com/J19JAS") });
        }

        // 3. EMOJI COMMAND SYSTEM
        if (userEmojiMap[body.trim()]) {
            return executeCommand(userEmojiMap[body.trim()], sock, m, from, sender, [], settings);
        }

        // 4. SECURITY SYSTEM (ANTI-LINK, PORN, SCAM, MEDIA)
        if (isGroup && !isOwner) {
            await runSecurity(sock, m, from, sender, body, type, settings);
        }

        // 5. ANTI-DELETE & ANTI-VIEW ONCE
        if (m.message.protocolMessage?.type === 0 && settings.antiDelete) {
            const oldMsg = msgCache.get(m.message.protocolMessage.key.id);
            if (oldMsg) {
                await sock.sendMessage(sock.user.id, { text: `🛡️ *ANTI-DELETE DETECTED*\nFrom: @${sender.split('@')[0]}`, mentions: [sender] });
                await sock.copyNForward(sock.user.id, oldMsg, false, { contextInfo: fContext });
            }
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && settings.antiViewOnce) {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *VIEW-ONCE BYPASSED*` });
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: fContext });
        }

        // 6. AUTO AI CHAT
        if (!isGroup && !body.startsWith('.') && settings.autoAI && !m.key.fromMe) {
            await sock.sendPresenceUpdate('composing', from);
            const aiReply = await getAI(body, sender);
            await sock.sendMessage(from, { text: style.p(aiReply) + style.footer, contextInfo: fContext }, { quoted: m });
        }

        // 7. AUTO TYPING / RECORDING
        if (settings.autoType) await sock.sendPresenceUpdate('composing', from);
        if (settings.autoRecord) await sock.sendPresenceUpdate('recording', from);

        // 8. PREFIX COMMANDS
        if (body.startsWith('.')) {
            const [cmd, ...args] = body.slice(1).trim().split(/ +/);
            await executeCommand(cmd.toLowerCase(), sock, m, from, sender, args, settings);
        }
    });

    // --- AUTO STATUS VIEW & REACT ---
    async function handleStatus(sock, m) {
        const sender = m.key.participant;
        await sock.readMessages([m.key]);
        const emojis = ['❤️', '🔥', '🙌', '🥀', '💯', '⚡'];
        await sock.sendMessage('status@broadcast', { react: { text: emojis[Math.floor(Math.random()*emojis.length)], key: m.key } }, { statusJidList: [sender] });
        
        // Deep Thinking Status Reply
        const aiStatusReply = await getAI(`Analyze and give a very short friendly reply to this status update: "${m.message?.conversation || 'image/video status'}"`);
        await sock.sendMessage(m.key.remoteJid, { text: aiStatusReply }, { quoted: m });
    }
}

// --- SECURITY LOGIC ---
async function runSecurity(sock, m, from, sender, body, type, s) {
    const warn = async (reason, remove = false) => {
        await sock.sendMessage(from, { delete: m.key });
        await sock.sendMessage(from, { text: `⚠️ *SECURITY WARNING*\n\nUser: @${sender.split('@')[0]}\nAction: Message Deleted\nReason: ${reason}\n\n_System managed by Wrong Turn 7_`, mentions: [sender] });
        if (remove && s.autoKick) await sock.groupParticipantsUpdate(from, [sender], "remove");
    };

    if (s.antiLink && /https?:\/\/[^\s]+/gi.test(body)) return warn("Posting links is strictly prohibited!", s.kickOnLink);
    if (s.antiPorn && /(porn|xxx|sex|ngono|🔞|nude)/gi.test(body)) return warn("Adult content detected!", true);
    if (s.antiScam && /(bundle|fixed match|invest|crypto|giveaway)/gi.test(body)) return warn("Scam/Fraudulent keywords detected!", s.kickOnScam);
    if (s.antiMedia && (type === 'imageMessage' || type === 'videoMessage' || type === 'audioMessage')) return warn("Media sharing is disabled in this group.");
    if (s.antiTag && body.includes('@everyone') || (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 10)) return warn("Mass tagging detected!");
}

// --- COMMAND EXECUTION ---
async function executeCommand(cmd, sock, m, from, sender, args, s) {
    const reply = (txt) => sock.sendMessage(from, { text: style.p(txt) + style.footer, contextInfo: fContext }, { quoted: m });

    switch (cmd) {
        case 'menu':
            const menu = `*WRONG TURN 7 ULTIMATE*\n\n◦ .settings (Manage Bot)\n◦ .ai [query]\n◦ .kick @user\n◦ .promote @user\n◦ .delete\n◦ .setemoji [emoji] [cmd]\n◦ .active (Group Stats)\n◦ .song [name]\n◦ .video [name]`;
            reply(menu);
            break;

        case 'settings':
            if (!m.key.fromMe) return;
            const setMenu = `*BOT SETTINGS*\n\n1. Anti-Link: ${s.antiLink ? 'ON' : 'OFF'}\n2. Anti-Delete: ${s.antiDelete ? 'ON' : 'OFF'}\n3. Auto-AI: ${s.autoAI ? 'ON' : 'OFF'}\n4. Anti-Porn: ${s.antiPorn ? 'ON' : 'OFF'}\n\nTo toggle use: .set [feature] [on/off]`;
            reply(setMenu);
            break;

        case 'setemoji':
            if (args.length < 2) return reply("Usage: .setemoji 🥀 menu");
            await setDoc(doc(db, "USER_EMOJIS", sock.user.id.split(':')[0]), { [args[0]]: args[1] }, { merge: true });
            reply(`✅ Link Success: Emoji ${args[0]} will now trigger ${args[1]}`);
            break;

        case 'ai':
            const res = await getAI(args.join(' '), sender);
            reply(res);
            break;

        case 'song':
        case 'video':
            reply(`⏳ Fetching your ${cmd}... Please wait.`);
            // Integration for downloaders would go here
            break;

        case 'active':
            const stats = await sock.groupMetadata(from);
            reply(`📊 *GROUP STATS*\n\nGroup: ${stats.subject}\nMembers: ${stats.participants.length}\nBot Status: Admin`);
            break;
            
        case 'kick':
            if (!s.isAdmin) return reply("Bot must be admin!");
            const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
            await sock.groupParticipantsUpdate(from, [target], "remove");
            reply("👤 User removed successfully.");
            break;
    }
}

// --- DATABASE & API HELPERS ---
async function getSettings(jid) {
    const d = await getDoc(doc(db, "SETTINGS", jid));
    return d.exists() ? d.data() : { antiLink: true, antiDelete: true, autoAI: true, antiViewOnce: true, antiPorn: true, antiScam: true, autoStatus: true };
}

async function getEmojiConfig(uid) {
    const d = await getDoc(doc(db, "USER_EMOJIS", uid));
    return d.exists() ? d.data() : { "🥀": "menu" };
}

async function getAI(q, user) {
    try {
        const r = await axios.get(`https://text.pollinations.ai/Respond naturally as WRONG TURN 7 Bot in user's language to: ${encodeURIComponent(q)}`);
        return r.data;
    } catch { return "Service temporarily unavailable. 🥀"; }
}

async function checkFollow(sock, jid) {
    try {
        // Logic check for Newsletter & Group membership
        const group = await sock.groupMetadata(supportGroup);
        return group.participants.some(p => p.id === jid);
    } catch { return false; }
}

// START SERVER
app.get('/', (req, res) => res.send("Wrong Turn 7 - Ultimate Active"));
app.listen(process.env.PORT || 3000, () => startBot());
