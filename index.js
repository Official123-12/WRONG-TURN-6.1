require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    BufferJSON,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    initAuthCreds
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc } = require('firebase/firestore');
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
let mainSock = null;

// 1. COMMAND LOADER (STRICT SUBFOLDERS)
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

// 2. FIREBASE AUTH MANAGER (FIXED ID SANITIZATION)
async function useFirebaseAuthState(db, collectionName, sessionId = "MASTER") {
    const fixId = (id) => `${sessionId}_${id.replace(/\//g, '__').replace(/\@/g, 'at')}`;
    const writeData = async (data, id) => setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
        } catch (e) { return null; }
    };
    
    let creds = await readData('creds') || initAuthCreds();

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
                            value ? await writeData(value, `${type}-${id}`) : null;
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

// 3. MAIN ENGINE START
async function startBot() {
    loadCmds();
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS");
    
    mainSock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    mainSock.ev.on('creds.update', saveCreds);

    mainSock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WT6 CONNECTED");
            await mainSock.sendMessage(mainSock.user.id, { text: "*W R O N G  T U R N  6* ✔️\n_System Operational._" });
        }
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        }
    });

    mainSock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();

        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, mainSock, Array.from(commands.values()), args);
        }
    });

    setInterval(() => { if (mainSock?.user) mainSock.sendPresenceUpdate('available'); }, 15000);
}

// 4. THE ULTIMATE PAIRING FIX (FORCE NEW IDENTITY)
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Missing Number" });

    try {
        // Hapa tunalazimisha 'creds' mpya kila wakati kodi inapoombwa
        // Hii inakata mzizi wa 'Precondition Required'
        const pairingSock = makeWASocket({
            auth: { creds: initAuthCreds(), keys: makeCacheableSignalKeyStore({}, pino({level:'silent'})) },
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Safari")
        });

        await delay(3000); // Subiri socket ijipe nguvu
        let code = await pairingSock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });

        // Ulinzi: Tukishapata kodi, tunazima hii instance ya muda
        setTimeout(() => { try { pairingSock.ws.close(); } catch(e){} }, 60000);

    } catch (e) {
        console.error(e);
        res.status(500).send({ error: "WhatsApp Busy. Try in 10s." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Armed: ${PORT}`); startBot(); });
