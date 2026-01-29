require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    initAuthCreds,
    BufferJSON,
    makeCacheableSignalKeyStore,
    getContentType
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } = require('firebase/firestore');
const express = require('express');
const pino = require('pino');
const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');

// 1. FIREBASE SETUP
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
const activeSockets = new Map(); // Stores active sockets for multi-users
const msgCache = new Map();

// PREMIUM NEWSLETTER CONTEXT
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
    }
};

/**
 * DYNAMIC COMMAND LOADER
 */
const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    fs.readdirSync(cmdPath).forEach(folder => {
        const folderPath = path.join(cmdPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            fs.readdirSync(folderPath).filter(f => f.endsWith('.js')).forEach(file => {
                const cmd = require(path.join(folderPath, file));
                if (cmd.name) {
                    cmd.category = folder;
                    commands.set(cmd.name.toLowerCase(), cmd);
                }
            });
        }
    });
};

/**
 * MULTI-USER FIREBASE AUTH
 */
async function useFirebaseAuthState(num) {
    const fixId = (id) => `session_${num}_${id.replace(/\//g, '__').replace(/\@/g, 'at')}`;
    const writeData = async (data, id) => setDoc(doc(db, "SESSIONS", fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        const snapshot = await getDoc(doc(db, "SESSIONS", fixId(id)));
        return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
    };
    const removeData = async (id) => deleteDoc(doc(db, "SESSIONS", fixId(id)));

    let creds = await readData('creds') || initAuthCreds();
    return {
        state: { creds, keys: {
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
                        value ? await writeData(value, `${type}-${id}`) : await removeData(`${type}-${id}`);
                    }
                }
            }
        }},
        saveCreds: () => writeData(creds, 'creds'),
        clearAll: () => removeData('creds')
    };
}

/**
 * CORE LOGIC ENGINE (AI, PROTECTION, GROUP)
 */
async function handleSupremeLogic(sock, m) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
    const type = getContentType(m.message);

    msgCache.set(m.key.id, m);
    const ownerId = sock.user.id.split(':')[0];
    const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

    // 1. FETCH SETTINGS
    const setSnap = await getDoc(doc(db, "SETTINGS", ownerId));
    const s = setSnap.exists() ? setSnap.data() : { prefix: ".", mode: "public", autoAI: true, forceJoin: true, autoStatus: true, antiDelete: true };

    // 2. MODE CHECK
    if (s.mode === "private" && !isOwner) return;

    // 3. AUTO PRESENCE
    await sock.sendPresenceUpdate('composing', from);

    // 4. REPLY-BY-NUMBER (UNIVERSAL)
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = (quoted?.conversation || quoted?.extendedTextMessage?.text || "").toLowerCase();
    if (quoted && !isNaN(body) && body.length > 0) {
        for (let [cmdName, cmdObj] of commands) {
            if (quotedText.includes(cmdName)) {
                await cmdObj.execute(m, sock, Array.from(commands.values()), [body.trim()], db, forwardedContext);
                return;
            }
        }
    }

    // 5. ANTI-DELETE & VIEWONCE (DM Owner)
    if (m.message.protocolMessage?.type === 0 && !m.key.fromMe && s.antiDelete) {
        const cached = msgCache.get(m.message.protocolMessage.key.id);
        if (cached) {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ* Recovered from @${sender.split('@')[0]}`, mentions: [sender] });
            await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
        }
    }
    if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
        await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ*` });
        await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
    }

    // 6. FORCE JOIN (Group: 120363406549688641@g.us)
    const prefix = s.prefix || ".";
    const isCommand = body.startsWith(prefix) || commands.has(body.split(' ')[0].toLowerCase());
    
    if (isCommand && !isOwner && s.forceJoin) {
        try {
            const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
            if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
            }
        } catch (e) {}
    }

    // 7. AUTO STATUS (LIKE + HUMAN AI REACTION)
    if (from === 'status@broadcast' && s.autoStatus) {
        await sock.readMessages([m.key]);
        const moodPrompt = `React as a cool human friend to: "${body}". Brief, natural English. No quotes.`;
        const aiMood = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(moodPrompt)}`);
        await sock.sendMessage(from, { text: aiMood.data, contextInfo: forwardedContext }, { quoted: m });
        await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
    }

    // 8. UNIVERSAL AUTO-AI CHAT
    if (!isCommand && !m.key.fromMe && s.autoAI && body.length > 2 && !from.endsWith('@g.us')) {
        try {
            const aiRes = await axios.get(`https://text.pollinations.ai/Your name is WRONG TURN 6. Developer: STANYTZ. Chat naturally to: ${encodeURIComponent(body)}`);
            await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) {}
    }

    // 9. COMMAND EXECUTION (Prefix or No Prefix)
    let cmdName = body.startsWith(prefix) ? body.slice(prefix.length).trim().split(/ +/)[0].toLowerCase() : body.split(' ')[0].toLowerCase();
    let args = body.startsWith(prefix) ? body.slice(prefix.length).trim().split(/ +/).slice(1) : body.split(' ').slice(1);
    
    const cmd = commands.get(cmdName);
    if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
}

/**
 * MULTI-USER BOOTSTRAP
 */
async function startUserBot(num) {
    const auth = await useFirebaseAuthState(num);
    const sock = makeWASocket({
        auth: auth.state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"],
        markOnlineOnConnect: true
    });

    activeSockets.set(num, sock);
    sock.ev.on('creds.update', auth.saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            await sock.sendMessage(sock.user.id, { text: "ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ", contextInfo: forwardedContext });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startUserBot(num);
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        await handleSupremeLogic(sock, m);
    });
}

/**
 * PAIRING API (INDUSTRIAL STABLE HANDSHAKE)
 */
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    if (!num) return res.status(400).send({ error: "No number" });

    try {
        const auth = await useFirebaseAuthState(num);
        await auth.clearAll(); // Wipe old session for clean link

        const pSock = makeWASocket({
            auth: auth.state,
            logger: pino({ level: 'silent' }),
            browser: ["Ubuntu", "Chrome", "110.0.5481.177"]
        });

        // 🟢 FIX: CRITICAL HANDSHAKE PERSISTENCE
        pSock.ev.on('creds.update', auth.saveCreds);

        await delay(5000); 
        let code = await pSock.requestPairingCode(num);
        res.send({ code });

        pSock.ev.on('connection.update', (u) => {
            if (u.connection === 'open') startUserBot(num);
        });

    } catch (e) { res.status(500).send({ error: "System Busy" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { loadCmds(); console.log(`Armed: ${PORT}`); });
