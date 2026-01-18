require('dotenv').config();
const { default: makeWASocket, DisconnectReason, Browsers, delay, fetchLatestBaileysVersion, BufferJSON } = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');

// FIREBASE CONFIG
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
let isFirstConnect = true; // Inazuia spam ya welcome message

// COMMAND LOADER (SCANS ALL SUBFOLDERS)
const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    
    fs.readdirSync(cmdPath).forEach(folder => {
        const folderPath = path.join(cmdPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            fs.readdirSync(folderPath).filter(f => f.endsWith('.js')).forEach(file => {
                try {
                    const cmd = require(path.join(folderPath, file));
                    // CRITICAL FIX: Inakagua kama file lina 'name' kabla ya ku-load
                    if (cmd && cmd.name) {
                        cmd.category = folder;
                        commands.set(cmd.name.toLowerCase(), cmd);
                    }
                } catch (e) { console.error(`Failed to load ${file}:`, e.message); }
            });
        }
    });
    console.log(`📡 WRONG TURN 6: Loaded ${commands.size} Commands.`);
};

async function useFirebaseAuthState(db, collectionName) {
    const fixId = (id) => id.replace(/\//g, '__').replace(/\@/g, 'at');
    const writeData = async (data, id) => setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
        } catch (e) { return null; }
    };
    const creds = await readData('creds') || require('@whiskeysockets/baileys').initAuthCreds();
    return { state: { creds, keys: { get: async (type, ids) => { const data = {}; await Promise.all(ids.map(async id => { let value = await readData(`${type}-${id}`); if (type === 'app-state-sync-key' && value) value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value); data[id] = value; })); return data; }, set: async (data) => { for (const type in data) { for (const id in data[type]) { const value = data[type][id]; if (value) await writeData(value, `${type}-${id}`); } } } } }, saveCreds: () => writeData(creds, 'creds') };
}

async function startBot() {
    loadCmds();
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS");
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        printQRInTerminal: false,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WT6 IS ONLINE");
            if (isFirstConnect) {
                await sock.sendMessage(sock.user.id, { text: "W R O N G  T U R N  6  ✔️\n_System Armed & Ready._" });
                isFirstConnect = false;
            }
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

        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) {
                // Tunapitisha 'commands' array hapa ili menu iweze kuzisoma zote
                await cmd.execute(m, sock, Array.from(commands.values()), args);
            }
        }
    });

    // Always Online Presence
    setInterval(() => { if (sock?.user) sock.sendPresenceUpdate('available'); }, 15000);
}

app.get('/code', async (req, res) => {
    if (!sock) return res.status(503).send({ error: "Wait" });
    try {
        let code = await sock.requestPairingCode(req.query.number.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) { res.status(500).send({ error: "Busy" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(process.env.PORT || 3000, startBot);
