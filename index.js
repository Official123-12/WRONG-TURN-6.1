require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion,
    BufferJSON 
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
let sock = null;

const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    const categories = fs.readdirSync(cmdPath);
    for (const category of categories) {
        const categoryPath = path.join(cmdPath, category);
        if (fs.lstatSync(categoryPath).isDirectory()) {
            fs.readdirSync(categoryPath).filter(f => f.endsWith('.js')).forEach(file => {
                const cmd = require(path.join(categoryPath, file));
                cmd.category = category;
                commands.set(cmd.name.toLowerCase(), cmd);
            });
        }
    }
};

async function startBot() {
    loadCmds();
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
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
            console.log("WRONG TURN 6: CONNECTED");
            const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:WRONG TURN 6 ✔️\nORG:STANYTZ;\nEND:VCARD`;
            await sock.sendMessage(sock.user.id, { contacts: { displayName: 'STANYTZ', contacts: [{ vcard }] } });
            await sock.sendMessage(sock.user.id, { text: "┏━━━━ 『 WRONG TURN 6 』 ━━━━┓\n┃ 🥀 Status: Armed & Online\n┃ 🥀 Dev: STANYTZ\n┗━━━━━━━━━━━━━━━━━━━━━━━┛" });
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) setTimeout(startBot, 5000);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();
        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args);
        }
    });
}

app.get('/code', async (req, res) => {
    const num = req.query.number;
    if (!num) return res.status(400).send({ error: "Missing number" });
    if (!sock || sock.ws.readyState !== 1) return res.status(503).send({ error: "Socket warming up" });

    try {
        await delay(2000);
        const code = await sock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) {
        res.status(500).send({ error: "Connection error. Refresh." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server Online: ${PORT}`);
    startBot();
});
