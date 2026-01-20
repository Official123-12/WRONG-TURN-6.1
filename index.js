require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion, 
    initAuthCreds,
    BufferJSON,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');

// 1. FIREBASE SETUP
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

// PREMIUM NEWSLETTER MASKING
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀'
    }
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
                text: "ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ\nᴀɪ ᴄʜᴀᴛ: ᴀᴄᴛɪᴠᴇ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ",
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

        // CACHE FOR ANTI-DELETE
        msgCache.set(m.key.id, m);

        // 1. DYNAMIC CONFIG
        const setSnap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const s = setSnap.exists() ? setSnap.data() : { prefix: ".", mode: "public", autoAI: true };
        
        // OWNER IS THE PERSON WHO PAIRED THE BOT
        const ownerId = sock.user.id.split(':')[0];
        const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

        if (s.mode === "private" && !isOwner) return;

        // 2. AUTO PRESENCE
        await sock.sendPresenceUpdate('composing', from);
        if (Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);

        // 3. FORCE JOIN CHECK (Normalized)
        if (body.startsWith(s.prefix) && !isOwner) {
            const groupJid = '120363406549688641@g.us';
            const normalizedSender = sender.split(':')[0] + '@s.whatsapp.net';
            try {
                const groupMetadata = await sock.groupMetadata(groupJid);
                if (!groupMetadata.participants.find(p => p.id === normalizedSender)) {
                    return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ ᴏᴜʀ ɢʀᴏᴜᴘ ᴛᴏ ᴜꜱᴇ ʙᴏᴛ:\nhttps://chat.whatsapp.com/invite_link", contextInfo: forwardedContext });
                }
            } catch (e) {}
        }

        // 4. ANTI-DELETE & ANTI-VIEWONCE (DM to Owner)
        if (m.message.protocolMessage?.type === 0) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
        }
        if (Object.keys(m.message)[0].includes('viewOnceMessage')) {
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // 5. AUTO AI CHAT (No Command Required - Replies in Any Language)
        if (!body.startsWith(s.prefix) && !m.key.fromMe && s.autoAI && body.length > 1) {
            try {
                const aiPrompt = `You are WRONG TURN 6 AI, a high-end personal assistant developed by STANYTZ. Reply to this message naturally and briefly in whatever language the user is speaking: "${body}"`;
                const aiResponse = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
                
                await sock.sendMessage(from, { 
                    text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiResponse.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, 
                    contextInfo: forwardedContext 
                }, { quoted: m });
            } catch (e) {}
        }

        // 6. COMMAND HANDLER
        if (body.startsWith(s.prefix)) {
            const args = body.slice(s.prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
    setInterval(() => { if (sock?.user) sock.sendPresenceUpdate('available'); }, 15000);
}

// STABLE PAIRING API
app.get('/code', async (req, res) => {
    const pSock = makeWASocket({ auth: { creds: initAuthCreds(), keys: makeCacheableSignalKeyStore({}, pino({level:'silent'})) }, logger: pino({level:'silent'}), browser: Browsers.macOS("Safari") });
    await delay(3000);
    let code = await pSock.requestPairingCode(req.query.number.replace(/\D/g, ''));
    res.send({ code });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(process.env.PORT || 3000, startBot);
