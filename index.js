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
const sessions = new Map(); // Multiple users tracking

// PREMIUM FORWARDING MASK
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
    }
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

/**
 * ATOMIC AUTH HANDLER (SOLVES LINKING ERROR)
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
 * AUTOMATION INJECTION (ALL FEATURES discussed)
 */
async function injectFeatures(sock, m) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
    const type = getContentType(m.message);

    msgCache.set(m.key.id, m);

    // 1. AUTO PRESENCE
    await sock.sendPresenceUpdate('composing', from);

    // 2. ANTI-DELETE & VIEWONCE (DM Owner)
    if (m.message.protocolMessage?.type === 0 && !m.key.fromMe) {
        const cached = msgCache.get(m.message.protocolMessage.key.id);
        if (cached) {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ* @${sender.split('@')[0]}`, mentions: [sender] });
            await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
        }
    }
    if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
        await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
    }

    // 3. FORCE JOIN & FOLLOW
    if (body.startsWith('.') && !m.key.fromMe) {
        const groupJid = '120363406549688641@g.us';
        try {
            const groupMetadata = await sock.groupMetadata(groupJid);
            if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
            }
        } catch (e) {}
    }

    // 4. AUTO-AI CHAT (Universal Personality)
    if (!body.startsWith('.') && !m.key.fromMe && body.length > 2 && !from.endsWith('@g.us')) {
        try {
            const aiPrompt = `You are WRONG TURN 6 by STANYTZ. Reply naturally and briefly in the same language as the user: ${body}`;
            const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
            await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) {}
    }

    // 5. GROUP PROTECT (PORN/LINK/SCAM)
    if (from.endsWith('@g.us') && !m.key.fromMe) {
        const isDemon = /(porn|xxx|sex|ngono|bundle|fixed match|invest)/gi.test(body);
        if (isDemon || body.includes('http')) await sock.sendMessage(from, { delete: m.key });
        await setDoc(doc(db, "ACTIVITY", from), { [sender]: Date.now() }, { merge: true });
    }

    // 6. COMMAND EXECUTION
    if (body.startsWith('.')) {
        const args = body.slice(1).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const cmd = commands.get(cmdName);
        if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
    }
}

/**
 * ENGINE BOOTSTRAP
 */
async function startUserBot(num) {
    const auth = await useFirebaseAuthState(num);
    const sock = makeWASocket({
        auth: auth.state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"), // Fixed stable pairing string
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000
    });

    sessions.set(num, sock);
    sock.ev.on('creds.update', auth.saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            const welcome = `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ`;
            await sock.sendMessage(sock.user.id, { text: welcome, contextInfo: forwardedContext });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            startUserBot(num);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        await injectFeatures(sock, m);
    });

    // ALWAYS ONLINE & BIO
    setInterval(async () => {
        if (sock.user) {
            await sock.sendPresenceUpdate('available');
            const uptime = `${Math.floor(process.uptime() / 3600)}h`;
            await sock.updateProfileStatus(`WRONG TURN 6 | ONLINE | ${uptime}`).catch(() => {});
        }
    }, 30000);
}

/**
 * PAIRING ROUTE (INDUSTRIAL FIX)
 */
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    if (!num) return res.status(400).send({ error: "Missing Number" });

    try {
        const auth = await useFirebaseAuthState(num);
        await auth.clearAll(); // Wipe old mismatched keys

        const pSock = makeWASocket({
            auth: auth.state,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Safari") 
        });

        await delay(5000); // Handshake stabilization
        let code = await pSock.requestPairingCode(num);
        res.send({ code });

        pSock.ev.on('creds.update', auth.saveCreds);
        pSock.ev.on('connection.update', (u) => {
            if (u.connection === 'open') startUserBot(num);
        });

    } catch (e) {
        console.error(e);
        res.status(5000).send({ error: "WhatsApp Busy" });
    }
});

app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(process.env.PORT || 3000, () => { loadCmds(); console.log("Mainframe Armed."); });
