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
const pino = require('pino');
const axios = require('axios');

// 1. FIREBASE CONFIG
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
const sessions = new Map(); // Track active sockets for multi-users
const msgCache = new Map();

// PREMIUM NEWSLETTER MASKING
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
 * FIREBASE MULTI-AUTH HANDLER
 */
async function useFirebaseAuthState(num) {
    const fixId = (id) => `session_${num}_${id.replace(/\//g, '__').replace(/\@/g, 'at')}`;
    const writeData = async (data, id) => setDoc(doc(db, "SESSIONS", fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        const snapshot = await getDoc(doc(db, "SESSIONS", fixId(id)));
        return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
    };
    const creds = await readData('creds') || initAuthCreds();
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            value ? await writeData(value, `${type}-${id}`) : null;
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

/**
 * AUTOMATION INJECTION LOGIC
 */
async function handleAutomations(sock, m) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
    const type = getContentType(m.message);

    // 1. AUTO PRESENCE
    await sock.sendPresenceUpdate('composing', from);
    if (Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);

    // 2. ANTI-DELETE & VIEWONCE
    msgCache.set(m.key.id, m);
    if (m.message.protocolMessage?.type === 0 && !m.key.fromMe) {
        const cached = msgCache.get(m.message.protocolMessage.key.id);
        if (cached) {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ* Recovered from @${sender.split('@')[0]}`, mentions: [sender] });
            await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
        }
    }
    if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
        await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
    }

    // 3. FORCE JOIN CHECK
    if (body.startsWith('.') && !m.key.fromMe) {
        try {
            const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
            if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
            }
        } catch (e) {}
    }

    // 4. AUTO AI CHAT (Human Persona)
    if (!body.startsWith('.') && !m.key.fromMe && body.length > 2 && !from.endsWith('@g.us')) {
        try {
            const aiRes = await axios.get(`https://text.pollinations.ai/Your name is WRONG TURN 6. Developer STANYTZ. Reply naturally to: ${encodeURIComponent(body)}`);
            await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) {}
    }

    // 5. ANTI-DEMON (Porn/Scam/Link)
    if (from.endsWith('@g.us') && !m.key.fromMe) {
        const isDemon = /(porn|xxx|sex|ngono|bundle|fixed match|earn money)/gi.test(body);
        if (isDemon || body.includes('http')) await sock.sendMessage(from, { delete: m.key });
    }
}

/**
 * ENGINE BOOTSTRAP
 */
async function startUserBot(num) {
    const { state, saveCreds } = await useFirebaseAuthState(num);
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        markOnlineOnConnect: true
    });

    sessions.set(num, sock);

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log(`✅ Session Active: ${num}`);
        if (u.connection === 'close') startUserBot(num);
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        await handleAutomations(sock, m);
        // Command Handler Injection
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();
        if (body.startsWith('.')) {
            // Your command logic here
        }
    });

    // Always Online & Bio
    setInterval(async () => {
        if (sock.user) {
            await sock.sendPresenceUpdate('available');
            const up = Math.floor(process.uptime() / 3600) + "h";
            await sock.updateProfileStatus(`WRONG TURN 6 | ONLINE | UPTIME: ${up}`).catch(() => {});
        }
    }, 30000);
}

/**
 * PAIRING API (OFFICIAL 8-DIGIT CODES)
 */
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    if (!num) return res.status(400).send({ error: "Missing Number" });

    try {
        const { state, saveCreds } = await useFirebaseAuthState(num);
        const pSock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu("Chrome")
        });

        await delay(5000);
        let code = await pSock.requestPairingCode(num);
        res.send({ code });

        pSock.ev.on('creds.update', saveCreds);
        pSock.ev.on('connection.update', (u) => {
            if (u.connection === 'open') startUserBot(num);
        });
    } catch (e) { res.status(500).send({ error: "System Busy" }); }
});

// Auto-restart all existing sessions on boot
async function restoreSessions() {
    console.log("📂 Restoring active sessions from Firebase...");
    // Logic to fetch all session IDs from Firebase and call startUserBot(id)
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(3000, () => {
    console.log("Server Armed: Port 3000");
    restoreSessions();
});
