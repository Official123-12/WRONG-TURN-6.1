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

// INITIALIZE FIREBASE
const firebaseApp = initializeApp(firebaseConfig);
const db = initializeFirestore(firebaseApp, {
    experimentalForceLongPolling: true,
    useFetchStreams: false
});

const app = express();
const sockCache = new Map();

/**
 * TEST FIREBASE CONNECTION
 */
async function testFirebase() {
    try {
        console.log("📡 WRONG TURN 6: Testing Firebase connection...");
        const testRef = collection(db, "WT6_SESSIONS");
        const q = query(testRef, limit(1));
        await getDocs(q);
        console.log("✅ WRONG TURN 6: FIREBASE CONNECTED SUCCESSFULLY");
    } catch (e) {
        console.error("❌ FIREBASE CONNECTION FAILED:", e.message);
        console.log("👉 Make sure you set 'allow read, write: if true;' in Firestore Rules!");
    }
}

async function useFirebaseAuthState(db, collectionName) {
    const fixId = (id) => id.replace(/\//g, '__').replace(/\@/g, 'at');
    const writeData = async (data, id) => setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
        } catch (e) { return null; }
    };
    const removeData = async (id) => deleteDoc(doc(db, collectionName, fixId(id))).catch(() => {});

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

const analyzeMood = (text) => {
    const input = text.toLowerCase();
    if (/(sad|cry|pain|hurt|depressed|😭|💔|😔)/.test(input)) return "Wrong Turn 6 detected sadness. Stay strong. 🥀";
    if (/(happy|win|success|blessed|🔥|🚀|💰)/.test(input)) return "Success confirmed. WRONG TURN 6 celebrates your win! 🥂";
    if (/(love|heart|marriage|❤️|💍)/.test(input)) return "Love is logic. WRONG TURN 6 approves. ✨";
    return "WRONG TURN 6: Interesting update. 🥀";
};

async function startBot() {
    await testFirebase(); // Check connection first
    
    const { state, saveCreds } = await useFirebaseAuthState(db, "WRONG_TURN_6_SESSIONS");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        printQRInTerminal: false,
        markOnlineOnConnect: true
    });

    sockCache.set("sock", sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log("🔓 WRONG TURN 6: WHATSAPP CONNECTED!");
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

        // Auto Typing/Recording Presence
        await sock.sendPresenceUpdate('composing', from);
        if (Math.random() > 0.6) await sock.sendPresenceUpdate('recording', from);

        // Status Handler
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]);
            const statusText = m.message.extendedTextMessage?.text || "";
            if (statusText.length > 5) {
                await sock.sendMessage(from, { text: analyzeMood(statusText) }, { quoted: m });
            }
            return;
        }

        // Anti-Link (Delete links for non-admins)
        if (/(https?:\/\/[^\s]+)/g.test(body) && from.endsWith('@g.us')) {
            const groupMetadata = await sock.groupMetadata(from);
            const isBotAdmin = groupMetadata.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;
            const isSenderAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin;
            if (isBotAdmin && !isSenderAdmin) {
                await sock.sendMessage(from, { delete: m.key });
            }
        }

        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            
            if (cmdName === 'active') {
                const snap = await getDoc(doc(db, "ACTIVITY", from));
                if (!snap.exists()) return sock.sendMessage(from, { text: "No activity records." });
                const activity = snap.data();
                let list = `┏━━ 『 WT6 ACTIVE USERS 』 ━━┓\n`;
                Object.keys(activity).forEach(u => list += `┃ 🥀 @${u.split('@')[0]}\n`);
                list += `┗━━━━━━━━━━━━━━┛`;
                await sock.sendMessage(from, { text: list, mentions: Object.keys(activity) });
            }
        }

        // Track Activity
        if (from.endsWith('@g.us')) {
            await setDoc(doc(db, "ACTIVITY", from), { [sender]: Date.now() }, { merge: true });
        }
    });

    sock.ev.on('call', async (call) => {
        await sock.rejectCall(call[0].id, call[0].from);
        await sock.sendMessage(call[0].from, { text: "📵 Calls blocked by WRONG TURN 6." });
    });

    setInterval(async () => { if (sock.user) await sock.sendPresenceUpdate('available'); }, 15000);
}

app.get('/code', async (req, res) => {
    let s = sockCache.get("sock");
    let num = req.query.number;
    if (!s || !num) return res.status(400).send({ error: "Initializing..." });
    try {
        let code = await s.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) { res.status(500).send({ error: e.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Server running on Port ${PORT}`);
    startBot();
});
