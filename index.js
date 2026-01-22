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
let sock = null;

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
 * AUTH STATE HANDLER
 */
async function useFirebaseAuthState(db, collectionName, sessionId) {
    const fixId = (id) => `${sessionId}_${id.replace(/\//g, '__').replace(/\@/g, 'at')}`;
    const writeData = async (data, id) => setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
        } catch (e) { return null; }
    };
    const removeData = async (id) => deleteDoc(doc(db, collectionName, fixId(id)));
    let creds = await readData('creds') || initAuthCreds();
    return { state: { creds, keys: {
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
                    if (value) await writeData(value, `${type}-${id}`);
                }
            }
        }
    }}, saveCreds: () => writeData(creds, 'creds'), clearSession: () => removeData('creds') };
}

/**
 * MAIN BOT LOOP (Injecting AI, Protection, and Stats)
 */
async function startBot() {
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");
    
    if (!state.creds.me) {
        console.log("📡 STANDBY: WAITING FOR PAIRING...");
        return;
    }

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"), // FIXED: Chrome headers prevent 428
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WRONG TURN 6: ARMED");
            await sock.sendMessage(sock.user.id, { text: "ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ", contextInfo: forwardedContext });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) setTimeout(startBot, 5000);
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();

        // 1. AUTO AI CHAT (Natural Human Persona)
        if (!body.startsWith('.') && !m.key.fromMe && !from.endsWith('@g.us') && body.length > 2) {
            try {
                const res = await axios.get(`https://text.pollinations.ai/Reply%20briefly%20in%20natural%20language%20as%20WrongTurn6:%20${encodeURIComponent(body)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${res.data}`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // 2. FORCE JOIN CHECK
        if (body.startsWith('.') && !m.key.fromMe) {
            try {
                const meta = await sock.groupMetadata('120363406549688641@g.us');
                if (!meta.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
                }
            } catch (e) {}
        }
    });
}

/**
 * THE PAIRING FIX (REMOVES PRECONDITION ERROR)
 */
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "No number" });

    // 1. Force close any existing ghost sockets
    if (sock) { try { sock.ws.close(); } catch(e){} sock = null; }

    try {
        // 2. Use Brand New Identity for pairing request
        const auth = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");
        await auth.clearSession(); // Wipe Firebase session to ensure 100% clean state

        const pSock = makeWASocket({
            auth: { 
                creds: initAuthCreds(), 
                keys: makeCacheableSignalKeyStore({}, pino({level:'silent'})) 
            },
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu("Chrome")
        });

        await delay(5000); 
        let code = await pSock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });

        // 3. Save to Firebase only after the link is verified
        pSock.ev.on('creds.update', async (creds) => {
            await setDoc(doc(db, "WT6_SESSIONS", "MASTER_creds"), JSON.parse(JSON.stringify(creds, BufferJSON.replacer)));
        });

        pSock.ev.on('connection.update', (u) => {
            if (u.connection === 'open') startBot(); 
        });

    } catch (e) {
        console.error(e);
        res.status(500).send({ error: "System Busy" });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Online: ${PORT}`); startBot(); });
