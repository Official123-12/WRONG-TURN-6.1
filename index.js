require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    BufferJSON,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');

// FIREBASE WEB CONFIG
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

// COMMAND LOADER
const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    fs.readdirSync(cmdPath).forEach(folder => {
        const categoryPath = path.join(cmdPath, folder);
        if (fs.lstatSync(categoryPath).isDirectory()) {
            fs.readdirSync(categoryPath).filter(f => f.endsWith('.js')).forEach(file => {
                try {
                    const cmd = require(path.join(categoryPath, file));
                    cmd.category = folder;
                    commands.set(cmd.name.toLowerCase(), cmd);
                } catch (e) {}
            });
        }
    });
};

// FIREBASE AUTH
async function useFirebaseAuthState(db, collectionName) {
    const fixId = (id) => id.replace(/\//g, '__').replace(/\@/g, 'at');
    const writeData = async (data, id) => setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
        } catch (e) { return null; }
    };
    const removeData = async (id) => deleteDoc(doc(db, collectionName, fixId(id)));
    const creds = await readData('creds') || require('@whiskeysockets/baileys').initAuthCreds();
    return {
        state: { creds, keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            const { proto } = require('@whiskeysockets/baileys');
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            value ? await writeData(value, `${type}-${id}`) : await removeData(`${type}-${id}`);
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

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

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            const botId = sock.user.id.split(':')[0];
            if (!welcomeTracker.has(botId)) {
                const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:WRONG TURN 6 ✔️\nORG:STANYTZ;\nTEL;type=CELL;type=VOICE;waid=${botId}:${botId}\nEND:VCARD`;
                await sock.sendMessage(sock.user.id, { contacts: { displayName: 'STANYTZ', contacts: [{ vcard }] } });

                const welcomeMsg = `┏━━━━ 『 WRONG TURN 6 』 ━━━━┓\n┃\n┃ 🥀 *SYSTEM ARMED & ACTIVE*\n┃\n┣━━━━━━━━━━━━━━━━━━━━━━━┓\n┃ 🛡️ *DEV    :* STANYTZ\n┃ ⚙️ *VERSION:* 6.6.0\n┃ 🌐 *ENGINE :* AngularSockets\n┃ 🌷 *PREFIX :* [ . ]\n┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n🥀🥂 *STANYTZ INDUSTRIES*`;
                await sock.sendMessage(sock.user.id, { text: welcomeMsg });
                welcomeTracker.add(botId);
            }
            console.log("✅ WT6 IS ONLINE");
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) setTimeout(startBot, 5000);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
        
        await sock.sendPresenceUpdate('composing', from);
        await sock.sendPresenceUpdate('recording', from);

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

// FIX: PAIRING CODE LOGIC (ZERO 428 ERROR)
app.get('/code', async (req, res) => {
    const num = req.query.number;
    if (!num) return res.status(400).send({ error: "Number required" });

    if (!sock || sock.ws.readyState !== 1) {
        return res.status(503).send({ error: "Socket not ready. Refreshing..." });
    }

    try {
        await delay(2000); // Wait for socket stabilization
        const code = await sock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) {
        console.error("Pairing Error:", e.message);
        res.status(500).send({ error: "Precondition Failed. Try again in 5s." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`System Online: ${PORT}`);
    startBot();
});
