const { default: makeWASocket, DisconnectReason, Browsers, delay } = require('@whiskeysockets/baileys');
const admin = require("firebase-admin");
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');

// 1. FIREBASE SETUP
const serviceAccount = {
  "project_id": "stanybots",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDcpy6S8a0fJbRT\n7mcDBeJgh1Q4i0M296SiI/fq6YkJ5adOh9zQd70Km5tLttt9IajHJ1NdSjZLSnGT\n3NSTsvUxB2PoWPSZtqsL0AyDLmoJx3PEGel5EBvPpD3NWfu9kaTdF9OMKuu2WZUj\nxW4S9HX0M9KAuSCdTFRVCWFozEqf2e+7Obhj8bFIUbUICjqLSh9SsKtxdGxJ9wq0\n6BttfemM2/GhseCuRfu7/0bmiYjbqAwGTEuw3uuKW6+r6sQV5+068E3yjAIgYj3B\n82v7Zwt8XytJfGa6CV+Kj1esHytQPJJ4+x5fpwW0b0mMq6y6Tp77+wiqXQwle5zB\n6rI5CzxnAgMBAAECggEAFEgpt8gPKbXFhZF8VoLL9CN8UlY6r2rD70NvHmCpAAfk\nAQvr+B2JetgixirgsffOE8BBoWmY5ALLvdOmloz0jLUpMco7cYWg400UWVqC1LNI\nqNXY6A/a/pMSOzXyNdKVXN07zL6FPBWv58HWBFgEH5ZD2yEpJkxF1CswkPl2QosR\n/zqeRYuYjWRica/ztaizNk+NC4cy7h0uqiLzA0BYJn/ZTkOypTkYvUafoQEKxtsp\nvZrEQ+d4p/2wLYF9SnWv218Y9b5fsZJESzaUQbNazNZwcNaSFFYmiY2dTm5pleOU\nPfFcYm8eQukVxcN4KORWc7BmUxaxBGHW+1mBSyX3QQKBgQD84KRIMODhT5sP3bel\nDFOVKOg3i6PhUMigkXrXJIUsHPibd63pnVEeXr850fVuRBVERXjpBlC+aMoA90Tz\nzaSLILPY5WIniePLH6ben5T3wC9iYU0wO3ZkwJqW1jZ47CfCnxrmv70TpuPP/kKc\nMnMDyxMpb4zCHzG6YREVIXYeRQKBgQDfYK1XtuVgaxMf+kjV2jp/U3t54uobPH3D\n65pDrnslLZfe6eNJ+woHlxKgTgFqJnMjLGff1Tu1e7t99CbieRfEplmCyNttzHdm\nKXyCzr+G+llgkNpvfIZHS6ZEksay41oTcO0JkSVpTCCxs2osOSICM6yhi9qnYvre\nE/7QOviguwKBgQDbJ2CYw+uQuKnc5T0LyBQD2BDwWo+rbJSDO7FNppMa5vJhhN\nty4fEOPPG1wFtPFtWnwAD54Ydr5ieemDFXx9qtjSp3EabRFC72px04GJ+T/XlhYM\nL+xaQuV2xa0tvRR0QelRg2g8yMz0bBmUPtCYv/0aUvd9IQW6zfa9BmPUtQKBgC42\nG+ZHihB2VlCJQMQtD2kD5kmC7heQXhxIA3P5BrTcR8zv6fuGGb8UO+A6AwToy2z9\ZMfjnySeYl1eQyUbFBW0rFPoJa0DXbge4QlWqDzOUesuTGJACq95MP6CtuSPMDVR\naVhPVMQB4cmhaleXwjdeZVpOSn/SdD+5Nz/w0zq9AoGAO7j7hc9SRacoTUU2MJOT\n6+y8q1hFUuOb+tb3LwHzkdQ5kyHyNs5PT0Ib994jAon7Ocfl8bL6ILtNDMBiKVXf\nkg3B0lPkRSW+cDAUAENasCH3OrQrlYVceYnmu/Yc2K3nOvoJS2BLiGa/aCjCPHE2\nNVhK+Ycb7OpMDt2fyWIkyEY=\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@stanybots.iam.gserviceaccount.com"
};

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log("🔥 Firebase Initialized Successfully");
}
const db = admin.firestore();

const app = express();
const commands = new Map();

async function startBot() {
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    console.log("📡 Connecting to Session Storage...");
    
    const { state, saveCreds } = await useFirebaseAuthState(db.collection("WT6_SESSIONS"));
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        printQRInTerminal: false
    });

    // 🚀 ROUTE YA PAIRING CODE
    app.get('/code', async (req, res) => {
        let num = req.query.number;
        if (!num) return res.status(400).send({ error: "No number provided" });
        
        console.log(`📱 Pairing request received for: ${num}`);
        
        try {
            // Hakikisha bot haija-unganishwa tayari
            if (sock.authState.creds.registered) {
                console.log("⚠️ Bot already registered!");
            }
            
            await delay(1500); // Kuzuia rate limiting
            let code = await sock.requestPairingCode(num.replace(/\D/g, ''));
            console.log(`✅ Code Generated: ${code}`);
            res.send({ code });
        } catch (err) {
            console.error("❌ Pairing Error:", err.message);
            res.status(500).send({ error: "Failed to generate code: " + err.message });
        }
    });

    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log("🔓 WRONG TURN 6: CONNECTED SUCCESSFULLY!");
            sock.sendPresenceUpdate('available');
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`🔌 Connection closed. Reason: ${reason}`);
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    // Always Online Loop
    setInterval(() => {
        if(sock.user) sock.sendPresenceUpdate('available');
    }, 30000);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Server active on Port ${PORT}`);
    startBot().catch(err => console.error("🛑 Startup Error:", err));
});
