require('dotenv').config();
const { default: makeWASocket, DisconnectReason, Browsers, delay, fetchLatestBaileysVersion, BufferJSON, initAuthCreds, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, collection, updateDoc } = require('firebase/firestore');
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
const msgCache = new Map();
let sock = null;
let isWelcomeSent = false;

// ELITE FORWARDED CONTEXT
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'W R O N G  T U R N  B O T  ✔️'
    }
};

const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    fs.readdirSync(cmdPath).forEach(folder => {
        const folderPath = path.join(cmdPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            fs.readdirSync(folderPath).filter(f => f.endsWith('.js')).forEach(file => {
                const cmd = require(path.join(folderPath, file));
                if (cmd && cmd.name) {
                    cmd.category = folder;
                    commands.set(cmd.name.toLowerCase(), cmd);
                }
            });
        }
    });
};

async function startBot() {
    loadCmds();
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            if (!isWelcomeSent) {
                await sock.sendMessage(sock.user.id, { 
                    text: `W R O N G  T U R N  B O T  ✔️\n\n_System Armed & Operational_\n_Developer: STANYTZ_`,
                    contextInfo: forwardedContext
                });
                isWelcomeSent = true;
            }
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();

        // 1. SETTINGS FETCH
        const setSnap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const s = setSnap.exists() ? setSnap.data() : { autoType: true, autoRecord: true, antiDelete: true, antiViewOnce: true, forceJoin: true, autoAI: true };

        // 2. FORCE JOIN CHECK
        if (body.startsWith('.') && !m.key.fromMe && s.forceJoin) {
            try {
                const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
                if (!groupMetadata.participants.find(p => p.id === sender)) {
                    return sock.sendMessage(from, { text: `❌ *ACCESS DENIED*\n\nYou must join the Official Group and follow the Channel to use this bot.\n\nGroup: https://chat.whatsapp.com/invite_link\n\n_Join and try again!_` }, { quoted: m });
                }
            } catch (e) {}
        }

        // 3. AUTO PRESENCE
        if (s.autoType) await sock.sendPresenceUpdate('composing', from);
        if (s.autoRecord) await sock.sendPresenceUpdate('recording', from);

        // 4. ANTI-DELETE & ANTI-VIEWONCE
        msgCache.set(m.key.id, m);
        if (m.message.protocolMessage?.type === 0 && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
        }
        const msgType = Object.keys(m.message)[0];
        if ((msgType === 'viewOnceMessage' || msgType === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // 5. AUTO AI CHAT (Global)
        if (!from.endsWith('@g.us') && !body.startsWith('.') && !m.key.fromMe && s.autoAI) {
            const axios = require('axios');
            const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(body)}`);
            await sock.sendMessage(from, { text: aiRes.data, contextInfo: forwardedContext });
        }

        // 6. ANTI-PORN / ANTI-SCAM / ANTI-LINK (GROUPS)
        if (from.endsWith('@g.us') && !m.key.fromMe) {
            const groupSnap = await getDoc(doc(db, "GROUPS", from));
            const g = groupSnap.exists() ? groupSnap.data() : { antiLink: true, antiPorn: true, antiScam: true };
            
            const isScam = /(bundle|fixed match|earn money|invest|free data)/gi.test(body);
            const isPorn = /(porn|xxx|nude|sex|vixen)/gi.test(body);
            
            if ((isScam && g.antiScam) || (isPorn && g.antiPorn) || (body.includes('http') && g.antiLink)) {
                await sock.sendMessage(from, { delete: m.key });
                // await sock.groupParticipantsUpdate(from, [sender], "remove"); // Uncomment to enable auto-remove
            }
        }

        // 7. STATUS ENGINE
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]);
            if (s.autoStatusLike) await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
        }

        // 8. COMMANDS
        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    });
}

// STABLE PAIRING
app.get('/code', async (req, res) => {
    let num = req.query.number;
    const pSock = makeWASocket({ auth: { creds: initAuthCreds(), keys: makeCacheableSignalKeyStore({}, pino({level:'silent'})) }, logger: pino({level:'silent'}), browser: Browsers.macOS("Safari") });
    await delay(3000);
    let code = await pSock.requestPairingCode(num.replace(/\D/g, ''));
    res.send({ code });
    pSock.ev.on('creds.update', async (creds) => { await setDoc(doc(db, "WT6_SESSIONS", "MASTER_creds"), JSON.parse(JSON.stringify(creds, BufferJSON.replacer))); });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(process.env.PORT || 3000, startBot);
