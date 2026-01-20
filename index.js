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
const { getFirestore, initializeFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
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

async function useFirebaseAuthState(db, collectionName, sessionId) {
    const fixId = (id) => `${sessionId}_${id.replace(/\//g, '__').replace(/\@/g, 'at')}`;
    const writeData = async (data, id) => setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
        } catch (e) { return null; }
    };
    return {
        state: {
            creds: await readData('creds') || initAuthCreds(),
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
        saveCreds: () => writeData(initAuthCreds(), 'creds'), // Hii itabadilika pindi itakapokuwa connected
        actualSave: (creds) => writeData(creds, 'creds')
    };
}

async function startBot() {
    const { state, actualSave } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");
    
    // USI-CONNECT kama haina session ili uweze kupata kodi bila error ya System Busy
    if (!state.creds.me && !sock) {
        console.log("📡 WRONG TURN 6: STANDBY - WAITING FOR LINK...");
        return;
    }

    loadCmds();
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"), 
        markOnlineOnConnect: true,
        syncFullHistory: false, // CRITICAL: Hii inazuia "Logging in" kukwama
        defaultQueryTimeoutMs: 0
    });

    sock.ev.on('creds.update', () => actualSave(state.creds));

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WRONG TURN 6: ONLINE");
            await sock.sendMessage(sock.user.id, { text: "ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ", contextInfo: forwardedContext });
        }
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) setTimeout(startBot, 5000);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();
        const type = getContentType(m.message);

        // 1. AUTO PRESENCE
        await sock.sendPresenceUpdate('composing', from);

        // 2. ANTI-DELETE & VIEWONCE (DM to Owner)
        if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // 3. AUTO AI CHAT (Global)
        if (!body.startsWith('.') && !m.key.fromMe && body.length > 2 && !from.endsWith('@g.us')) {
            try {
                const aiRes = await axios.get(`https://text.pollinations.ai/Reply%20naturally%20to:%20${encodeURIComponent(body)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // 4. COMMANDS
        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    });
}

// 4. THE FIX: PAIRING ROUTE (STABLE LINKING)
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "No number" });

    try {
        // Tunatengeneza Fresh Socket kwa ajili ya kodi
        const pSock = makeWASocket({
            auth: { 
                creds: initAuthCreds(), 
                keys: makeCacheableSignalKeyStore({}, pino({level:'silent'})) 
            },
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false
        });

        await delay(3000); 
        let code = await pSock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });

        // Save Creds pindi tu link itakapokubaliwa
        pSock.ev.on('creds.update', async () => {
            const { actualSave } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");
            await actualSave(pSock.authState.creds);
        });

        pSock.ev.on('connection.update', (u) => {
            if (u.connection === 'open') {
                console.log("LINK SUCCESSFUL!");
                startBot(); // Boot bot sasa
            }
        });

    } catch (e) {
        res.status(500).send({ error: "System Busy. Refresh and try again." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server Online: ${PORT}`); startBot(); });
