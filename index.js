require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    fetchLatestBaileysVersion,
    BufferJSON 
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');

// FIREBASE CONFIG
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
let sock = null; // Global sock object

/**
 * COMMAND LOADER (SCANS SUBFOLDERS)
 */
const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    
    const categories = fs.readdirSync(cmdPath);
    for (const category of categories) {
        const categoryPath = path.join(cmdPath, category);
        if (fs.lstatSync(categoryPath).isDirectory()) {
            const files = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
            for (const file of files) {
                try {
                    const cmd = require(path.join(categoryPath, file));
                    cmd.category = category;
                    commands.set(cmd.name.toLowerCase(), cmd);
                } catch (e) { console.error(`Error loading ${file}:`, e); }
            }
        }
    }
    console.log(`📡 WRONG TURN 6: ${commands.size} Commands Operational`);
};

async function useFirebaseAuthState(db, collectionName) {
    const fixId = (id) => id.replace(/\//g, '__').replace(/\@/g, 'at');
    const writeData = async (data, id) => setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
        } catch (e) { return null; }
    };
    const removeData = async (id) => deleteDoc(doc(db, collectionName, fixId(id)));
    const creds = await readData('creds') || require('@whiskeysockets/baileys').initAuthCreds();
    return {
        state: { creds, keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            const { proto } = require('@whiskeysockets/baileys');
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
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
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

async function startBot() {
    loadCmds();
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        printQRInTerminal: false,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("🔓 WRONG TURN 6: ARMED");
            await sock.sendMessage(sock.user.id, { text: "┏━━━━ 『 WRONG TURN 6 』 ━━━━┓\n┃ 🥀 Status: Connected\n┃ 🥀 Dev: STANYTZ\n┗━━━━━━━━━━━━━━━━━━━━━━━┛" });
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔌 Connection lost. Reconnecting...");
                setTimeout(startBot, 5000); // Reconnect after 5s
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
        const sender = m.key.participant || from;

        // AUTO PRESENCE
        await sock.sendPresenceUpdate('composing', from);
        await sock.sendPresenceUpdate('recording', from);

        // ANTI-LINK (STRICT)
        if (/(https?:\/\/[^\s]+)/g.test(body) && from.endsWith('@g.us')) {
            const metadata = await sock.groupMetadata(from);
            const isBotAdmin = metadata.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;
            const isSenderAdmin = metadata.participants.find(p => p.id === sender)?.admin;
            if (isBotAdmin && !isSenderAdmin) {
                await sock.sendMessage(from, { delete: m.key });
                return;
            }
        }

        // MOOD STATUS REPLY
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]);
            const txt = m.message.extendedTextMessage?.text || "";
            if (txt.length > 5) {
                const mood = /(sad|😭|💔)/.test(txt.toLowerCase()) ? "WT6 detected sadness. Stay strong. 🥀" : 
                             /(happy|🔥|🚀)/.test(txt.toLowerCase()) ? "Success detected. Keep winning. 🥂" : "Viewed by WT6. 🥀";
                await sock.sendMessage(from, { text: mood }, { quoted: m });
            }
            return;
        }

        // COMMAND HANDLER
        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) {
                try {
                    await cmd.execute(m, sock, Array.from(commands.values()), args);
                } catch (e) { console.error(e); }
            }
        }
    });

    sock.ev.on('call', async (c) => {
        await sock.rejectCall(c[0].id, c[0].from);
        await sock.sendMessage(c[0].from, { text: "📵 *WRONG TURN 6 SECURITY:* Calls Blocked." });
    });

    setInterval(() => { if (sock && sock.user) sock.sendPresenceUpdate('available'); }, 15000);
}

// PAIRING CODE ROUTE (FIXED PRECONDITION ERROR)
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "No number" });
    
    if (!sock) return res.status(428).send({ error: "Socket not initialized. Please wait." });

    try {
        console.log(`📱 Requesting code for: ${num}`);
        // Tunahakikisha sock ipo kwenye state ya kuomba code
        let code = await sock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) {
        console.error("Pairing Error:", e.message);
        res.status(500).send({ error: "Connection closed or Busy. Refresh and try again." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 WRONG TURN 6 Server: http://localhost:${PORT}`);
    startBot();
});
