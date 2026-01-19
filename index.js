require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion, 
    initAuthCreds,
    BufferJSON,
    makeCacheableSignalKeyStore,
    getContentType
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, collection } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');

// 1. FIREBASE WEB SDK CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
    authDomain: "stanybots.firebaseapp.com",
    projectId: "stanybots",
    storageBucket: "stanybots.firebasestorage.app",
    messagingSenderId: "381983533939",
    appId: "1:381983533939:web:e6cc9445137c74b99df306"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = initializeFirestore(firebaseApp, { experimentalForceLongPolling: true, useFetchStreams: false });

const app = express();
const commands = new Map();
const msgCache = new Map(); 
let sock = null;

// PREMIUM FORWARDING MASK
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
    }
};

/**
 * MOOD ANALYSIS (HUMAN-LIKE ENGLISH)
 */
const getMoodReply = (text) => {
    const t = text.toLowerCase();
    if (/(sad|cry|hurt|pain|😭|💔|😔)/.test(t)) return "Wrong Turn 6 detected sadness. Stay strong, better days ahead. 🥀";
    if (/(happy|blessed|success|win|🔥|🚀|💰)/.test(t)) return "Pure greatness! WRONG TURN 6 celebrates this win with you! 🥂";
    if (/(love|❤️|💍|honey)/.test(t)) return "Love is the ultimate logic. Enjoy every moment. ✨";
    return "Observed by Wrong Turn 6. 🥀";
};

const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    fs.readdirSync(cmdPath).forEach(folder => {
        const folderPath = path.join(cmdPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            fs.readdirSync(folderPath).filter(f => f.endsWith('.js')).forEach(file => {
                try {
                    const cmd = require(path.join(folderPath, file));
                    if (cmd && cmd.name) {
                        cmd.category = folder;
                        commands.set(cmd.name.toLowerCase(), cmd);
                    }
                } catch (e) {}
            });
        }
    });
};

/**
 * MAIN ENGINE
 */
async function startBot() {
    loadCmds();
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");

    // BLOCK BACKGROUND AUTO-CONNECT IF NOT REGISTERED (Kills 428 Error)
    if (!state.creds.registered) {
        console.log("📡 WRONG TURN 6: IDLE - Waiting for Pairing Code request...");
        return;
    }

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WRONG TURN BOT: CONNECTED ON RENDER");
            await sock.sendMessage(sock.user.id, { 
                text: "ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ",
                contextInfo: forwardedContext
            });
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) setTimeout(startBot, 5000);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
        const type = getContentType(m.message);

        msgCache.set(m.key.id, m);

        const setSnap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const s = setSnap.exists() ? setSnap.data() : { autoType: true, autoAI: true, forceJoin: true, autoStatus: true };
        const ownerId = sock.user.id.split(':')[0];
        const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

        // AUTO PRESENCE
        if (s.autoType) {
            await sock.sendPresenceUpdate('composing', from);
            if (Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);
        }

        // FORCE JOIN (Group JID: 120363406549688641@g.us)
        if (body.startsWith('.') && !isOwner && s.forceJoin) {
            try {
                const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
                if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    const deny = `❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ ᴏᴜʀ ɢʀᴏᴜᴘ/ᴄʜᴀɴɴᴇʟ ᴛᴏ ᴜꜱᴇ ʙᴏᴛ.\n\n🥀 *ᴅᴇᴠ:* ꜱᴛᴀɴʏᴛᴢ\n🛡️ *ʙᴏᴛ:* ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ`;
                    return sock.sendMessage(from, { text: deny, contextInfo: forwardedContext });
                }
            } catch (e) {}
        }

        // ANTI-DELETE / VIEWONCE (Forward to Owner DM)
        if (m.message.protocolMessage?.type === 0 && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ:* from @${sender.split('@')[0]}`, mentions: [sender] });
                await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
            }
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ* Captured` });
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // AUTO STATUS ENGINE
        if (from === 'status@broadcast' && s.autoStatus) {
            await sock.readMessages([m.key]);
            const moodMsg = getMoodReply(body);
            await sock.sendMessage(from, { text: moodMsg }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
        }

        // UNIVERSAL AUTO AI CHAT
        if (!body.startsWith('.') && !m.key.fromMe && s.autoAI && body.length > 2 && !from.endsWith('@g.us')) {
            try {
                const aiRes = await axios.get(`https://text.pollinations.ai/Reply%20naturally%20to:%20${encodeURIComponent(body)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // COMMANDS
        const prefix = s.prefix || ".";
        if (body.startsWith(prefix)) {
            const args = body.slice(prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
    setInterval(() => { if (sock?.user) sock.sendPresenceUpdate('available'); }, 15000);
}

/**
 * THE NUCLEAR PAIRING FIX (ZERO 428 ERROR)
 * Forces a clean, in-memory auth state for pairing requests
 */
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Missing Number" });
    try {
        const pSock = makeWASocket({
            auth: { 
                creds: initAuthCreds(), 
                keys: makeCacheableSignalKeyStore({}, pino({level:'silent'})) 
            },
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Safari")
        });

        await delay(3000);
        let code = await pSock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });

        // Save progress to Firebase ONLY when the phone confirms the link
        pSock.ev.on('creds.update', async (creds) => {
            const { BufferJSON } = require('@whiskeysockets/baileys');
            await setDoc(doc(db, "WT6_SESSIONS", "MASTER_creds"), JSON.parse(JSON.stringify(creds, BufferJSON.replacer)));
        });
    } catch (e) {
        res.status(500).send({ error: "WhatsApp Busy" });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server Online: ${PORT}`); startBot(); });
