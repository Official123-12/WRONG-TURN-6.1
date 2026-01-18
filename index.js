const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion,
    BufferJSON 
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc } = require('firebase/firestore');
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

// COMMAND LOADER: SCANS SUBFOLDERS
const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    fs.readdirSync(cmdPath).forEach(folder => {
        const folderPath = path.join(cmdPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            fs.readdirSync(folderPath).filter(f => f.endsWith('.js')).forEach(file => {
                const cmd = require(path.join(folderPath, file));
                cmd.category = folder;
                commands.set(cmd.name.toLowerCase(), cmd);
            });
        }
    });
};

async function startBot() {
    loadCmds();
    // Kila mtu anapata session yake kulingana na namba yake
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER_SESSION");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"), // Stable for Pairing Code
        printQRInTerminal: false,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            const botId = sock.user.id.split(':')[0];
            const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:WRONG TURN 6 ✔️\nORG:STANYTZ;\nTEL;type=CELL;type=VOICE;waid=${botId}:${botId}\nEND:VCARD`;
            
            // 1. Send VCard
            await sock.sendMessage(sock.user.id, { contacts: { displayName: 'STANYTZ', contacts: [{ vcard }] } });

            // 2. Send Strictly Vertical Premium Welcome
            const welcome = `┏━━━━ 『 WRONG TURN 6 』 ━━━━┓\n` +
                            `┃\n` +
                            `┃ 🥀 *SYSTEM ARMED & ACTIVE*\n` +
                            `┃\n` +
                            `┣━━━━━━━━━━━━━━━━━━━━━━━┓\n` +
                            `┃ 🛡️ *DEV    :* STANYTZ\n` +
                            `┃ ⚙️ *VERSION:* 6.6.0\n` +
                            `┃ 🌐 *ENGINE :* Online\n` +
                            `┃ 🌷 *PREFIX :* [ . ]\n` +
                            `┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                            `_System is now monitoring your device._\n` +
                            `_Type .menu to access mainframe._\n\n` +
                            `🥀🥂 *STANYTZ INDUSTRIES*`;
            
            await sock.sendMessage(sock.user.id, { text: welcome });
            console.log("WRONG TURN 6: ONLINE");
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

        // AUTO PRESENCE
        await sock.sendPresenceUpdate('composing', from);
        await sock.sendPresenceUpdate('recording', from);

        // ANTI-LINK (STRICT)
        if (/(https?:\/\/[^\s]+)/g.test(body) && from.endsWith('@g.us')) {
            const meta = await sock.groupMetadata(from);
            const botAdmin = meta.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;
            if (botAdmin) await sock.sendMessage(from, { delete: m.key });
        }

        // COMMANDS
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

// PAIRING CODE ROUTE (FIXED 428 ERROR)
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Number required" });
    
    // Inasubiri socket iwe tayari kabisa kuzuia Precondition Required
    if (!sock || sock.ws.readyState !== 1) {
        return res.status(503).send({ error: "Socket warming up. Refresh in 5s." });
    }

    try {
        await delay(2000); // Stabilization delay
        let code = await sock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) {
        res.status(500).send({ error: "Server busy. Try again." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Port: ${PORT}`);
    startBot();
});
