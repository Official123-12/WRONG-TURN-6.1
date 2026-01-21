require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, 
    initAuthCreds,
    BufferJSON,
    getContentType
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, updateDoc, collection, query, getDocs } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');

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

// PREMIUM FORWARDING MASK (Newsletter ID)
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
    }
};

// 2. MOOD ENGINE
const getMoodReply = (text) => {
    const t = text.toLowerCase();
    if (/(sad|cry|hurt|pain|😭|💔|😔)/.test(t)) return "Wrong Turn 6 detected sadness. Stay strong, better days ahead. 🥀";
    if (/(happy|blessed|success|win|🔥|🚀|💰)/.test(t)) return "Pure greatness! WRONG TURN 6 celebrates this win with you! 🥂";
    return "Observed by Wrong Turn 6. 🥀";
};

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

async function useFirebaseAuthState(db, collectionName, sessionId) {
    const fixId = (id) => `${sessionId}_${id.replace(/\//g, '__').replace(/\@/g, 'at')}`;
    const writeData = async (data, id) => setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
        } catch (e) { return null; }
    };
    const creds = await readData('creds') || initAuthCreds();
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            if (value) await writeData(value, `${type}-${id}`);
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

// 3. MAIN BOT ENGINE
async function startBot() {
    loadCmds();
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"), 
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WRONG TURN 6: CONNECTED");
            const welcome = `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴀᴄᴛɪᴠᴇ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ`;
            await sock.sendMessage(sock.user.id, { text: welcome, contextInfo: forwardedContext });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) setTimeout(startBot, 5000);
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
        const type = getContentType(m.message);

        msgCache.set(m.key.id, m);

        // CONFIG FETCH
        const setSnap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const s = setSnap.exists() ? setSnap.data() : { prefix: ".", mode: "public", autoAI: true, forceJoin: true, autoStatus: true };
        const ownerId = sock.user.id?.split(':')[0] || '255';
        const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

        // UNIVERSAL REPLY-BY-NUMBER
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = (quoted?.conversation || quoted?.extendedTextMessage?.text || "").toLowerCase();
        if (quoted && !isNaN(body) && body.length > 0) {
            for (let [cmdName, cmdObj] of commands) {
                if (quotedText.includes(cmdName)) {
                    await cmdObj.execute(m, sock, Array.from(commands.values()), [body.trim()], db, forwardedContext);
                    break;
                }
            }
        }

        // AUTO PRESENCE
        await sock.sendPresenceUpdate('composing', from);

        // ANTI-DELETE & VIEWONCE
        if (m.message.protocolMessage?.type === 0 && !m.key.fromMe) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
        }
        if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // FORCE JOIN (Group JID: 120363406549688641@g.us)
        if (body.startsWith(s.prefix) && !isOwner && s.forceJoin) {
            try {
                const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
                if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
                }
            } catch (e) {}
        }

        // AUTO STATUS (HUMAN)
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]);
            const moodPrompt = `React as a human friend in 1 brief English sentence to: "${body}"`;
            const aiMood = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(moodPrompt)}`);
            await sock.sendMessage(from, { text: aiMood.data, contextInfo: forwardedContext }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
        }

        // UNIVERSAL AUTO-AI CHAT
        if (!body.startsWith(s.prefix) && !m.key.fromMe && s.autoAI && body.length > 2 && !from.endsWith('@g.us')) {
            try {
                const aiPrompt = `Your name is WRONG TURN 6 by STANYTZ. Reply briefly in is origianal language act like human for everthings in 100% to: ${body}`;
                const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // COMMAND EXECUTION
        if (body.startsWith(s.prefix)) {
            const args = body.slice(s.prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
}

// 4. YOUR REQUESTED PAIRING ROUTE (INJECTED)
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Missing Number" });

    try {
        // 🔑 USE SAME FIREBASE AUTH STATE
        const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");

        const pSock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu("Chrome")
        });

        await delay(3000);

        const code = await pSock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });

        // ✅ THIS NOW SAVES PROPERLY
        pSock.ev.on('creds.update', saveCreds);

    } catch (e) {
        console.error(e);
        res.status(500).send({ error: "System Busy" });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server Online: ${PORT}`); startBot(); });

// AUTO BIO
setInterval(async () => {
    if (sock?.user) {
        const uptime = `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`;
        await sock.updateProfileStatus(`WRONG TURN 6 | ONLINE | UPTIME: ${uptime}`).catch(() => {});
        await sock.sendPresenceUpdate('available');
    }
}, 30000);
