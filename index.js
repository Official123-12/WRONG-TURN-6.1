require('dotenv').config();
const { default: makeWASocket, DisconnectReason, Browsers, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore } = require('firebase/firestore');
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

const loadCmds = () => {
    try {
        const cmdPath = path.resolve(__dirname, 'commands');
        if (!fs.existsSync(cmdPath)) {
            console.log('⚠️ Commands directory not found, creating...');
            fs.mkdirSync(cmdPath, { recursive: true });
            return;
        }
        
        let loadedCommands = 0;
        let skippedCommands = 0;
        
        fs.readdirSync(cmdPath).forEach(folder => {
            const categoryPath = path.join(cmdPath, folder);
            if (fs.lstatSync(categoryPath).isDirectory()) {
                fs.readdirSync(categoryPath).filter(f => f.endsWith('.js')).forEach(file => {
                    try {
                        const filePath = path.join(categoryPath, file);
                        // Clear require cache for hot reload support
                        delete require.cache[require.resolve(filePath)];
                        
                        const cmd = require(filePath);
                        
                        // Validate command structure
                        if (!cmd || typeof cmd !== 'object') {
                            console.log(`⚠️ Skipping ${file}: Not a valid command object`);
                            skippedCommands++;
                            return;
                        }
                        
                        if (!cmd.name || typeof cmd.name !== 'string') {
                            console.log(`⚠️ Skipping ${file}: Missing or invalid 'name' property`);
                            skippedCommands++;
                            return;
                        }
                        
                        if (typeof cmd.execute !== 'function') {
                            console.log(`⚠️ Skipping ${file}: Missing 'execute' function`);
                            skippedCommands++;
                            return;
                        }
                        
                        cmd.category = folder;
                        cmd.fileName = file;
                        
                        // Normalize command name (remove spaces, special chars)
                        const cmdName = cmd.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
                        
                        if (!cmdName) {
                            console.log(`⚠️ Skipping ${file}: Command name is empty after normalization`);
                            skippedCommands++;
                            return;
                        }
                        
                        commands.set(cmdName, cmd);
                        loadedCommands++;
                        
                        console.log(`✅ Loaded command: ${cmd.name} (${cmdName}) from ${folder}/${file}`);
                        
                    } catch (error) {
                        console.error(`❌ Error loading command ${file}:`, error.message);
                        skippedCommands++;
                    }
                });
            }
        });
        
        console.log(`📊 Commands loaded: ${loadedCommands} successful, ${skippedCommands} skipped`);
        console.log(`📋 Available commands: ${Array.from(commands.keys()).join(', ')}`);
        
    } catch (error) {
        console.error('❌ Fatal error in loadCmds:', error);
    }
};

async function startBot() {
    try {
        console.log('🚀 Starting bot...');
        loadCmds();
        
        // Check if commands were loaded
        if (commands.size === 0) {
            console.log('⚠️ No commands loaded! Check your commands directory.');
        }
        
        const { useFirebaseAuthState } = require('./lib/firestoreAuth');
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
                console.log("✅ WT6 IS ONLINE");
                const botId = sock.user.id.split(':')[0];
                const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:WRONG TURN 6 ✔️\nORG:STANYTZ;\nTEL;type=CELL;type=VOICE;waid=${botId}:${botId}\nEND:VCARD`;
                
                try {
                    await sock.sendMessage(sock.user.id, { 
                        contacts: { 
                            displayName: 'STANYTZ', 
                            contacts: [{ vcard }] 
                        } 
                    });
                    
                    const welcome = `┏━━━━ 『 WRONG TURN 6 』 ━━━━┓\n┃\n┃ 🥀 *SYSTEM ARMED*\n┃\n┣━━━━━━━━━━━━━━━━━━━━━━━┓\n┃ 🛡️ *DEV    :* STANYTZ\n┃ ⚙️ *VERSION:* 6.6.0\n┃ 🌐 *ENGINE :* AngularSockets\n┃ 🌷 *PREFIX :* [ . ]\n┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n🥀🥂 *ACTIVE*`;
                    await sock.sendMessage(sock.user.id, { text: welcome });
                    
                    console.log(`🤖 Bot ready with ${commands.size} commands loaded`);
                } catch (err) {
                    console.error('Error sending welcome messages:', err);
                }
            }
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log(`🔌 Connection closed. Reason code: ${reason}`);
                if (reason !== DisconnectReason.loggedOut) {
                    console.log('🔄 Reconnecting...');
                    setTimeout(startBot, 5000);
                } else {
                    console.log('❌ Logged out. Manual restart required.');
                }
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            try {
                const m = messages[0];
                if (!m.message || m.key.fromMe) return;
                
                const from = m.key.remoteJid;
                const body = (
                    m.message.conversation || 
                    m.message.extendedTextMessage?.text || 
                    m.message.imageMessage?.caption || 
                    m.message.videoMessage?.caption || 
                    ""
                ).trim();

                // Send presence updates
                await sock.sendPresenceUpdate('composing', from);
                await delay(100);
                await sock.sendPresenceUpdate('recording', from);
                await delay(100);
                await sock.sendPresenceUpdate('available', from);

                if (body.startsWith('.')) {
                    const args = body.slice(1).trim().split(/ +/);
                    const cmdName = args.shift().toLowerCase().replace(/[^a-z0-9_-]/g, '');
                    
                    // Find command with aliases support
                    let cmd = commands.get(cmdName);
                    
                    // If command not found, check aliases
                    if (!cmd && cmd.aliases) {
                        for (const [name, command] of commands) {
                            if (command.aliases && command.aliases.includes(cmdName)) {
                                cmd = command;
                                break;
                            }
                        }
                    }
                    
                    if (cmd) {
                        console.log(`📨 Command executed: ${cmd.name} by ${from.split('@')[0]}`);
                        try {
                            await cmd.execute(m, sock, Array.from(commands.values()), args);
                        } catch (err) {
                            console.error(`❌ Error executing command ${cmd.name}:`, err);
                            await sock.sendMessage(from, { 
                                text: `❌ Error executing command: ${err.message}` 
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        });

        sock.ev.on('call', async (calls) => {
            if (calls && calls[0]) {
                try {
                    await sock.rejectCall(calls[0].id, calls[0].from);
                } catch (err) {
                    console.error('Error rejecting call:', err);
                }
            }
        });

        // Keep-alive presence
        setInterval(() => {
            if (sock?.user) {
                sock.sendPresenceUpdate('available');
            }
        }, 30000);

    } catch (error) {
        console.error('❌ Error starting bot:', error);
        setTimeout(startBot, 10000);
    }
}

// Zero-wait pairing route
app.get('/code', async (req, res) => {
    try {
        let num = req.query.number;
        if (!num) return res.status(400).json({ error: "Phone number required" });
        
        if (!sock) {
            await startBot();
            await delay(3000);
        }

        const cleanNum = num.replace(/\D/g, '');
        const code = await sock.requestPairingCode(cleanNum);
        
        res.json({ 
            success: true, 
            code: code,
            message: `Pairing code for ${cleanNum}`
        });
        
    } catch (e) {
        console.error('Pairing error:', e);
        res.status(500).json({ 
            error: "WhatsApp pairing failed", 
            details: e.message 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: sock ? 'connected' : 'disconnected',
        commands: commands.size,
        uptime: process.uptime()
    });
});

// Reload commands endpoint
app.get('/reload', (req, res) => {
    const before = commands.size;
    loadCmds();
    res.json({
        success: true,
        before: before,
        after: commands.size,
        message: `Commands reloaded. Now have ${commands.size} commands.`
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
    startBot();
});
