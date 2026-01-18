require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion,
    BufferJSON 
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, deleteDoc } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');

// FIREBASE CONFIG - Compatible version
const firebaseConfig = {
    apiKey: "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
    authDomain: "stanybots.firebaseapp.com",
    projectId: "stanybots",
    storageBucket: "stanybots.appspot.com",
    messagingSenderId: "381983533939",
    appId: "1:381983533939:web:e6cc9445137c74b99df306"
};

// Initialize Firebase CORRECTLY
let firebaseApp, db;
try {
    firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    process.exit(1);
}

const app = express();
const commands = new Map();
let sock = null;
let welcomeTracker = new Set();

// 1. COMMAND LOADER
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
                } catch (e) { console.error(`Error loading ${file}:`, e.message); }
            }
        }
    }
    console.log(`📡 WRONG TURN 6: ${commands.size} COMMANDS ARMED`);
};

// 2. FIREBASE AUTH STATE - FIXED VERSION
async function useFirebaseAuthState(db, collectionName) {
    const fixId = (id) => id.replace(/\//g, '__').replace(/@/g, 'at_').replace(/\./g, '_');
    
    const writeData = async (data, id) => {
        try {
            await setDoc(doc(db, collectionName, fixId(id)), { data: JSON.stringify(data, BufferJSON.replacer) });
            return true;
        } catch (error) {
            console.error('Write error for', id, ':', error.code);
            return false;
        }
    };
    
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.data) {
                    return JSON.parse(data.data, BufferJSON.reviver);
                }
            }
            return null;
        } catch (error) {
            console.error('Read error for', id, ':', error.code);
            return null;
        }
    };
    
    const removeData = async (id) => {
        try {
            await deleteDoc(doc(db, collectionName, fixId(id)));
            return true;
        } catch (error) {
            console.error('Remove error for', id, ':', error.code);
            return false;
        }
    };
    
    // Initialize credentials
    let creds = await readData('creds');
    if (!creds) {
        creds = require('@whiskeysockets/baileys').initAuthCreds();
        await writeData(creds, 'creds');
    }
    
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
                set: async (data) => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            const key = `${type}-${id}`;
                            const value = data[type][id];
                            if (value) {
                                await writeData(value, key);
                            } else {
                                await removeData(key);
                            }
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

// 3. START ENGINE - MAIN FUNCTION
async function startBot() {
    loadCmds();
    
    try {
        console.log('🚀 Initializing WRONG TURN 6...');
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

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                const botId = sock.user.id.split(':')[0];
                if (!welcomeTracker.has(botId)) {
                    // Verified VCard
                    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:WRONG TURN 6 ✔️\nORG:STANYTZ;\nTEL;type=CELL;type=VOICE;waid=${botId}:${botId}\nEND:VCARD`;
                    await sock.sendMessage(sock.user.id, { contacts: { displayName: 'STANYTZ', contacts: [{ vcard }] } });

                    // Premium Vertical Welcome
                    const welcome = `┏━━━━ 『 WRONG TURN 6 』 ━━━━┓\n┃\n┃ 🥀 *SYSTEM ARMED & ACTIVE*\n┃\n┣━━━━━━━━━━━━━━━━━━━━━━━┓\n┃ 🛡️ *DEV    :* STANYTZ\n┃ ⚙️ *VERSION:* 6.6.0\n┃ 🌐 *ENGINE :* AngularSockets\n┃ 🌷 *PREFIX :* [ . ]\n┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n🥀🥂 *STANYTZ INDUSTRIES*`;
                    await sock.sendMessage(sock.user.id, { text: welcome });
                    welcomeTracker.add(botId);
                }
                console.log("✅ WRONG TURN 6 ONLINE - Ready for pairing codes!");
            }
            
            if (connection === 'close') {
                console.log('⚠️ Connection closed');
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    console.log('🔄 Reconnecting in 5 seconds...');
                    setTimeout(startBot, 5000);
                }
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
            
            // Auto Presence
            await sock.sendPresenceUpdate('composing', from);
            await sock.sendPresenceUpdate('recording', from);

            // Anti-Link
            if (/(https?:\/\/[^\s]+)/g.test(body) && from.endsWith('@g.us')) {
                try {
                    const metadata = await sock.groupMetadata(from);
                    const isBotAdmin = metadata.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;
                    if (isBotAdmin) {
                        await sock.sendMessage(from, { delete: m.key });
                    }
                } catch (error) {
                    // Silent
                }
            }

            // Status Handler
            if (from === 'status@broadcast') {
                await sock.readMessages([m.key]);
                const txt = m.message.extendedTextMessage?.text || "";
                if (txt.length > 5) {
                    const mood = /(sad|😭|💔)/.test(txt.toLowerCase()) ? "Wrong Turn 6 detected sadness. Stay strong. 🥀" : "Observed by WRONG TURN 6. 🥀";
                    await sock.sendMessage(from, { text: mood }, { quoted: m });
                }
                return;
            }

            // Commands handler
            if (body.startsWith('.')) {
                const args = body.slice(1).trim().split(/ +/);
                const cmdName = args.shift().toLowerCase();
                const cmd = commands.get(cmdName);
                if (cmd) {
                    try {
                        await cmd.execute(m, sock, Array.from(commands.values()), args);
                    } catch (error) {
                        console.error('Command error:', error.message);
                    }
                }
            }
        });

        sock.ev.on('call', async (c) => {
            if (c && c[0]) {
                await sock.rejectCall(c[0].id, c[0].from);
            }
        });
        
        // Keep alive
        setInterval(() => {
            if (sock?.user) {
                sock.sendPresenceUpdate('available');
            }
        }, 15000);

    } catch (error) {
        console.error('❌ Start bot error:', error.message);
        setTimeout(startBot, 10000);
    }
}

// PAIRING CODE ENDPOINT
app.get('/code', async (req, res) => {
    const num = req.query.number;
    if (!num) return res.status(400).json({ error: "Number required" });
    
    if (!sock || !sock.user) {
        return res.status(503).json({ error: "Bot initializing. Wait 10s." });
    }

    try {
        await delay(2000);
        const cleanNum = num.replace(/\D/g, '');
        if (cleanNum.length < 10) {
            return res.status(400).json({ error: "Invalid number format" });
        }
        
        const code = await sock.requestPairingCode(cleanNum);
        console.log(`🔐 Pairing code for ${cleanNum}: ${code}`);
        res.json({ code });
    } catch (error) {
        console.error('Pairing error:', error.message);
        res.status(500).json({ error: error.message || "Failed to get code" });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 WRONG TURN 6 running on port: ${PORT}`);
    startBot();
});
