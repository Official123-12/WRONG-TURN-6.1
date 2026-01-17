require('dotenv').config(); // Hii inasoma .env file
const { default: makeWASocket, DisconnectReason, Browsers, delay } = require('@whiskeysockets/baileys');
const admin = require("firebase-admin");
const express = require('express');
const path = require('path');
const pino = require('pino');

// 1. FIREBASE INITIALIZATION KUTOKA KWENYE .ENV
const serviceAccount = {
    projectId: process.env.PROJECT_ID,
    clientEmail: process.env.CLIENT_EMAIL,
    // Safisha key hapa kuzuia PEM Error
    privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, '\n')
};

try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("🔥 Firebase Connected");
    }
} catch (e) {
    console.error("❌ Firebase Init Error:", e.message);
}

const db = admin.firestore();
const commands = new Map();
const sockCache = new Map();

// 2. COMMAND LOADER
const loadCmds = () => {
    const cmdPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    const folders = fs.readdirSync(cmdPath);
    folders.forEach(folder => {
        const folderPath = path.join(cmdPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            fs.readdirSync(folderPath).forEach(file => {
                if (file.endsWith('.js')) {
                    const cmd = require(path.join(folderPath, file));
                    cmd.category = folder;
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
    const { state, saveCreds } = await useFirebaseAuthState(db.collection("SESSIONS"));
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        printQRInTerminal: false
    });

    sockCache.set("sock", sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log("✅ WRONG TURN 6 ONLINE");
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
    setInterval(() => sock.sendPresenceUpdate('available'), 20000);
}

// 3. ROUTES
app.get('/code', async (req, res) => {
    let s = sockCache.get("sock");
    if (!s || !req.query.number) return res.status(400).send({ error: "System Not Ready" });
    try {
        let code = await s.requestPairingCode(req.query.number.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) { res.status(500).send({ error: e.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Bot Running on Port ${PORT}`);
    startBot();
});
