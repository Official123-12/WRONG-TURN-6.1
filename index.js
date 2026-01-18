const { default: makeWASocket, DisconnectReason, Browsers, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');
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
const db = getFirestore(firebaseApp);
const commands = new Map();
const sockCache = new Map();

const loadCmds = () => {
    const cmdPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    fs.readdirSync(cmdPath).forEach(dir => {
        const fullPath = path.join(cmdPath, dir);
        if (fs.lstatSync(fullPath).isDirectory()) {
            fs.readdirSync(fullPath).forEach(file => {
                if (file.endsWith('.js')) {
                    const cmd = require(path.join(fullPath, file));
                    cmd.category = dir;
                    commands.set(cmd.name, cmd);
                }
            });
        }
    });
};

const app = express();
app.use(express.static('public'));

async function startBot() {
    loadCmds();
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        printQRInTerminal: false
    });

    sockCache.set("sock", sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log("✅ WRONG TURN 6 ONLINE (ANGULARSOCKETS)");
        if (u.connection === 'close') startBot();
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || "";

        if (from === 'status@broadcast') return sock.readMessages([m.key]);
        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmd = commands.get(args.shift().toLowerCase());
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args);
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
    setInterval(() => { if(sock.user) sock.sendPresenceUpdate('available'); }, 20000);
}

app.get('/code', async (req, res) => {
    let s = sockCache.get("sock");
    if (!s || !req.query.number) return res.status(400).send({ error: "System Error" });
    try {
        let code = await s.requestPairingCode(req.query.number.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) { res.status(500).send({ error: e.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(process.env.PORT || 3000, startBot);
