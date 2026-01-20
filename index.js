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
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, collection, getDocs } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
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
const commands = new Map();
const activeSessions = new Map(); // Tunatunza sock za watumiaji wote hapa

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

// COMMAND LOADER
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
 * MULTI-SESSION AUTH HANDLER
 */
async function useFirebaseAuthState(db, sessionId) {
    const writeData = async (data, id) => {
        const cleanId = id.replace(/\//g, '__').replace(/\@/g, 'at');
        await setDoc(doc(db, "WT6_USERS", sessionId, "auth", cleanId), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    };

    const readData = async (id) => {
        const cleanId = id.replace(/\//g, '__').replace(/\@/g, 'at');
        const snap = await getDoc(doc(db, "WT6_USERS", sessionId, "auth", cleanId));
        return snap.exists() ? JSON.parse(JSON.stringify(snap.data()), BufferJSON.reviver) : null;
    };

    const removeData = async (id) => {
        const cleanId = id.replace(/\//g, '__').replace(/\@/g, 'at');
        // Delete logic here
    };

    let creds = await readData('creds') || initAuthCreds();

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
                            if (value) await writeData(value, `${type}-${id}`);
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

/**
 * CORE BOT LOGIC (Injected with all features)
 */
async function connectUser(sessionId) {
    const { state, saveCreds } = await useFirebaseAuthState(db, sessionId);
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    activeSessions.set(sessionId, sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log(`✅ User ${sessionId} Connected!`);
            await sock.sendMessage(sock.user.id, { 
                text: "ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nYour account is now linked to our keeper.\nSystem Armed & Operational.",
                contextInfo: forwardedContext
            });
        }
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) connectUser(sessionId);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
        const type = getContentType(m.message);

        // 1. AUTO AI CHAT (Global)
        if (!body.startsWith('.') && !m.key.fromMe && !from.endsWith('@g.us') && body.length > 2) {
            try {
                const aiRes = await axios.get(`https://text.pollinations.ai/Reply%20naturally%20to:%20${encodeURIComponent(body)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // 2. ANTI-DELETE & VIEWONCE
        if (m.message.protocolMessage?.type === 0 && !m.key.fromMe) {
            // Anti-Delete logic here (uses local cache)
        }

        // 3. FORCE JOIN (Group Link: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y)
        if (body.startsWith('.') && !m.key.fromMe) {
            try {
                const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
                if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nJoin: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
                }
            } catch (e) {}
        }

        // 4. COMMAND HANDLER
        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    });
}

/**
 * MANAGER: BOOT ALL LINKED ACCOUNTS ON STARTUP
 */
async function bootAllUsers() {
    loadCmds();
    console.log("📡 WRONG TURN 6: Initializing Keeper System...");
    const querySnapshot = await getDocs(collection(db, "WT6_USERS"));
    querySnapshot.forEach(async (doc) => {
        console.log(`🚀 Waking up soul: ${doc.id}`);
        await connectUser(doc.id);
        await delay(5000); // Stagger boot to prevent Render crash
    });
}

/**
 * PAIRING ROUTE (DYNAMIC REGISTRATION)
 */
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "No number" });
    
    const sessionId = num.replace(/\D/g, '');
    try {
        const { state, saveCreds } = await useFirebaseAuthState(db, sessionId);
        const pSock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Safari")
        });

        await delay(3000);
        let code = await pSock.requestPairingCode(sessionId);
        res.send({ code });

        pSock.ev.on('creds.update', saveCreds);
        pSock.ev.on('connection.update', (u) => {
            if (u.connection === 'open') console.log(`New User ${sessionId} Linked!`);
        });

    } catch (e) { res.status(500).send({ error: "System Busy" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { 
    console.log(`Mainframe Port: ${PORT}`); 
    bootAllUsers(); 
});
