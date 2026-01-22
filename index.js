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
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, collection, getDocs } = require('firebase/firestore');
const express = require('express');
const path = require('path');
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
const activeSocks = new Map(); // Store multiple user connections

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
 * START A USER SESSION
 */
async function startUserBot(userId) {
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const auth = await useFirebaseAuthState(db, "WT6_USERS", userId);
    
    if (!auth.state.creds.me && !activeSocks.has(userId)) return;

    const sock = makeWASocket({
        auth: auth.state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"), 
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    activeSocks.set(userId, sock);

    sock.ev.on('creds.update', auth.saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log(`✅ SESSION ACTIVE: ${userId}`);
            const welcome = `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ ✔️`;
            await sock.sendMessage(sock.user.id, { text: welcome, contextInfo: forwardedContext });
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startUserBot(userId);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();
        const type = getContentType(m.message);

        // --- INJECTED: AI AUTO CHAT ---
        if (!body.startsWith('.') && !m.key.fromMe && body.length > 2 && !from.endsWith('@g.us')) {
            try {
                const aiRes = await axios.get(`https://text.pollinations.ai/Reply naturally to: ${encodeURIComponent(body)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // --- INJECTED: ANTI-DELETE/VIEWONCE ---
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2')) {
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // --- INJECTED: FORCE JOIN ---
        if (body.startsWith('.') && !m.key.fromMe) {
            try {
                const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
                if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
                }
            } catch (e) {}
        }

        // --- COMMAND HANDLER ---
        if (body.startsWith('.')) {
            const cmdName = body.slice(1).split(' ')[0].toLowerCase();
            // Custom command logic here...
        }
    });
}

/**
 * PAIRING ROUTE (FIXED FOR MULTI-USER)
 */
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    if (!num) return res.status(400).send({ error: "No number" });

    try {
        console.log(`📡 New Link Request: ${num}`);
        const { useFirebaseAuthState } = require('./lib/firestoreAuth');
        const auth = await useFirebaseAuthState(db, "WT6_USERS", num);
        await auth.clearSession(); // Wipe existing for this specific user only

        const pSock = makeWASocket({
            auth: auth.state,
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu("Chrome")
        });

        await delay(5000); 
        let code = await pSock.requestPairingCode(num);
        res.send({ code });

        pSock.ev.on('creds.update', auth.saveCreds);
        pSock.ev.on('connection.update', (u) => {
            if (u.connection === 'open') {
                activeSocks.set(num, pSock);
                console.log(`User ${num} linked successfully.`);
            }
        });

    } catch (e) {
        console.error(e);
        res.status(500).send({ error: "System Busy. Try again." });
    }
});

/**
 * AUTO-RESTART EXISTING SESSIONS ON STARTUP
 */
async function bootAllUsers() {
    const querySnapshot = await getDocs(collection(db, "WT6_USERS"));
    const users = new Set();
    querySnapshot.forEach((doc) => {
        const userId = doc.id.split('_')[0];
        users.add(userId);
    });
    users.forEach(id => startUserBot(id));
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Supreme Mainframe Online: ${PORT}`);
    bootAllUsers();
});
