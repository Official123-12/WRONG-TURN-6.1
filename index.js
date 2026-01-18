require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    getContentType,
    BufferJSON
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc, collection, query, getDocs, where } = require('firebase/firestore');
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
const db = initializeFirestore(firebaseApp, {
    experimentalForceLongPolling: true,
    useFetchStreams: false
});

const app = express();
const commands = new Map();
const sockCache = new Map();

/**
 * FIREBASE AUTH STATE HANDLER
 */
async function useFirebaseAuthState(db, collectionName) {
    const fixId = (id) => id.replace(/\//g, '__').replace(/\@/g, 'at');
    const writeData = async (data, id) => {
        return await setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    };
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
        } catch (e) { return null; }
    };
    const removeData = async (id) => { try { await deleteDoc(doc(db, collectionName, fixId(id))); } catch (e) {} };

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

/**
 * MOOD ANALYZER FOR STATUS REPLIES
 */
const analyzeMood = (text) => {
    const input = text.toLowerCase();
    if (/(sad|cry|pain|hurt|depressed|😭|💔|😔)/.test(input)) return "Wrong Turn 6 detected sadness. Stay strong, better days ahead. 🥀";
    if (/(happy|win|success|blessed|🔥|🚀|💰)/.test(input)) return "Success confirmed. WRONG TURN 6 celebrates your win! 🥂";
    if (/(love|heart|marriage|date|❤️|💍)/.test(input)) return "Love is the ultimate logic. WRONG TURN 6 approves. ✨";
    if (/(angry|mad|hate|fuck|snake|🤬)/.test(input)) return "Detected negative energy. Stay focused, ignore the noise. 🛡️";
    return "WRONG TURN 6: Interesting update. Keep moving forward. 🥀";
};

/**
 * DYNAMIC COMMAND LOADER
 */
const loadCommands = () => {
    const cmdPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    fs.readdirSync(cmdPath).forEach(folder => {
        const folderPath = path.join(cmdPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            fs.readdirSync(folderPath).forEach(file => {
                if (file.endsWith('.js')) {
                    const cmd = require(path.join(folderPath, file));
                    cmd.category = folder;
                    commands.set(cmd.name, cmd);
                }
            });
        }
    });
};

/**
 * MAIN BOT ENGINE
 */
async function startBot() {
    loadCommands();
    const { state, saveCreds } = await useFirebaseAuthState(db, "WRONG_TURN_6_SESSIONS");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        printQRInTerminal: false,
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: true
    });

    sockCache.set("sock", sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log("WRONG TURN 6: SYSTEM ARMED. STATUS: ONLINE");
            sock.sendPresenceUpdate('available');
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
        const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "";
        const sender = m.key.participant || from;

        // TRACK USER ACTIVITY PERSISTENTLY
        if (from.endsWith('@g.us')) {
            await setDoc(doc(db, "ACTIVITY", from), { [sender]: Date.now() }, { merge: true });
        }

        // AUTO PRESENCE (TYPING/RECORDING)
        await sock.sendPresenceUpdate('composing', from);
        if (Math.random() > 0.6) await sock.sendPresenceUpdate('recording', from);

        // STATUS HANDLER (VIEW + MOOD REPLY)
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]);
            const statusText = m.message.extendedTextMessage?.text || "";
            if (statusText.length > 5) {
                const moodReply = analyzeMood(statusText);
                await sock.sendMessage(from, { text: moodReply }, { quoted: m });
            }
            return;
        }

        // ANTI-LINK (REMOVES ALL LINKS)
        if (/(https?:\/\/[^\s]+)/g.test(body)) {
            const groupMetadata = from.endsWith('@g.us') ? await sock.groupMetadata(from) : null;
            const isBotAdmin = groupMetadata ? groupMetadata.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin : false;
            const isSenderAdmin = groupMetadata ? groupMetadata.participants.find(p => p.id === sender)?.admin : false;

            if (isBotAdmin && !isSenderAdmin && from.endsWith('@g.us')) {
                await sock.sendMessage(from, { delete: m.key });
                return;
            }
        }

        // COMMAND EXECUTION
        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            
            // CORE GROUP MANAGEMENT
            if (cmdName === 'active') {
                const snap = await getDoc(doc(db, "ACTIVITY", from));
                if (!snap.exists()) return sock.sendMessage(from, { text: "No activity records found." });
                const activity = snap.data();
                let list = `┏━━━━ 『 WRONG TURN 6 ACTIVE 』 ━━━━┓\n`;
                Object.keys(activity).forEach(u => {
                    list += `┃ 🥀 @${u.split('@')[0]}\n`;
                });
                list += `┗━━━━━━━━━━━━━━━━━━━━━━━┛`;
                await sock.sendMessage(from, { text: list, mentions: Object.keys(activity) });
            }

            if (cmdName === 'clean') {
                const metadata = await sock.groupMetadata(from);
                const isBotAdmin = metadata.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;
                if (!isBotAdmin) return m.reply("Error: Bot must be Admin to clean.");

                const snap = await getDoc(doc(db, "ACTIVITY", from));
                const activity = snap.exists() ? snap.data() : {};
                const now = Date.now();
                let removed = 0;

                for (let participant of metadata.participants) {
                    const lastActive = activity[participant.id] || 0;
                    if (now - lastActive > 86400000 && !participant.admin) { // 24H Inactivity
                        await sock.groupParticipantsUpdate(from, [participant.id], "remove");
                        removed++;
                    }
                }
                await sock.sendMessage(from, { text: `WRONG TURN 6: Removed ${removed} inactive members.` });
            }

            // DYNAMIC COMMANDS
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args);
        }
    });

    // CALL SECURITY
    sock.ev.on('call', async (call) => {
        if (call[0].status === 'offer') {
            await sock.rejectCall(call[0].id, call[0].from);
            await sock.sendMessage(call[0].from, { text: "📵 WRONG TURN 6 SECURITY: Incoming calls are blocked." });
        }
    });

    // ALWAYS ONLINE (15s Interval)
    setInterval(async () => {
        if (sock.user) {
            await sock.sendPresenceUpdate('available');
            await sock.updateProfileStatus(`WRONG TURN 6 | ONLINE | STANYTZ`).catch(() => {});
        }
    }, 15000);
}

/**
 * WEB SERVER FOR PAIRING
 */
app.get('/code', async (req, res) => {
    let s = sockCache.get("sock");
    if (!s || !req.query.number) return res.status(400).send({ error: "System initialization incomplete." });
    try {
        let code = await s.requestPairingCode(req.query.number.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) {
        res.status(500).send({ error: "Failed to request pairing code." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`WRONG TURN 6: Web Server Active on Port ${PORT}`);
    startBot();
});
