require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    BufferJSON,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    initAuthCreds
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc } = require('firebase/firestore');
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
let sock = null;
let welcomeTracker = new Set();

// 1. COMMAND LOADER (SUBFOLDERS)
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

// 2. FIREBASE AUTH HANDLER
async function useFirebaseAuthState(db, collectionName) {
    const fixId = (id) => id.replace(/\//g, '__').replace(/\@/g, 'at');
    const writeData = async (data, id) => setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
        } catch (e) { return null; }
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
                            value ? await writeData(value, `${type}-${id}`) : null;
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

// 3. MAIN BOT ENGINE
async function startBot() {
    loadCmds();
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        printQRInTerminal: false,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            const botId = sock.user.id.split(':')[0];
            if (!welcomeTracker.has(botId)) {
                const welcome = `┏━━━━ 『 WRONG TURN 6 』 ━━━━┓\n┃\n┃ 🥀 *SYSTEM ARMED & ACTIVE*\n┃\n┣━━━━━━━━━━━━┓\n┃ 🛡️ *DEV    :* STANYTZ\n┃ ⚙️ *VERSION:* 6.6.0\n┃ 🌐 *ENGINE :* AngularSockets\n┃ 🌷 *PREFIX :* [ . ]\n┗━━━━━━━━━━━━━━━┛\n\n🥀🥂 *ACTIVE*`;
                await sock.sendMessage(sock.user.id, { text: welcome });
                welcomeTracker.add(botId);
            }
            console.log("✅ WT6 ONLINE");
        }
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) setTimeout(startBot, 5000);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();

        // Always Online + Auto Typing
        await sock.sendPresenceUpdate('composing', from);

        if (from === 'status@broadcast') await sock.readMessages([m.key]);

        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args);
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
    setInterval(() => { if (sock?.user) sock.sendPresenceUpdate('available'); }, 15000);
}

// 4. ZERO-ERROR PAIRING ROUTE
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "No number" });

    try {
        // Tunatengeneza fresh instance ya kodi pekee. 
        // Hii haiangalii Firebase, hivyo haina "Precondition Required"
        const pSock = makeWASocket({
            auth: {
                creds: initAuthCreds(),
                keys: makeCacheableSignalKeyStore({}, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Safari")
        });

        await delay(2000);
        let code = await pSock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });

        // Tukishapata kodi, tunasikiliza ikifanikiwa ku-link tu-save kwenye Firebase
        pSock.ev.on('creds.update', async (creds) => {
            const { saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS");
            // Hapa itaji-save yenyewe Firebase pindi tu ukimaliza ku-link kwenye simu
            await setDoc(doc(db, "WT6_SESSIONS", "creds"), JSON.parse(JSON.stringify(creds, BufferJSON.replacer)));
        });

    } catch (e) {
        res.status(500).send({ error: "WhatsApp Busy. Try in 10s." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server: ${PORT}`); startBot(); });
