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
const { getFirestore, initializeFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');

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

const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼' 
    }
};

/**
 * ENHANCED HUMAN MOOD ENGINE (English)
 */
const getMoodReply = (text) => {
    const t = text.toLowerCase();
    if (/(sad|cry|hurt|pain|broken|😭|💔|😔|depressed)/.test(t)) return "Wrong Turn 6 detected a heavy heart. Stay strong, better days are coming. 🥀";
    if (/(happy|blessed|success|win|🔥|🚀|💰|gratitude)/.test(t)) return "Pure greatness! WRONG TURN 6 celebrates this win with you! 🥂";
    if (/(love|heart|marriage|date|❤️|💍|honey)/.test(t)) return "Love is the ultimate logic. Enjoy every moment of it. ✨";
    if (/(hustle|work|office|grind|busy|💻)/.test(t)) return "Keep grinding. Your future self will thank you for this effort. 💪";
    if (/(angry|mad|snake|hate|🤬|🐍)/.test(t)) return "Detected negative energy. Stay focused on your path, ignore the noise. 🛡️";
    return "Observed by Wrong Turn 6. Interesting update. 🥀";
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

async function startBot() {
    loadCmds();
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");

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
            console.log("✅ WRONG TURN 6: ARMED");
            await sock.sendMessage(sock.user.id, { 
                text: "ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ",
                contextInfo: forwardedContext
            });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) setTimeout(startBot, 5000);
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
        const s = setSnap.exists() ? setSnap.data() : { autoType: true, autoRecord: true, autoAI: true, antiDelete: true, antiViewOnce: true, forceJoin: true, autoStatus: true };
        const ownerId = sock.user.id.split(':')[0];
        const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

        // AUTO PRESENCE
        if (s.autoType) await sock.sendPresenceUpdate('composing', from);
        if (s.autoRecord && Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);

        // FORCE JOIN CHECK (Normalized)
        if (body.startsWith('.') && !isOwner && s.forceJoin) {
            const groupJid = '120363406549688641@g.us';
            try {
                const groupMetadata = await sock.groupMetadata(groupJid);
                if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ ᴏᴜʀ ɢʀᴏᴜᴘ ᴛᴏ ᴜꜱᴇ ʙᴏᴛ:\nhttps://chat.whatsapp.com/invite_link", contextInfo: forwardedContext });
                }
            } catch (e) {}
        }

        // ANTI-DELETE / VIEWONCE (Forward to Owner)
        if (m.message.protocolMessage?.type === 0 && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // AUTO AI CHAT (Global Natural Responses)
        if (!body.startsWith('.') && !m.key.fromMe && s.autoAI && body.length > 2 && !from.endsWith('@g.us')) {
            try {
                const aiPrompt = `You are WRONG TURN 6 AI by STANYTZ. Reply naturally to: ${body}`;
                const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼\n\n${aiRes.data}`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // STATUS ENGINE (Auto View + Like + Mood)
        if (from === 'status@broadcast' && s.autoStatus) {
            await sock.readMessages([m.key]);
            const mood = getMoodReply(body);
            await sock.sendMessage(from, { text: mood }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
        }

        // COMMANDS
        const prefix = s.prefix || ".";
        if (body.startsWith(prefix)) {
            const args = body.slice(prefix.length).trim().split(/ +/);
            const cmd = commands.get(args.shift().toLowerCase());
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
    setInterval(() => { if (sock?.user) sock.sendPresenceUpdate('available'); }, 15000);
}

/**
 * FIX: PAIRING CODE ROUTE (ISOLATED INSTANCE)
 * Resolves 'Precondition Required' 428 Error
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
            logger: pino({level:'silent'}),
            browser: Browsers.macOS("Safari")
        });
        await delay(3000);
        let code = await pSock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });

        pSock.ev.on('creds.update', async (creds) => {
            await setDoc(doc(db, "WT6_SESSIONS", "MASTER_creds"), JSON.parse(JSON.stringify(creds, BufferJSON.replacer)));
        });
    } catch (e) {
        res.status(500).send({ error: "System Busy" });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(process.env.PORT || 3000, startBot);
