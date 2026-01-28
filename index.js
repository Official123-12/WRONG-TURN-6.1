require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, 
    initAuthCreds,
    BufferJSON,
    getContentType
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc } = require('firebase/firestore');
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
const sessions = new Map(); // For Multi-User tracking
let isPairing = false; 

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
 * FEATURE INJECTION MODULE (AI, Security, Status)
 */
async function handleSupremeAutomations(sock, m, db) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
    const type = getContentType(m.message);

    msgCache.set(m.key.id, m);
    const ownerId = sock.user.id.split(':')[0];
    const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

    // FETCH SETTINGS
    const setSnap = await getDoc(doc(db, "SETTINGS", ownerId));
    const s = setSnap.exists() ? setSnap.data() : { autoAI: true, forceJoin: true, autoStatus: true, antiDelete: true, antiViewOnce: true, antiScam: true, antiPorn: true, antiMedia: false, prefix: "." };

    // 1. AUTO PRESENCE
    await sock.sendPresenceUpdate('composing', from);
    if (Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);

    // 2. REPLY-BY-NUMBER LOGIC
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = (quoted?.conversation || quoted?.extendedTextMessage?.text || "").toLowerCase();
    if (quoted && !isNaN(body) && body.length > 0) {
        for (let [cmdName, cmdObj] of commands) {
            if (quotedText.includes(cmdName)) {
                await cmdObj.execute(m, sock, Array.from(commands.values()), [body.trim()], db, forwardedContext);
                return;
            }
        }
    }

    // 3. ANTI-DELETE & VIEWONCE (Forward to Owner DM)
    if (m.message.protocolMessage?.type === 0 && !m.key.fromMe && s.antiDelete) {
        const cached = msgCache.get(m.message.protocolMessage.key.id);
        if (cached) {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ* Recovered from @${sender.split('@')[0]}`, mentions: [sender] });
            await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
        }
    }
    if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
        await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ* captured from @${sender.split('@')[0]}`, mentions: [sender] });
        await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
    }

    // 4. FORCE JOIN (Group JID: 120363406549688641@g.us)
    if (body.startsWith(s.prefix) && !isOwner && s.forceJoin) {
        try {
            const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
            const normalizedSender = sender.split(':')[0] + '@s.whatsapp.net';
            if (!groupMetadata.participants.find(p => p.id === normalizedSender)) {
                return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
            }
        } catch (e) {}
    }

    // 5. AUTO STATUS ENGINE (HUMAN AI)
    if (from === 'status@broadcast' && s.autoStatus) {
        await sock.readMessages([m.key]);
        const aiMood = await axios.get(`https://text.pollinations.ai/React to this status briefly and naturally as a human friend in English: "${body}"`);
        await sock.sendMessage(from, { text: aiMood.data, contextInfo: forwardedContext }, { quoted: m });
        await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
    }

    // 6. UNIVERSAL AUTO-AI CHAT (Group & Private)
    if (!body.startsWith(s.prefix) && !m.key.fromMe && s.autoAI && body.length > 2) {
        try {
            const aiRes = await axios.get(`https://text.pollinations.ai/Your name is WRONG TURN 6 by STANYTZ. Chat naturally and briefly in the user language to: ${encodeURIComponent(body)}`);
            await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) {}
    }

    // 7. PROTECTION (SCAM / PORN / LINK / MEDIA)
    if (from.endsWith('@g.us') && !isOwner) {
        const isScam = /(bundle|fixed match|earn money|invest|wa.me\/settings)/gi.test(body);
        const isPorn = /(porn|xxx|nude|sex|vixen|ngono|🔞)/gi.test(body);
        if (isScam && s.antiScam) {
            const metadata = await sock.groupMetadata(from);
            const allMem = metadata.participants.map(v => v.id);
            await sock.sendMessage(from, { text: `‼️ *ꜱᴄᴀᴍ ᴅᴇᴛᴇᴄᴛᴇᴅ* ‼️\n@${sender.split('@')[0]} is spreading fraud. Be careful!`, mentions: allMem });
            await sock.sendMessage(from, { delete: m.key });
            await sock.groupParticipantsUpdate(from, [sender], "remove");
        }
        if ((isPorn && s.antiPorn) || (body.includes('http') && s.antiLink)) await sock.sendMessage(from, { delete: m.key });
        await setDoc(doc(db, "ACTIVITY", from), { [sender]: Date.now() }, { merge: true });
    }

    // 8. COMMAND EXECUTION
    if (body.startsWith(s.prefix)) {
        const args = body.slice(s.prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const cmd = commands.get(cmdName);
        if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
    }
}

/**
 * ENGINE INITIALIZATION
 */
async function startUserBot(num) {
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
    const userSock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        markOnlineOnConnect: true
    });

    sessions.set(num, userSock);
    userSock.ev.on('creds.update', saveCreds);

    userSock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            await userSock.sendMessage(userSock.user.id, { 
                text: `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ ✔️`, 
                contextInfo: forwardedContext 
            });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            startUserBot(num);
        }
    });

    userSock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        await handleSupremeAutomations(userSock, m, db);
    });
}

/**
 * PAIRING ROUTE (FIXED LINKING)
 */
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    if (!num) return res.status(400).send({ error: "Missing Number" });

    try {
        const { useFirebaseAuthState } = require('./lib/firestoreAuth');
        const auth = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
        await auth.clearSession(); // Atomic wipe
        
        const pSock = makeWASocket({
            auth: auth.state,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Safari") 
        });

        await delay(5000); 
        let code = await pSock.requestPairingCode(num);
        res.send({ code });

        pSock.ev.on('creds.update', auth.saveCreds);
        pSock.ev.on('connection.update', (u) => {
            if (u.connection === 'open') startUserBot(num);
        });

    } catch (e) { res.status(500).send({ error: "WhatsApp Busy" }); }
});

app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { loadCmds(); console.log(`Armed: ${PORT}`); });

// ALWAYS ONLINE & BIO ITERATOR
setInterval(async () => {
    const sessionsList = Array.from(sessions.values());
    for (let s of sessionsList) {
        if (s.user) {
            const uptime = `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`;
            await s.updateProfileStatus(`WRONG TURN 6 | ONLINE | UPTIME: ${uptime}`).catch(() => {});
            await s.sendPresenceUpdate('available');
        }
    }
}, 30000);
