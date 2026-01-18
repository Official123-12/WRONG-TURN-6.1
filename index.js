require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion,
    BufferJSON,
    initAuthCreds
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, deleteDoc } = require('firebase/firestore');
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

// Initialize Firebase
let firebaseApp, db;
try {
    firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    console.log('✅ Firebase initialized');
} catch (error) {
    console.error('❌ Firebase error:', error.message);
    process.exit(1);
}

const app = express();
const commands = new Map();
let sock = null;
let isConnected = false;
let connectionPromise = null;
let welcomeTracker = new Set();

// COMMAND LOADER
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

// FIREBASE AUTH STATE
async function useFirebaseAuthState(db, collectionName) {
    const fixId = (id) => id.replace(/\//g, '__').replace(/@/g, 'at_').replace(/\./g, '_');
    
    const writeData = async (data, id) => {
        try {
            await setDoc(doc(db, collectionName, fixId(id)), { 
                data: JSON.stringify(data, BufferJSON.replacer),
                timestamp: Date.now()
            });
            return true;
        } catch (error) {
            console.error('Write error:', error.code);
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
            console.error('Read error:', error.code);
            return null;
        }
    };
    
    const removeData = async (id) => {
        try {
            await deleteDoc(doc(db, collectionName, fixId(id)));
            return true;
        } catch (error) {
            console.error('Remove error:', error.code);
            return false;
        }
    };
    
    // Get or create credentials
    let creds = await readData('creds');
    if (!creds) {
        console.log('🆕 Creating new credentials');
        creds = initAuthCreds();
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
                    const tasks = [];
                    for (const type in data) {
                        for (const id in data[type]) {
                            const key = `${type}-${id}`;
                            const value = data[type][id];
                            if (value) {
                                tasks.push(writeData(value, key));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => {
            console.log('💾 Saving credentials...');
            return writeData(creds, 'creds');
        }
    };
}

// START BOT FUNCTION
async function startBot() {
    try {
        console.log('🚀 Starting WRONG TURN 6...');
        loadCmds();
        
        const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS");
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            auth: state,
            version,
            logger: pino({ level: 'error' }),
            browser: Browsers.macOS("Safari"),
            printQRInTerminal: false,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log('✅ Connected to WhatsApp!');
                isConnected = true;
                
                const botId = sock.user.id.split(':')[0];
                if (!welcomeTracker.has(botId)) {
                    try {
                        // VCard
                        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:WRONG TURN 6 ✔️\nORG:STANYTZ;\nTEL;type=CELL;type=VOICE;waid=${botId}:${botId}\nEND:VCARD`;
                        await sock.sendMessage(sock.user.id, { 
                            contacts: { 
                                displayName: 'STANYTZ', 
                                contacts: [{ vcard }] 
                            } 
                        });

                        // Welcome message
                        const welcome = `┏━━━━ 『 WRONG TURN 6 』 ━━━━┓\n┃\n┃ 🥀 *SYSTEM ARMED & ACTIVE*\n┃\n┣━━━━━━━━━━━━━━━━━━━━━━━┓\n┃ 🛡️ *DEV    :* STANYTZ\n┃ ⚙️ *VERSION:* 6.6.0\n┃ 🌐 *ENGINE :* AngularSockets\n┃ 🌷 *PREFIX :* [ . ]\n┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n🥀🥂 *STANYTZ INDUSTRIES*`;
                        await sock.sendMessage(sock.user.id, { text: welcome });
                        welcomeTracker.add(botId);
                        
                        console.log("✅ WRONG TURN 6 ONLINE - Ready for pairing!");
                    } catch (welcomeError) {
                        console.error('Welcome error:', welcomeError.message);
                    }
                }
            }
            
            if (connection === 'close') {
                isConnected = false;
                console.log('❌ Connection closed:', lastDisconnect?.error?.message);
                
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    console.log('🔄 Reconnecting in 5 seconds...');
                    setTimeout(() => {
                        console.log('🔄 Attempting reconnect...');
                        startBot();
                    }, 5000);
                } else {
                    console.log('❌ Logged out. Manual restart required.');
                }
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
            
            // Auto presence
            await sock.sendPresenceUpdate('composing', from);
            
            // Anti-link
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

            // Status handler
            if (from === 'status@broadcast') {
                await sock.readMessages([m.key]);
                const txt = m.message.extendedTextMessage?.text || "";
                if (txt.length > 5) {
                    const mood = /(sad|😭|💔)/.test(txt.toLowerCase()) ? 
                        "Wrong Turn 6 detected sadness. Stay strong. 🥀" : 
                        "Observed by WRONG TURN 6. 🥀";
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
                        console.error(`Command ${cmdName} error:`, error.message);
                    }
                }
            }
        });

        sock.ev.on('call', async (calls) => {
            if (calls && calls[0]) {
                await sock.rejectCall(calls[0].id, calls[0].from);
            }
        });
        
        // Keep alive
        setInterval(() => {
            if (sock?.user && isConnected) {
                sock.sendPresenceUpdate('available');
            }
        }, 20000);

    } catch (error) {
        console.error('❌ Bot startup error:', error.message);
        console.log('🔄 Restarting in 10 seconds...');
        setTimeout(startBot, 10000);
    }
}

// WAIT FOR CONNECTION FUNCTION
async function waitForConnection() {
    if (isConnected && sock?.user) {
        return true;
    }
    
    console.log('⏳ Waiting for connection...');
    let attempts = 0;
    while (attempts < 30) { // Wait max 30 seconds
        if (isConnected && sock?.user) {
            console.log('✅ Connection established!');
            return true;
        }
        await delay(1000);
        attempts++;
    }
    
    throw new Error('Connection timeout. Bot not ready.');
}

// PAIRING CODE ENDPOINT - FIXED
app.get('/code', async (req, res) => {
    const num = req.query.number;
    
    if (!num) {
        return res.status(400).json({ error: "Number required" });
    }
    
    console.log(`🔐 Pairing request for: ${num}`);
    
    try {
        // Clean the number
        const cleanNum = num.replace(/\D/g, '');
        
        // Validate number
        if (cleanNum.length < 10) {
            return res.status(400).json({ error: "Invalid number. Use format: 255XXXXXXXXX" });
        }
        
        // Ensure we're connected
        if (!sock) {
            return res.status(503).json({ error: "Bot is starting. Please wait 20 seconds." });
        }
        
        // Wait for connection if not ready
        if (!isConnected) {
            try {
                await waitForConnection();
            } catch (timeoutError) {
                return res.status(503).json({ error: "Bot not connected. Try again in 30 seconds." });
            }
        }
        
        // Request pairing code
        console.log(`📞 Requesting pairing code for: ${cleanNum}`);
        
        let code;
        try {
            code = await sock.requestPairingCode(cleanNum);
        } catch (pairError) {
            console.error('Pairing error details:', pairError);
            
            // Specific error handling
            if (pairError.message.includes('not connected')) {
                return res.status(503).json({ error: "Bot disconnected. Restarting..." });
            } else if (pairError.message.includes('timeout')) {
                return res.status(504).json({ error: "WhatsApp server timeout. Try again." });
            } else {
                return res.status(500).json({ error: "WhatsApp error: " + pairError.message });
            }
        }
        
        if (!code || code.length !== 8) {
            return res.status(500).json({ error: "Invalid code received from WhatsApp" });
        }
        
        console.log(`✅ Code generated for ${cleanNum}: ${code}`);
        res.json({ 
            success: true, 
            code: code,
            number: cleanNum
        });
        
    } catch (error) {
        console.error('❌ Pairing endpoint error:', error.message);
        res.status(500).json({ 
            error: "Failed to get pairing code: " + error.message 
        });
    }
});

// HOME PAGE
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>WRONG TURN 6 - Pairing Code</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
                color: #fff; 
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .container { 
                background: rgba(30, 30, 46, 0.9);
                padding: 30px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                width: 90%;
                max-width: 500px;
                border: 1px solid #4a4a6d;
            }
            h2 { 
                color: #ff4757; 
                margin-bottom: 20px;
                text-align: center;
                font-size: 28px;
            }
            .status {
                background: #1e2a3a;
                padding: 10px;
                border-radius: 8px;
                margin: 15px 0;
                text-align: center;
                font-weight: bold;
                border-left: 4px solid ${isConnected ? '#2ed573' : '#ff4757'};
            }
            input { 
                width: 100%; 
                padding: 15px;
                margin: 10px 0; 
                border: 2px solid #4a4a6d;
                border-radius: 8px;
                background: #1a1a2e;
                color: white;
                font-size: 16px;
                transition: border 0.3s;
            }
            input:focus {
                outline: none;
                border-color: #ff4757;
            }
            button { 
                width: 100%; 
                padding: 15px;
                margin: 10px 0; 
                background: linear-gradient(90deg, #ff4757, #ff6b81);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 18px;
                font-weight: bold;
                cursor: pointer;
                transition: transform 0.2s, opacity 0.2s;
            }
            button:hover {
                opacity: 0.9;
                transform: translateY(-2px);
            }
            button:active {
                transform: translateY(0);
            }
            button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .code-display {
                background: #1a1a2e;
                padding: 20px;
                border-radius: 8px;
                margin-top: 20px;
                text-align: center;
                border: 2px dashed #4a4a6d;
                font-size: 24px;
                letter-spacing: 3px;
                display: none;
            }
            .error {
                color: #ff4757;
                background: rgba(255, 71, 87, 0.1);
                padding: 10px;
                border-radius: 8px;
                margin: 10px 0;
                display: none;
            }
            .loader {
                display: none;
                text-align: center;
                margin: 10px 0;
            }
            .loader:after {
                content: ' .';
                animation: dots 1.5s steps(5, end) infinite;
            }
            @keyframes dots {
                0%, 20% { color: rgba(255,255,255,0); text-shadow: .25em 0 0 rgba(255,255,255,0), .5em 0 0 rgba(255,255,255,0); }
                40% { color: white; text-shadow: .25em 0 0 rgba(255,255,255,0), .5em 0 0 rgba(255,255,255,0); }
                60% { text-shadow: .25em 0 0 white, .5em 0 0 rgba(255,255,255,0); }
                80%, 100% { text-shadow: .25em 0 0 white, .5em 0 0 white; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>WRONG TURN 6 🔥</h2>
            <div class="status" id="status">
                Status: ${isConnected ? '🟢 ONLINE' : '🔴 OFFLINE'}
            </div>
            
            <input type="text" id="number" placeholder="255XXXXXXXXX" value="255">
            
            <button onclick="getCode()" id="btn">
                GET 8-DIGIT PAIRING CODE
            </button>
            
            <div class="loader" id="loader">Requesting code</div>
            
            <div class="error" id="error"></div>
            
            <div class="code-display" id="result">
                <div style="font-size: 14px; color: #aaa; margin-bottom: 10px;">PAIRING CODE</div>
                <div id="codeValue"></div>
                <div style="font-size: 12px; color: #888; margin-top: 10px;">
                    Enter this code in WhatsApp > Linked Devices > Link a Device
                </div>
            </div>
        </div>
        
        <script>
            function updateStatus() {
                fetch('/status').then(r => r.json()).then(data => {
                    document.getElementById('status').innerHTML = 
                        'Status: ' + (data.connected ? '🟢 ONLINE' : '🔴 OFFLINE');
                    document.getElementById('status').style.borderLeftColor = 
                        data.connected ? '#2ed573' : '#ff4757';
                });
            }
            
            async function getCode() {
                const num = document.getElementById('number').value.trim();
                const btn = document.getElementById('btn');
                const loader = document.getElementById('loader');
                const error = document.getElementById('error');
                const result = document.getElementById('result');
                const codeValue = document.getElementById('codeValue');
                
                // Reset
                error.style.display = 'none';
                result.style.display = 'none';
                btn.disabled = true;
                loader.style.display = 'block';
                
                try {
                    const response = await fetch('/code?number=' + encodeURIComponent(num));
                    const data = await response.json();
                    
                    if (response.ok) {
                        codeValue.textContent = data.code;
                        result.style.display = 'block';
                        error.style.display = 'none';
                        
                        // Copy to clipboard
                        navigator.clipboard.writeText(data.code).then(() => {
                            alert('Code copied to clipboard!');
                        });
                    } else {
                        error.textContent = '❌ ' + (data.error || 'Unknown error');
                        error.style.display = 'block';
                        result.style.display = 'none';
                    }
                } catch (e) {
                    error.textContent = '❌ Network error. Check connection.';
                    error.style.display = 'block';
                    result.style.display = 'none';
                } finally {
                    btn.disabled = false;
                    loader.style.display = 'none';
                }
            }
            
            // Update status every 10 seconds
            setInterval(updateStatus, 10000);
            updateStatus();
        </script>
    </body>
    </html>
    `);
});

// STATUS ENDPOINT
app.get('/status', (req, res) => {
    res.json({
        connected: isConnected && sock?.user !== undefined,
        botReady: !!sock,
        timestamp: Date.now()
    });
});

// HEALTH CHECK
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        bot: isConnected ? 'connected' : 'disconnected',
        uptime: process.uptime()
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 WRONG TURN 6 Server: http://localhost:${PORT}`);
    console.log('🔥 Starting bot...');
    startBot();
});
