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
const {
    initializeFirestore,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    query,
    getDocs,
    where
} = require('firebase/firestore');

const express = require('express');
const pino = require('pino');
const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');

/* ================= STABILITY SHIELDS ================= */
process.on('unhandledRejection', e => console.log('🛡️ Rejection Shield:', e));
process.on('uncaughtException', e => console.log('🛡️ Exception Shield:', e));

/* ================= FIREBASE ================= */
const firebaseConfig = {
    apiKey: "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
    authDomain: "stanybots.firebaseapp.com",
    projectId: "stanybots",
    storageBucket: "stanybots.firebasestorage.app",
    messagingSenderId: "381983533939",
    appId: "1:381983533939:web:e6cc9445137c74b99df306"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = initializeFirestore(firebaseApp, {
    experimentalForceLongPolling: true,
    useFetchStreams: false
});

/* ================= GLOBALS ================= */
const app = express();
const commands = new Map();
const msgCache = new Map();
const activeSessions = new Map();

/* ================= FORWARD CONTEXT ================= */
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
    }
};

/* ================= SECURITY SCANNER ================= */
async function armedScanner(sock, m, s, isOwner) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        m.message.imageMessage?.caption ||
        "").toLowerCase();

    const type = getContentType(m.message);
    if (!from.endsWith('@g.us') || isOwner) return false;

    if (m.key.id?.startsWith('BAE5') && s.antiBot) {
        await sock.sendMessage(from, { delete: m.key });
        return true;
    }

    const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (s.antiTag && (mentions.includes('status@broadcast') || mentions.length > 8)) {
        await sock.sendMessage(from, { delete: m.key });
        return true;
    }

    const scams = ["bundle", "fixed match", "earn money", "investment", "free data"];
    if (s.antiScam && scams.some(w => body.includes(w))) {
        await sock.sendMessage(from, { delete: m.key });
        await sock.groupParticipantsUpdate(from, [sender], "remove");
        return true;
    }

    if (s.antiLink && body.includes('http')) {
        await sock.sendMessage(from, { delete: m.key });
        return true;
    }

    const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'].includes(type);
    if (s.antiMedia && isMedia) {
        await sock.sendMessage(from, { delete: m.key });
        return true;
    }

    return false;
}

/* ================= USER BOT ================= */
async function startUserBot(num) {
    if (activeSessions.has(num)) return;

    const { state, saveCreds } = await useFirebaseAuthState(num);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    activeSessions.set(num, sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;

        if (connection === 'open') {
            await setDoc(doc(db, "ACTIVE_USERS", num), { active: true });
            await sock.sendMessage(sock.user.id, {
                text: "WRONG TURN 6 🥀\nSystem Online",
                contextInfo: forwardedContext
            });
        }

        if (
            connection === 'close' &&
            lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
        ) {
            activeSessions.delete(num);
            startUserBot(num);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m?.message) return;

        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation ||
            m.message.extendedTextMessage?.text ||
            m.message.imageMessage?.caption ||
            "").trim();

        msgCache.set(m.key.id, m);

        const settingsSnap = await getDoc(doc(db, "SETTINGS", num));
        const s = settingsSnap.exists()
            ? settingsSnap.data()
            : { prefix: ".", autoAI: true, antiLink: true };

        const isOwner = m.key.fromMe || sender.startsWith(num);

        if (await armedScanner(sock, m, s, isOwner)) return;

        const isCmd = body.startsWith(s.prefix);
        if (!isCmd && s.autoAI && !from.endsWith('@g.us')) {
            const res = await axios.get(
                `https://text.pollinations.ai/${encodeURIComponent(body)}`
            );
            await sock.sendMessage(from, { text: res.data }, { quoted: m });
        }

        if (isCmd) {
            const cmdName = body.slice(s.prefix.length).split(' ')[0].toLowerCase();
            const args = body.split(' ').slice(1);
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, args, db, forwardedContext);
        }
    });
}

/* ================= FIREBASE AUTH ================= */
async function useFirebaseAuthState(num) {
    const fixId = id =>
        `session_${num}_${id.replace(/\//g, '_').replace(/@/g, 'at')}`;

    const writeData = (data, id) =>
        setDoc(doc(db, "SESSIONS", fixId(id)),
            JSON.parse(JSON.stringify(data, BufferJSON.replacer)));

    const readData = async id => {
        const snap = await getDoc(doc(db, "SESSIONS", fixId(id)));
        return snap.exists()
            ? JSON.parse(JSON.stringify(snap.data()), BufferJSON.reviver)
            : null;
    };

    let creds = (await readData('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        data[id] = await readData(`${type}-${id}`);
                    }
                    return data;
                },
                set: async data => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            await writeData(data[type][id], `${type}-${id}`);
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds'),
        wipeSession: async () => {
            const q = query(
                collection(db, "SESSIONS"),
                where("__name__", ">=", `session_${num}`),
                where("__name__", "<=", `session_${num}\uf8ff`)
            );
            const snap = await getDocs(q);
            snap.forEach(d => deleteDoc(d.ref));
        }
    };
}

/* ================= PAIRING ROUTE (FIXED) ================= */
app.get('/code', async (req, res) => {
    if (!req.query.number)
        return res.status(400).send({ error: "Number required" });

    const num = req.query.number.replace(/\D/g, '');

    try {
        const { state, saveCreds, wipeSession } = await useFirebaseAuthState(num);
        await wipeSession();

        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu("Chrome"),
            printQRInTerminal: false
        });

        sock.ev.on('creds.update', saveCreds);

        await delay(3000);
        sock.authState.creds.registered = false;

        const code = await sock.requestPairingCode(num);
        res.send({ code });

        sock.ev.on('connection.update', u => {
            if (u.connection === 'open') {
                sock.ev.removeAllListeners();
                startUserBot(num);
            }
        });

    } catch (e) {
        console.error(e);
        res.status(500).send({ error: "System Busy" });
    }
});

/* ================= SERVER ================= */
app.get('/', (req, res) =>
    res.sendFile(path.join(__dirname, 'public/index.html'))
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log("🟢 WRONG TURN MAINFRAME ONLINE");

    const snap = await getDocs(collection(db, "ACTIVE_USERS"));
    snap.forEach(d => {
        if (d.data().active) startUserBot(d.id);
    });
});
