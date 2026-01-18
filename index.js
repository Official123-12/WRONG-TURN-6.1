require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion,
    BufferJSON,
    makeCacheableSignalKeyStore
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
let sock = null;
let isWelcomeSent = false;

// 1. COMMAND LOADER (FIXED)
const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    const folders = fs.readdirSync(cmdPath);
    folders.forEach(folder => {
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

// 2. FIREBASE AUTH
async function useFirebaseAuthState(db, collectionName) {
    const fixId = (id) => id.replace(/\//g, '__').replace(/\@/g, 'at');
    const writeData = async (data, id) => setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
        } catch (e) { return null; }
    };
    const creds = await readData('creds') || require('@whiskeysockets/baileys').initAuthCreds();
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
                        value ? await writeData(value, `${type}-${id}`) : null;
                    }
                }
            }
        }},
        saveCreds: () => writeData(creds, 'creds')
    };
}

// 3. START ENGINE
async function startBot() {
    loadCmds();
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS");
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        printQRInTerminal: false,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WT6 IS ONLINE");
            if (!isWelcomeSent) {
                await sock.sendMessage(sock.user.id, { text: "*W R O N G  T U R N  6*  ✔️\n_System Armed & Ready._" });
                isWelcomeSent = true;
            }
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) setTimeout(startBot, 5000);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();

        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args);
        }
    });

    setInterval(() => { if (sock?.user) sock.sendPresenceUpdate('available'); }, 15000);
}

// 4. THE NUCLEAR FIX FOR PAIRING (NO MORE 428 ERROR)
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Namba inahitajika" });

    try {
        // Tunatengeneza socket mpya ya muda kwa ajili ya pairing
        // Hii inahakikisha session ya zamani haivurugi ombi jipya
        const { state } = await useFirebaseAuthState(db, "WT6_PAIRING_TEMP"); 
        const pSock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Safari")
        });

        await delay(3000); // Subiri socket itulie
        let code = await pSock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });
        
        // Funga pSock baada ya sekunde 30 ili isilete uzito
        setTimeout(() => { try { pSock.ws.close(); } catch(e){} }, 30000);

    } catch (e) {
        console.error(e);
        res.status(500).send({ error: "WhatsApp Busy. Jaribu tena baada ya sekunde 10." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server: ${PORT}`); startBot(); });
