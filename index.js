const { default: makeWASocket, DisconnectReason, Browsers, delay, getContentType } = require('@whiskeysockets/baileys');
const admin = require("firebase-admin");
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');

const serviceAccount = {
    "project_id": "stanybots",
    "client_email": "firebase-adminsdk-fbsvc@stanybots.iam.gserviceaccount.com",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDcpy6S8a0fJbRT\n7mcDBeJgh1Q4i0M296SiI/fq6YkJ5adOh9zQd70Km5tLttt9IajHJ1NdSjZLSnGT\n3NSTsvUxB2PoWPSZtqsL0AyDLmoJx3PEGel5EBvPpD3NWfu9kaTdF9OMKuu2WZUj\nxW4S9HX0M9KAuSCdTFRVCWFozEqf2e+7Obhj8bFIUbUICjqLSh9SsKtxdGxJ9wq0\n6BttfemM2/GhseCuRfu7/0bmiYjbqAwGTEuw3uuKW6+r6sQV5+068E3yjAIgYj3B\n82v7Zwt8XytJfGa6CV+Kj1esHytQPJJ4+x5fpwW0b0mMq6y6Tp77+wiqXQwle5zB\n6rI5CzxnAgMBAAECggEAFEgpt8gPKbXFhZF8VoLL9CN8UlY6r2rD70NvHmCpAAfk\nAQvr+B2JetgixirgsffOE8BBoWmY5ALLvdOmloz0jLUpMco7cYWg400UWVqC1LNI\nqNXY6A/a/pMSOzXyNdKVXN07zL6FPBWv58HWBFgEH5ZD2yEpJkxF1CswkPl2QosR\n/zqeRYuYjWRica/ztaizNk+NC4cy7h0uqiLzA0BYJn/ZTkOypTkYvUafoQEKxtsp\nvZrEQ+d4p/2wLYF9SnWv218Y9b5fsZJESzaUQbNazNZwcNaSFFYmiY2dTm5pleOU\nPfFcYm8eQukVxcN4KORWc7BmUxaxBGHW+1mBSyX3QQKBgQD84KRIMODhT5sP3bel\nDFOVKOg3i6PhUMigkXrXJIUsHPibd63pnVEeXr850fVuRBVERXjpBlC+aMoA90Tz\nzaSLILPY5WIniePLH6ben5T3wC9iYU0wO3ZkwJqW1jZ47CfCnxrmv70TpuPP/kKc\nMnMDyxMpb4zCHzG6YREVIXYeRQKBgQDfYK1XtuVgaxMf+kjV2jp/U3t54uobPH3D\n65pDrnslLZfe6eNJ+woHlxKgTgFqJnMjLGff1Tu1e7t99CbieRfEplmCyNttzHdm\nKXyCzr+G+llgkNpvfIZHS6ZEksay41oTcO0JkSVpTCCxs2osOSICM6yhi9qnYvre\E/7QOviguwKBgQDbJ2CYw+uQuKnc5T0LyBQD2BDwWo+rbJSDO7FNppMa5vJhhN\nty4fEOPPG1wFtPFtWnwAD54Ydr5ieemDFXx9qtjSp3EabRFC72px04GJ+T/XlhYM\nL+xaQuV2xa0tvRR0QelRg2g8yMz0bBmUPtCYv/0aUvd9IQW6zfa9BmPUtQKBgC42\nG+ZHihB2VlCJQMQtD2kD5kmC7heQXhxIA3P5BrTcR8zv6fuGGb8UO+A6AwToy2z9\ZMfjnySeYl1eQyUbFBW0rFPoJa0DXbge4QlWqDzOUesuTGJACq95MP6CtuSPMDVR\naVhPVMQB4cmhaleXwjdeZVpOSn/SdD+5Nz/w0zq9AoGAO7j7hc9SRacoTUU2MJOT\n6+y8q1hFUuOb+tb3LwHzkdQ5kyHyNs5PT0Ib994jAon7Ocfl8bL6ILtNDMBiKVXf\nkg3B0lPkRSW+cDAUAENasCH3OrQrlYVceYnmu/Yc2K3nOvoJS2BLiGa/aCjCPHE2\nNVhK+Ycb7OpMDt2fyWIkyEY=\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n')
};

if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const commands = new Map();
const sockCache = new Map();

const loadCmds = () => {
    if (!fs.existsSync('./commands')) fs.mkdirSync('./commands');
    fs.readdirSync('./commands').forEach(dir => {
        const dirPath = `./commands/${dir}`;
        if (fs.lstatSync(dirPath).isDirectory()) {
            fs.readdirSync(dirPath).forEach(file => {
                if (file.endsWith('.js')) {
                    const cmd = require(`${dirPath}/${file}`);
                    cmd.category = dir;
                    commands.set(cmd.name, cmd);
                }
            });
        }
    });
};

const app = express();
async function startBot() {
    loadCmds();
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db.collection("WRONG_TURN_6_SESSION"));
    
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
        if (body.match(/chat.whatsapp.com/gi)) return sock.sendMessage(from, { delete: m.key });

        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmd = commands.get(args.shift().toLowerCase());
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args);
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
    setInterval(() => sock.sendPresenceUpdate('available'), 20000);
}

app.get('/code', async (req, res) => {
    let s = sockCache.get("sock");
    if (!s || !req.query.number) return res.status(400).send({ error: "System Error" });
    let code = await s.requestPairingCode(req.query.number.replace(/\D/g, ''));
    res.send({ code });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(process.env.PORT || 3000, startBot);
