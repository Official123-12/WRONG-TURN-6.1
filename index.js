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

// PREMIUM NEWSLETTER CONTEXT (FONTS ZA KISHUWA + UA)
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
                const cmd = require(path.join(folderPath, file));
                if (cmd && cmd.name) {
                    cmd.category = folder;
                    commands.set(cmd.name.toLowerCase(), cmd);
                }
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
            // Auto presence update to owner
            await sock.sendMessage(sock.user.id, { 
                text: "ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nᴍᴏᴅᴇ: ᴘᴜʙʟɪᴄ",
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

        // 1. DYNAMIC SETTINGS
        const setSnap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const config = setSnap.exists() ? setSnap.data() : { prefix: ".", mode: "public", owner: "255618668502" };
        const prefix = config.prefix || ".";

        // 2. OWNER BYPASS
        const isOwner = sender.startsWith(config.owner) || m.key.fromMe;
        if (config.mode === "private" && !isOwner) return;

        // 3. AUTO-PRESENCE (TYPING)
        await sock.sendPresenceUpdate('composing', from);

        // 4. FORCE JOIN & FOLLOW (THE FIX)
        if (body.startsWith(prefix) && !isOwner) {
            const groupJid = '120363406549688641@g.us';
            const normalizedSender = sender.split(':')[0] + '@s.whatsapp.net';
            try {
                const groupMetadata = await sock.groupMetadata(groupJid);
                const isMember = groupMetadata.participants.find(p => p.id === normalizedSender);
                if (!isMember) {
                    const denyMsg = `❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\n\nᴊᴏɪɴ ᴏᴜʀ ɢʀᴏᴜᴘ/ᴄʜᴀɴɴᴇʟ ᴛᴏ ᴜꜱᴇ ʙᴏᴛ.\n\n🥀 *ᴅᴇᴠ:* ꜱᴛᴀɴʏᴛᴢ\n🛡️ *ʙᴏᴛ:* ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼`;
                    return sock.sendMessage(from, { text: denyMsg, contextInfo: forwardedContext });
                }
            } catch (e) { console.log("Force Join Error: Bot not in group."); }
        }

        // 5. ANTI-DELETE & ANTI-VIEWONCE
        msgCache.set(m.key.id, m);
        if (m.message.protocolMessage?.type === 0) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
        }
        if (Object.keys(m.message)[0].includes('viewOnceMessage')) {
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // 6. COMMAND EXECUTION
        if (body.startsWith(prefix)) {
            const args = body.slice(prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    });

    setInterval(() => { if (sock?.user) sock.sendPresenceUpdate('available'); }, 15000);
}

// STABLE PAIRING API
app.get('/code', async (req, res) => {
    const pSock = makeWASocket({ 
        auth: { creds: initAuthCreds(), keys: makeCacheableSignalKeyStore({}, pino({level:'silent'})) }, 
        logger: pino({level:'silent'}), 
        browser: Browsers.macOS("Safari") 
    });
    await delay(3000);
    let code = await pSock.requestPairingCode(req.query.number.replace(/\D/g, ''));
    res.send({ code });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(process.env.PORT || 3000, startBot);
