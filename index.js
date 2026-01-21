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
    getContentType,
    useMultiFileAuthState
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');

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
let sock = null;

const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
    }
};

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

async function useFirebaseAuthState(db, collectionName, sessionId) {
    const fixId = (id) => `${sessionId}_${id.replace(/\//g, '__').replace(/\@/g, 'at')}`;
    const writeData = async (data, id) => setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
        } catch (e) { return null; }
    };
    const removeData = async (id) => {
        try {
            await deleteDoc(doc(db, collectionName, fixId(id)));
        } catch (e) {}
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
                        if (type === 'app-state-sync-key' && value) {
                            value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            if (value) {
                                tasks.push(writeData(value, `${type}-${id}`));
                            }
                        }
                    }
                    await Promise.all(tasks);
                },
                del: async (type, ids) => {
                    await Promise.all(ids.map(id => removeData(`${type}-${id}`)));
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

async function startBot() {
    try {
        loadCmds();
        const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");
        
        if (!state.creds.registered) {
            console.log("📡 STANDBY: WAITING FOR PAIRING...");
            return;
        }

        sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu("Chrome"), 
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            printQRInTerminal: false,
            syncFullHistory: false,
            fireInitQueries: true,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log("QR Code received, ready for scanning");
            }
            
            if (connection === 'open') {
                console.log("✅ Connected successfully!");
                await sock.sendMessage(sock.user.id, { 
                    text: `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ ✔️`,
                    contextInfo: forwardedContext 
                });
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed due to ', lastDisconnect?.error?.message || 'unknown reason', ', reconnecting ', shouldReconnect);
                
                if (shouldReconnect) {
                    setTimeout(startBot, 5000);
                }
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0];
            if (!m.message) return;
            const from = m.key.remoteJid;
            const sender = m.key.participant || from;
            const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
            const type = getContentType(m.message);

            msgCache.set(m.key.id, m);

            // 1. AUTO AI CHAT (HUMAN PERSONA)
            if (!body.startsWith('.') && !m.key.fromMe && body.length > 2 && !from.endsWith('@g.us')) {
                try {
                    const aiPrompt = `Your name is WRONG TURN 6, a human-like assistant by STANYTZ. Respond naturally and briefly in the user's language to: ${body}`;
                    const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
                    await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
                } catch (e) {}
            }

            // 2. ANTI-DELETE & VIEWONCE
            if (m.message.protocolMessage?.type === 0 && !m.key.fromMe) {
                const cached = msgCache.get(m.message.protocolMessage.key.id);
                if (cached) await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
            }
            if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
                await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
            }

            // 3. FORCE JOIN
            if (body.startsWith('.') && !m.key.fromMe) {
                const groupMetadata = await sock.groupMetadata('120363406549688641@g.us').catch(() => null);
                if (groupMetadata && !groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
                }
            }

            // 4. COMMAND HANDLER
            if (body.startsWith('.')) {
                const args = body.slice(1).trim().split(/ +/);
                const cmdName = args.shift().toLowerCase();
                const cmd = commands.get(cmdName);
                if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error('Error in startBot:', error);
        setTimeout(startBot, 10000);
    }
}

/**
 * FIXED PAIRING ENDPOINT - More reliable
 */
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Missing Number" });
    
    num = num.replace(/\D/g, '');
    if (!num.startsWith('+')) {
        num = '+' + num;
    }
    
    try {
        // Clean previous session if exists
        const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");
        
        // Create a fresh socket for pairing
        const pairingSock = makeWASocket({
            auth: {
                creds: initAuthCreds(),
                keys: makeCacheableSignalKeyStore({}, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu("Chrome"),
            printQRInTerminal: false,
            connectTimeoutMs: 60000
        });

        // Handle pairing events
        pairingSock.ev.on('connection.update', (update) => {
            if (update.qr) {
                console.log("QR generated for pairing");
            }
            if (update.connection === 'open') {
                console.log("Pairing successful!");
            }
        });

        pairingSock.ev.on('creds.update', async (creds) => {
            try {
                // Save credentials to Firebase
                const { BufferJSON } = require('@whiskeysockets/baileys');
                await setDoc(doc(db, "WT6_SESSIONS", "MASTER_creds"), 
                    JSON.parse(JSON.stringify(creds, BufferJSON.replacer)));
                console.log("Credentials saved to Firebase");
                
                // Restart bot with new credentials
                setTimeout(startBot, 3000);
                
                // Close pairing socket
                setTimeout(() => {
                    pairingSock.ws.close();
                }, 5000);
            } catch (error) {
                console.error("Error saving credentials:", error);
            }
        });

        await delay(2000);
        
        // Request pairing code
        const code = await pairingSock.requestPairingCode(num);
        
        // Format code for display (like in your screenshot)
        const formattedCode = code.toUpperCase().split('').join(' ');
        
        res.send({ 
            success: true, 
            code: code,
            formattedCode: formattedCode,
            message: "Enter this code in WhatsApp: Link with phone number"
        });

    } catch (error) {
        console.error("Pairing error:", error);
        res.status(500).send({ 
            error: "Pairing failed",
            message: error.message || "Please try again"
        });
    }
});

// Add endpoint to check connection status
app.get('/status', (req, res) => {
    res.send({
        connected: sock ? true : false,
        user: sock?.user?.id || null,
        timestamp: new Date().toISOString()
    });
});

// Serve static files
app.use(express.static('public'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { 
    console.log(`🚀 Server running on port ${PORT}`);
    startBot(); 
});
