const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');

/**
 * 🥀 WRONG TURN 6 - MAIN SYSTEM
 * 🥀 DEVELOPER: STANYTZ
 * 🥀 DATABASE: FIREBASE WEB SDK (NO PRIVATE KEY MODE)
 */

// 1. FIREBASE CONFIG (WEB SDK)
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

const app = express();
const commands = new Map();
const sockCache = new Map();

// 2. DYNAMIC COMMAND LOADER
const loadCmds = () => {
    const cmdPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    
    fs.readdirSync(cmdPath).forEach(folder => {
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
    console.log(`📡 WT6: Commands Loaded: ${commands.size}`);
};

// 3. MAIN BOT FUNCTION
async function startBot() {
    loadCmds();
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    
    // Inasoma session kutoka Firestore collection 'WT6_SESSIONS'
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"), // Inasaidia Pairing Code kuwa stable
        printQRInTerminal: false
    });

    // Hifadhi sock kwenye cache kwa ajili ya Express API
    sockCache.set("sock", sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WRONG TURN 6 IS ONLINE!");
            sock.sendPresenceUpdate('available'); // Always Online
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Connection lost, restarting...");
                startBot();
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "";
        const prefix = ".";

        // --- SECURITY & AUTO FEATURES ---

        // 1. Auto Status View/Like
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]);
            // Optional: Reaction kwenye status
            await sock.sendMessage(from, { react: { text: "🥀", key: m.key } }, { statusJidList: [m.key.participant] });
        }

        // 2. Anti-Link Security
        if (body.match(/chat.whatsapp.com/gi) || body.match(/http/gi)) {
            const isAdmin = false; // Unaweza kuongeza check ya admin hapa
            if (!isAdmin && from.endsWith('@g.us')) {
                await sock.sendMessage(from, { delete: m.key });
                await sock.sendMessage(from, { text: "⚠️ *WRONG TURN 6 SECURITY:* Links are not allowed!" });
            }
        }

        // 3. Anti-Porn (Simple word filter)
        const porn = ["porn", "xxx", "ngono", "vixen"];
        if (porn.some(w => body.toLowerCase().includes(w))) {
            await sock.sendMessage(from, { delete: m.key });
        }

        // 4. Command Handler
        if (body.startsWith(prefix)) {
            const args = body.slice(prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) {
                try {
                    await cmd.execute(m, sock, Array.from(commands.values()), args);
                } catch (e) {
                    console.error("Command Error:", e);
                }
            }
        }
    });

    // 5. Anti-Call (Block incoming calls)
    sock.ev.on('call', async (c) => {
        if (c[0].status === 'offer') {
            await sock.rejectCall(c[0].id, c[0].from);
            await sock.sendMessage(c[0].from, { text: "📵 *WRONG TURN 6 SECURITY:*\nCalls are auto-rejected." });
        }
    });

    // 6. Always Online Presence Update
    setInterval(() => {
        if (sock.user) sock.sendPresenceUpdate('available');
    }, 20000);
}

// 4. EXPRESS ROUTES (Pairing System)
app.get('/code', async (req, res) => {
    let s = sockCache.get("sock");
    let num = req.query.number;
    if (!s || !num) return res.status(400).send({ error: "System Not Ready" });
    
    try {
        console.log(`📱 Requesting Pairing Code for: ${num}`);
        let code = await s.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) {
        console.error("Pairing Error:", e.message);
        res.status(500).send({ error: "Failed to generate code" });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// 5. START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Server active on Port ${PORT}`);
    startBot().catch(err => console.error("🛑 Startup Failed:", err));
});
