require('dotenv').config();
const { 
    default: makeWASocket, DisconnectReason, Browsers, delay, fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, initAuthCreds, BufferJSON, getContentType 
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc, collection, query, getDocs, where } = require('firebase/firestore');
const express = require('express');
const pino = require('pino');
const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');

// 🟢 GLOBAL STABILITY SHIELD
process.on('unhandledRejection', e => console.log('🛡️ Rejection Shield:', e));
process.on('uncaughtException', e => console.log('🛡️ Exception Shield:', e));

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
const activeSessions = new Map(); // Singleton Tracker

// 💎 PREMIUM FORWARDING MASK
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
 * 📦 FIREBASE AUTH STATE (SERIALIZED)
 */
async function useFirebaseAuthState(num) {
    const fixId = (id) => `session_${num}_${id.replace(/\//g, '__').replace(/\@/g, 'at')}`;
    const writeData = async (data, id) => setDoc(doc(db, "SESSIONS", fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        const snapshot = await getDoc(doc(db, "SESSIONS", fixId(id)));
        return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
    };
    let creds = await readData('creds') || initAuthCreds();
    return { state: { creds, keys: {
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
                    else await deleteDoc(doc(db, "SESSIONS", fixId(`${type}-${id}`)));
                }
            }
        }
    }}, saveCreds: () => writeData(creds, 'creds'), wipeSession: async () => {
        const q = query(collection(db, "SESSIONS"), where("__name__", ">=", `session_${num}`), where("__name__", "<=", `session_${num}\uf8ff`));
        const snap = await getDocs(q);
        snap.forEach(async d => await deleteDoc(d.ref));
    }};
}

/**
 * 🧠 SUPREME INJECTED LOGIC
 */
async function handleSupremeLogic(sock, m, db, num) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
    const type = getContentType(m.message);

    msgCache.set(m.key.id, m);
    const ownerId = sock.user.id.split(':')[0];
    const isOwner = sender.startsWith(num) || m.key.fromMe;

    const setSnap = await getDoc(doc(db, "SETTINGS", num));
    const s = setSnap.exists() ? setSnap.data() : { prefix: ".", mode: "public", autoAI: true, forceJoin: true, autoStatus: true, antiDelete: true, antiViewOnce: true };

    if (s.mode === "private" && !isOwner) return;

    // Auto Presence
    await sock.sendPresenceUpdate('composing', from);

    // Anti-Delete & ViewOnce
    if (m.message?.protocolMessage?.type === 0 && s.antiDelete && !m.key.fromMe) {
        const cached = msgCache.get(m.message.protocolMessage.key.id);
        if (cached) await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
    }
    if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2')) {
        await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
    }

    // Universal AI Chat (Natural Persona)
    const isCmd = body.startsWith(s.prefix) || commands.has(body.split(' ')[0].toLowerCase());
    if (!isCmd && !m.key.fromMe && s.autoAI && body.length > 2 && !from.endsWith('@g.us')) {
        try {
            const aiPrompt = `Your name is WRONG TURN 6. Developer: STANYTZ. Chat naturally to: ${body}`;
            const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
            await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) {}
    }

    // Command Execution
    let cmdName = body.startsWith(s.prefix) ? body.slice(s.prefix.length).trim().split(/ +/)[0].toLowerCase() : body.split(' ')[0].toLowerCase();
    let args = body.startsWith(s.prefix) ? body.slice(s.prefix.length).trim().split(/ +/).slice(1) : body.split(' ').slice(1);
    const cmd = commands.get(cmdName);
    if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
}

/**
 * 🦾 ENGINE BOOTSTRAP (SINGLETON RESTORE)
 */
async function startUserBot(num) {
    if (activeSessions.has(num)) return;
    const { state, saveCreds } = await useFirebaseAuthState(num);
    const sockInstance = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    activeSessions.set(num, sockInstance);
    sockInstance.ev.on('creds.update', saveCreds);

    sockInstance.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            await setDoc(doc(db, "ACTIVE_USERS", num), { active: true });
            const welcome = `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ ✔️`;
            await sockInstance.sendMessage(sockInstance.user.id, { text: welcome, contextInfo: forwardedContext });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            activeSessions.delete(num);
            startUserBot(num);
        }
    });

    sockInstance.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        await handleSupremeLogic(sockInstance, m, db, num);
    });
}

/**
 * 🟢 RAILWAY INDEX ROUTE (Health Anchor)
 */
app.get('/', (req, res) => {
    res.status(200).send(`
        <body style="background:#000;color:#ff0000;font-family:sans-serif;text-align:center;padding-top:100px;">
            <img src="https://files.catbox.moe/59ays3.jpg" style="width:150px;border-radius:50%;border:2px solid #ff0000;">
            <h1>W R O N G  T U R N  6</h1>
            <p>MAINFRAME STATUS: <span style="color:#00ff00">OPERATIONAL</span></p>
            <p>ACTIVE USERS: ${activeSessions.size}</p>
            <p style="color:#444">DEVELOPED BY STANYTZ</p>
        </body>
    `);
});

// 🔥 PAIRING ROUTE (ZERO ERRORS)
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    try {
        const { state, saveCreds, wipeSession } = await useFirebaseAuthState(num);
        await wipeSession();
        const pSock = makeWASocket({
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu("Chrome")
        });
        pSock.ev.on('creds.update', saveCreds);
        await delay(5000);
        let code = await pSock.requestPairingCode(num);
        res.send({ code });
        pSock.ev.on('connection.update', (u) => { if (u.connection === 'open') { pSock.end?.(); startUserBot(num); } });
    } catch (e) { res.status(500).send({ error: "System Busy" }); }
});

app.use(express.static('public'));
app.get('/link', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    // Command Loader Initialization
    const cmdPath = path.resolve(__dirname, 'commands');
    if (fs.existsSync(cmdPath)) {
        fs.readdirSync(cmdPath).forEach(folder => {
            const folderPath = path.join(cmdPath, folder);
            if (fs.lstatSync(folderPath).isDirectory()) {
                fs.readdirSync(folderPath).filter(f => f.endsWith('.js')).forEach(file => {
                    const cmd = require(path.join(folderPath, file));
                    if (cmd && cmd.name) { cmd.category = folder; commands.set(cmd.name.toLowerCase(), cmd); }
                });
            }
        });
    }
    console.log(`Armed: ${PORT}`);
    
    // 🟢 AUTO-RESTORE ALL SESSIONS FROM FIREBASE
    getDocs(collection(db, "ACTIVE_USERS")).then(snap => {
        snap.forEach(d => {
            if (d.data().active && !activeSessions.has(d.id)) startUserBot(d.id);
        });
    });
});

// Always Online Heartbeat & Bio
setInterval(async () => {
    for (let s of activeSessions.values()) {
        if (s.user) {
            const uptime = `${Math.floor(process.uptime() / 3600)}h`;
            await s.updateProfileStatus(`WRONG TURN 6 | ONLINE | ${uptime}`).catch(() => {});
            await s.sendPresenceUpdate('available');
        }
    }
}, 30000);
