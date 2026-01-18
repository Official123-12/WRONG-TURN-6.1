require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    fetchLatestBaileysVersion,
    BufferJSON 
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, limit, query } = require('firebase/firestore');
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
const sockCache = new Map();

/**
 * DYNAMIC COMMAND LOADER (STRICT PATHS)
 */
const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    
    fs.readdirSync(cmdPath).forEach(folder => {
        const folderPath = path.join(cmdPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            fs.readdirSync(folderPath).forEach(file => {
                if (file.endsWith('.js')) {
                    try {
                        const cmd = require(path.join(folderPath, file));
                        cmd.category = folder;
                        commands.set(cmd.name.toLowerCase(), cmd);
                    } catch (e) { console.error(`Error loading ${file}:`, e); }
                }
            });
        }
    });
    console.log(`📡 WRONG TURN 6: ${commands.size} Commands Operational.`);
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
        state: {
            creds,
            keys: {
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
    const { state, saveCreds } = await useFirebaseAuthState(db, "WRONG_TURN_6_SESSIONS");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        markOnlineOnConnect: true
    });

    sockCache.set("sock", sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log("WRONG TURN 6: ARMED");
            
            // PREMIMUM WELCOME MESSAGE ON CONNECTION
            const welcomeText = `┏━━━━ 『 WRONG TURN 6 』 ━━━━┓\n` +
                                `┃ 🥀 *Status:* Connected Successfully\n` +
                                `┃ 🥀 *Developer:* STANYTZ\n` +
                                `┃ 🥀 *Engine:* AngularSockets\n` +
                                `┃ 🥀 *Security:* Active\n` +
                                `┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                                `_System is now monitoring your WhatsApp._\n` +
                                `_Type *.menu* to begin._`;
            
            await sock.sendMessage(sock.user.id, { text: welcomeText });
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
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
        const sender = m.key.participant || from;

        // AUTO PRESENCE
        await sock.sendPresenceUpdate('composing', from);
        if (Math.random() > 0.7) await sock.sendPresenceUpdate('recording', from);

        // ANTI-LINK (STRICT)
        if (/(https?:\/\/[^\s]+)/g.test(body) && from.endsWith('@g.us')) {
            const groupMetadata = await sock.groupMetadata(from);
            const isBotAdmin = groupMetadata.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;
            const isSenderAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin;
            if (isBotAdmin && !isSenderAdmin) {
                await sock.sendMessage(from, { delete: m.key });
                return;
            }
        }

        // MOOD GUESSER FOR STATUS
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]);
            const statusContent = m.message.extendedTextMessage?.text || "";
            if (statusContent.length > 5) {
                const moodRes = /(sad|😭|💔|cry)/.test(statusContent.toLowerCase()) ? "WT6 detected sadness. Stay strong. 🥀" : 
                                /(happy|🔥|🚀|win)/.test(statusContent.toLowerCase()) ? "Success detected. Keep winning. 🥂" : "Observed by Wrong Turn 6. 🥀";
                await sock.sendMessage(from, { text: moodRes }, { quoted: m });
            }
            return;
        }

        // COMMAND HANDLING
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
        await sock.sendMessage(c[0].from, { text: "📵 *WRONG TURN 6:* Incoming calls are auto-blocked." });
    });

    setInterval(async () => { if (sock.user) await sock.sendPresenceUpdate('available'); }, 15000);
}

app.get('/code', async (req, res) => {
    let s = sockCache.get("sock");
    if (!s || !req.query.number) return res.status(400).send({ error: "Initializing" });
    try {
        let code = await s.requestPairingCode(req.query.number.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) { res.status(500).send({ error: e.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`System Online: ${PORT}`);
    startBot();
});
