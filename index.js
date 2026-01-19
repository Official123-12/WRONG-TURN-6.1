require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion,
    BufferJSON,
    initAuthCreds,
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
let isWelcomeSent = false;

// ELITE FORWARDING CONTEXT (Newsletter Masking)
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 ✔️'
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
            if (!isWelcomeSent) {
                await sock.sendMessage(sock.user.id, { 
                    text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 ✔️\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ\n\nꜱᴛᴀᴛᴜꜱ: ᴄᴏɴɴᴇᴄᴛᴇᴅ 🧬`,
                    contextInfo: forwardedContext
                });
                isWelcomeSent = true;
            }
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();

        // 1. GLOBAL SETTINGS FETCH
        const setSnap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const s = setSnap.exists() ? setSnap.data() : { autoType: true, autoRecord: true, antiDelete: true, antiViewOnce: true, forceJoin: true };

        // 2. FORCE JOIN CHECK (With Normalized JID & Owner Bypass)
        if (body.startsWith('.') && !m.key.fromMe && s.forceJoin) {
            const ownerId = sock.user.id.split(':')[0];
            const groupJid = '120363406549688641@g.us';
            const normalizedSender = sender.split(':')[0] + '@s.whatsapp.net';

            if (!sender.startsWith(ownerId)) {
                try {
                    const groupMetadata = await sock.groupMetadata(groupJid);
                    if (!groupMetadata.participants.find(p => p.id === normalizedSender)) {
                        const denyText = `❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ ᴏᴜʀ ɢʀᴏᴜᴘ/ᴄʜᴀɴɴᴇʟ ᴛᴏ ᴜꜱᴇ ʙᴏᴛ.\n\n🥀 *ᴅᴇᴠ:* ꜱᴛᴀɴʏᴛᴢ\n🛡️ *ʙᴏᴛ:* ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼`;
                        return sock.sendMessage(from, { text: denyText, contextInfo: forwardedContext }, { quoted: m });
                    }
                } catch (e) { console.log("Force Join Metadata Error"); }
            }
        }

        // 3. AUTO PRESENCE (Typing/Recording)
        if (s.autoType) await sock.sendPresenceUpdate('composing', from);
        if (s.autoRecord) await sock.sendPresenceUpdate('recording', from);

        // 4. ANTI-DELETE & ANTI-VIEWONCE (DM Forwarding)
        msgCache.set(m.key.id, m);
        if (m.message.protocolMessage?.type === 0 && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
        }
        const msgType = Object.keys(m.message)[0];
        if ((msgType === 'viewOnceMessage' || msgType === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // 5. ANTI-PORN / SCAM / LINK
        if (from.endsWith('@g.us') && !m.key.fromMe) {
            const isScam = /(bundle|fixed match|earn money|invest|free data|mikeka uhakika|pata gb 6)/gi.test(body);
            const isPorn = /(porn|xxx|nude|sex|vixen)/gi.test(body);
            if (isScam || isPorn || body.includes('http')) {
                await sock.sendMessage(from, { delete: m.key });
            }
        }

        // 6. STATUS ENGINE
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]);
            if (s.autoStatusLike) await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
        }

        // 7. COMMAND HANDLER
        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    });

    setInterval(() => { if (sock?.user) sock.sendPresenceUpdate('available'); }, 15000);
}

// PAIRING ROUTE
app.get('/code', async (req, res) => {
    let num = req.query.number;
    const pSock = makeWASocket({ auth: { creds: initAuthCreds(), keys: makeCacheableSignalKeyStore({}, pino({level:'silent'})) }, logger: pino({level:'silent'}), browser: Browsers.macOS("Safari") });
    await delay(3000);
    let code = await pSock.requestPairingCode(num.replace(/\D/g, ''));
    res.send({ code });
    pSock.ev.on('creds.update', async (creds) => { await setDoc(doc(db, "WT6_SESSIONS", "MASTER_creds"), JSON.parse(JSON.stringify(creds, BufferJSON.replacer))); });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(process.env.PORT || 3000, startBot);
