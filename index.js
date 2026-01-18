require('dotenv').config();
const { default: makeWASocket, DisconnectReason, Browsers, delay, fetchLatestBaileysVersion, BufferJSON } = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc } = require('firebase/firestore');
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
    fs.readdirSync(cmdPath).forEach(folder => {
        const categoryPath = path.join(cmdPath, folder);
        if (fs.lstatSync(categoryPath).isDirectory()) {
            fs.readdirSync(categoryPath).filter(f => f.endsWith('.js')).forEach(file => {
                const cmd = require(path.join(categoryPath, file));
                cmd.category = folder;
                commands.set(cmd.name.toLowerCase(), cmd);
            });
        }
    });
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
            console.log("✅ WT6 IS ONLINE");
            const botId = sock.user.id.split(':')[0];
            const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:WRONG TURN 6 ✔️\nORG:STANYTZ;\nTEL;type=CELL;type=VOICE;waid=${botId}:${botId}\nEND:VCARD`;
            await sock.sendMessage(sock.user.id, { contacts: { displayName: 'STANYTZ', contacts: [{ vcard }] } });
            
            const welcome = `┏━━━━ 『 WRONG TURN 6 』 ━━━━┓\n┃\n┃ 🥀 *SYSTEM ARMED*\n┃\n┣━━━━━━━━━━━━━━━━━━━━━━━┓\n┃ 🛡️ *DEV    :* STANYTZ\n┃ ⚙️ *VERSION:* 6.6.0\n┃ 🌐 *ENGINE :* AngularSockets\n┃ 🌷 *PREFIX :* [ . ]\n┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n🥀🥂 *ACTIVE*`;
            await sock.sendMessage(sock.user.id, { text: welcome });
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();

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
    setInterval(() => { if(sock?.user) sock.sendPresenceUpdate('available'); }, 15000);
}

// FIX: ZERO-WAIT PAIRING ROUTE
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "No number" });
    
    // Anzisha socket kama haijawaka
    if (!sock) await startBot();

    try {
        await delay(1500); // Mda mfupi wa kujiweka sawa
        let code = await sock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) {
        console.error(e);
        res.status(500).send({ error: "WhatsApp Busy. Refresh." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(process.env.PORT || 3000, startBot);
