require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion,
    BufferJSON,
    initAuthCreds,
    makeCacheableSignalKeyStore,
    getContentType
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');

// 1. FIREBASE CONFIG
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
const msgCache = new Map(); 
let sock = null;

// 2. FORWARDING MASK (Newsletter ID)
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'W R O N G  T U R N  B O T  ✔️'
    }
};

// 3. COMMAND LOADER
const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    fs.readdirSync(cmdPath).forEach(folder => {
        const folderPath = path.join(cmdPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            fs.readdirSync(folderPath).filter(f => f.endsWith('.js')).forEach(file => {
                try {
                    const cmd = require(path.join(folderPath, file));
                    if (cmd && cmd.name) {
                        cmd.category = folder;
                        commands.set(cmd.name.toLowerCase(), cmd);
                    }
                } catch (e) {}
            });
        }
    });
};

// 4. MAIN ENGINE
async function startBot() {
    loadCmds();
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WRONG TURN BOT: ONLINE");
            // Premium Welcome Message (No Borders)
            await sock.sendMessage(sock.user.id, { 
                text: `*W R O N G  T U R N  B O T*  ✔️\n\nSystem Armed & Operational\nDeveloped by STANYTZ\n\n*Status:* Connected\n*Engine:* AngularSockets`,
                contextInfo: forwardedContext
            });
        }
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();

        // CACHE MESSAGE FOR ANTI-DELETE
        msgCache.set(m.key.id, m);

        // --- AUTOMATION FEATURES ---

        // A. AUTO TYPING & RECORDING
        await sock.sendPresenceUpdate('composing', from);
        if (Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);

        // B. ANTI-DELETE
        if (m.message.protocolMessage?.type === 0) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: `🛡️ *RECOVERED DELETED MESSAGE*` });
                await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
            }
        }

        // C. ANTI-VIEWONCE (Auto-send to DM)
        const msgType = Object.keys(m.message)[0];
        if (msgType === 'viewOnceMessage' || msgType === 'viewOnceMessageV2') {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *CAPTURED VIEW-ONCE*` });
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // D. FORCE JOIN & FOLLOW CHECK
        if (body.startsWith('.') && !m.key.fromMe) {
            try {
                const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
                if (!groupMetadata.participants.find(p => p.id === sender)) {
                    return sock.sendMessage(from, { 
                        text: `❌ *ACCESS DENIED*\n\nYou must join the Official Group to use this bot.\n\n*Join:* https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y`,
                        contextInfo: forwardedContext
                    });
                }
            } catch (e) {}
        }

        // E. COMMAND HANDLER
        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) {
                // Pass forwardedContext to every command
                await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
            }
        }
    });

    // F. ALWAYS ONLINE
    setInterval(() => { if (sock?.user) sock.sendPresenceUpdate('available'); }, 15000);
    // G. ANTI-CALL
    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
}

// 5. PAIRING ROUTE (FIXED 428 ERROR)
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "No number" });
    try {
        const pSock = makeWASocket({
            auth: { creds: initAuthCreds(), keys: makeCacheableSignalKeyStore({}, pino({level:'silent'})) },
            logger: pino({level:'silent'}),
            browser: Browsers.macOS("Safari")
        });
        await delay(3000);
        let code = await pSock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });
        pSock.ev.on('creds.update', async (creds) => {
            await setDoc(doc(db, "WT6_SESSIONS", "MASTER_creds"), JSON.parse(JSON.stringify(creds, BufferJSON.replacer)));
        });
    } catch (e) { res.status(500).send({ error: "System Busy" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(process.env.PORT || 3000, startBot);
