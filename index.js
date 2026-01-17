const { default: makeWASocket, DisconnectReason, Browsers, delay, getContentType } = require('@whiskeysockets/baileys');
const admin = require("firebase-admin");
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');

// --- ULINZI WA PRIVATE KEY (PEM FIX) ---
const rawKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDcpy6S8a0fJbRT
7mcDBeJgh1Q4i0M296SiI/fq6YkJ5adOh9zQd70Km5tLttt9IajHJ1NdSjZLSnGT
3NSTsvUxB2PoWPSZtqsL0AyDLmoJx3PEGel5EBvPpD3NWfu9kaTdF9OMKuu2WZUj
xW4S9HX0M9KAuSCdTFRVCWFozEqf2e+7Obhj8bFIUbUICjqLSh9SsKtxdGxJ9wq0
6BttfemM2/GhseCuRfu7/0bmiYjbqAwGTEuw3uuKW6+r6sQV5+068E3yjAIgYj3B
82v7Zwt8XytJfGa6CV+Kj1esHytQPJJ4+x5fpwW0b0mMq6y6Tp77+wiqXQwle5zB
6rI5CzxnAgMBAAECggEAFEgpt8gPKbXFhZF8VoLL9CN8UlY6r2rD70NvHmCpAAfk
AQvr+B2JetgixirgsffOE8BBoWmY5ALLvdOmloz0jLUpMco7cYWg400UWVqC1LNI
qNXY6A/a/pMSOzXyNdKVXN07zL6FPBWv58HWBFgEH5ZD2yEpJkxF1CswkPl2QosR
/zqeRYuYjWRica/ztaizNk+NC4cy7h0uqiLzA0BYJn/ZTkOypTkYvUafoQEKxtsp
vZrEQ+d4p/2wLYF9SnWv218Y9b5fsZJESzaUQbNazNZwcNaSFFYmiY2dTm5pleOU
PfFcYm8eQukVxcN4KORWc7BmUxaxBGHW+1mBSyX3QQKBgQD84KRIMODhT5sP3bel
DFOVKOg3i6PhUMigkXrXJIUsHPibd63pnVEeXr850fVuRBVERXjpBlC+aMoA90Tz
zaSLILPY5WIniePLH6ben5T3wC9iYU0wO3ZkwJqW1jZ47CfCnxrmv70TpuPP/kKc
MnMDyxMpb4zCHzG6YREVIXYeRQKBgQDfYK1XtuVgaxMf+kjV2jp/U3t54uobPH3D
65pDrnslLZfe6eNJ+woHlxKgTgFqJnMjLGff1Tu1e7t99CbieRfEplmCyNttzHdm
KXyCzr+G+llgkNpvfIZHS6ZEksay41oTcO0JkSVpTCCxs2osOSICM6yhi9qnYvre
E/7QOviguwKBgQDbJ2CYw+uQuKnc5T0LyBQD2BDwWo+rbJSDO7FNppMa5vJhhN
nty4fEOPPG1wFtPFtWnwAD54Ydr5ieemDFXx9qtjSp3EabRFC72px04GJ+T/XlhYM
L+xaQuV2xa0tvRR0QelRg2g8yMz0bBmUPtCYv/0aUvd9IQW6zfa9BmPUtQKBgC42
G+ZHihB2VlCJQMQtD2kD5kmC7heQXhxIA3P5BrTcR8zv6fuGGb8UO+A6AwToy2z9
ZMfjnySeYl1eQyUbFBW0rFPoJa0DXbge4QlWqDzOUesuTGJACq95MP6CtuSPMDVR
aVhPVMQB4cmhaleXwjdeZVpOSn/SdD+5Nz/w0zq9AoGAO7j7hc9SRacoTUU2MJOT
6+y8q1hFUuOb+tb3LwHzkdQ5kyHyNs5PT0Ib994jAon7Ocfl8bL6ILtNDMBiKVXf
kg3B0lPkRSW+cDAUAENasCH3OrQrlYVceYnmu/Yc2K3nOvoJS2BLiGa/aCjCPHE2
NVhK+Ycb7OpMDt2fyWIkyEY=
-----END PRIVATE KEY-----`;

const cleanKey = rawKey.replace(/\\n/g, '\n').trim();

const serviceAccount = {
    "project_id": "stanybots",
    "client_email": "firebase-adminsdk-fbsvc@stanybots.iam.gserviceaccount.com",
    "private_key": cleanKey
};

// INITIALIZE FIREBASE
if (!admin.apps.length) {
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log("🔥 FIREBASE CONNECTED SUCCESSFULLY");
    } catch (e) {
        console.error("❌ FIREBASE FATAL ERROR:", e.message);
    }
}
const db = admin.firestore();
const commands = new Map();
const sockCache = new Map();

// 2. COMMAND LOADER (Dynamic Categories)
const loadCmds = () => {
    const cmdPath = './commands';
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    fs.readdirSync(cmdPath).forEach(dir => {
        const fullPath = path.join(cmdPath, dir);
        if (fs.lstatSync(fullPath).isDirectory()) {
            fs.readdirSync(fullPath).forEach(file => {
                if (file.endsWith('.js')) {
                    const cmd = require(path.join(__dirname, fullPath, file));
                    cmd.category = dir;
                    commands.set(cmd.name, cmd);
                }
            });
        }
    });
    console.log(`📡 LOADED ${commands.size} COMMANDS`);
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
        const { connection, lastDisconnect } = u;
        if (connection === 'open') console.log("✔️ WRONG TURN 6 IS ONLINE!");
        if (connection === 'close') {
            console.log("🔄 CONNECTION CLOSED, REBOOTING...");
            startBot();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || "";

        // SECURITY: Auto Status View & Anti-Link
        if (from === 'status@broadcast') return sock.readMessages([m.key]);
        if (body.match(/chat.whatsapp.com/gi)) return sock.sendMessage(from, { delete: m.key });

        // COMMAND EXECUTION
        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args);
        }
    });

    // SECURITY: Anti-Call
    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
    
    // Always Online
    setInterval(() => { if(sock.user) sock.sendPresenceUpdate('available'); }, 20000);
}

// PAIRING CODE ROUTE
app.get('/code', async (req, res) => {
    let s = sockCache.get("sock");
    let num = req.query.number;
    if (!s || !num) return res.status(400).send({ error: "System Not Ready" });
    try {
        console.log(`📱 Generating code for: ${num}`);
        let code = await s.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) {
        console.error("❌ PAIRING ERROR:", e.message);
        res.status(500).send({ error: e.message });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 SERVER ON PORT ${PORT}`);
    startBot();
});
