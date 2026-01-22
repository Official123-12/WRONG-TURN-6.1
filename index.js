require('dotenv').config();

const {
    default: makeWASocket,
    DisconnectReason,
    Browsers,
    delay,
    initAuthCreds,
    BufferJSON
} = require('@whiskeysockets/baileys');

const { initializeApp } = require('firebase/app');
const {
    initializeFirestore,
    doc,
    getDoc,
    setDoc,
    deleteDoc
} = require('firebase/firestore');

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');

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

/* ================= EXPRESS ================= */

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= GLOBALS ================= */

let sock;
let authState;
let saveCreds;
const commands = new Map();

/* ================= COMMAND LOADER ================= */

function loadCommands() {
    const base = path.join(__dirname, 'commands');
    if (!fs.existsSync(base)) fs.mkdirSync(base);

    for (const folder of fs.readdirSync(base)) {
        const dir = path.join(base, folder);
        if (!fs.lstatSync(dir).isDirectory()) continue;

        for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
            const cmd = require(path.join(dir, file));
            if (cmd?.name) {
                cmd.category = folder;
                commands.set(cmd.name.toLowerCase(), cmd);
            }
        }
    }
}

/* ================= FIREBASE AUTH STATE ================= */

async function useFirebaseAuthState(collection, session) {
    const fix = id => `${session}_${id.replace(/\//g, '__')}`;

    const read = async id => {
        const snap = await getDoc(doc(db, collection, fix(id)));
        return snap.exists()
            ? JSON.parse(JSON.stringify(snap.data()), BufferJSON.reviver)
            : null;
    };

    const write = async (data, id) =>
        setDoc(doc(db, collection, fix(id)),
            JSON.parse(JSON.stringify(data, BufferJSON.replacer)));

    const remove = async id =>
        deleteDoc(doc(db, collection, fix(id)));

    const creds = await read('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        data[id] = await read(`${type}-${id}`);
                    }
                    return data;
                },
                set: async data => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            const val = data[type][id];
                            val ? await write(val, `${type}-${id}`)
                                : await remove(`${type}-${id}`);
                        }
                    }
                }
            }
        },
        saveCreds: () => write(creds, 'creds')
    };
}

/* ================= INIT AUTH ================= */

async function initAuth() {
    const auth = await useFirebaseAuthState("WT6_SESSIONS", "MASTER");
    authState = auth.state;
    saveCreds = auth.saveCreds;
}

/* ================= START BOT ================= */

async function startBot() {
    loadCommands();

    sock = makeWASocket({
        auth: authState,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        markOnlineOnConnect: true,
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
            console.log("✅ WRONG TURN 6 CONNECTED");
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) {
                console.log("♻️ Reconnecting...");
                startBot();
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const body =
            m.message.conversation ||
            m.message.extendedTextMessage?.text ||
            "";

        if (!body.startsWith('.')) return;

        const args = body.slice(1).trim().split(/ +/);
        const cmd = commands.get(args.shift().toLowerCase());
        if (cmd) await cmd.execute(m, sock, args);
    });

    sock.ev.on('call', async c =>
        sock.rejectCall(c[0].id, c[0].from)
    );
}

/* ================= PAIRING ROUTE ================= */

app.get('/code', async (req, res) => {
    try {
        const num = req.query.number?.replace(/\D/g, '');
        if (!num) return res.status(400).json({ error: "Missing number" });

        if (!sock) {
            await initAuth();
            await startBot();
            await delay(3000);
        }

        const code = await sock.requestPairingCode(num);
        res.json({ code });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Pairing failed" });
    }
});

/* ================= WEB ================= */

app.get('/', (req, res) =>
    res.sendFile(path.join(__dirname, 'public/index.html'))
);

/* ================= START SERVER ================= */

app.listen(PORT, async () => {
    console.log(`🌐 Server running on ${PORT}`);
    await initAuth();
    await startBot();
});
