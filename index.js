require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
    authDomain: "stanybots.firebaseapp.com",
    projectId: "stanybots",
    storageBucket: "stanybots.firebasestorage.app",
    messagingSenderId: "381983533939",
    appId: "1:381983533939:web:e6cc9445137c74b99df306"
};

// Initialize Firebase and Express
const firebaseApp = initializeApp(firebaseConfig);
const db = initializeFirestore(firebaseApp, { 
    experimentalForceLongPolling: true, 
    useFetchStreams: false 
});

const app = express();
const commands = new Map();
let sock = null;

// Improved command loader with error handling
const loadCmds = () => {
    commands.clear(); // Clear existing commands
    
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) {
        console.log('📁 Creating commands directory...');
        fs.mkdirSync(cmdPath, { recursive: true });
        return;
    }
    
    let loadedCount = 0;
    let errorCount = 0;
    
    // Read each category folder
    const categories = fs.readdirSync(cmdPath);
    
    if (categories.length === 0) {
        console.log('⚠️  No command categories found in commands/ directory');
        return;
    }
    
    categories.forEach(folder => {
        const categoryPath = path.join(cmdPath, folder);
        
        if (fs.lstatSync(categoryPath).isDirectory()) {
            const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
            
            if (files.length === 0) {
                console.log(`⚠️  No .js files in category: ${folder}`);
                return;
            }
            
            files.forEach(file => {
                try {
                    const filePath = path.join(categoryPath, file);
                    delete require.cache[require.resolve(filePath)]; // Clear cache for hot reload
                    const cmd = require(filePath);
                    
                    // Validate command structure
                    if (!cmd || typeof cmd !== 'object') {
                        console.error(`❌ ${file}: Invalid export (not an object)`);
                        errorCount++;
                        return;
                    }
                    
                    if (!cmd.name) {
                        console.error(`❌ ${file}: Missing 'name' property`);
                        errorCount++;
                        return;
                    }
                    
                    if (typeof cmd.name !== 'string') {
                        console.error(`❌ ${file}: 'name' must be a string`);
                        errorCount++;
                        return;
                    }
                    
                    if (typeof cmd.execute !== 'function') {
                        console.error(`❌ ${file}: Missing 'execute' function`);
                        errorCount++;
                        return;
                    }
                    
                    // Set command properties
                    cmd.category = folder;
                    cmd.file = file;
                    
                    const cmdName = cmd.name.toLowerCase().trim();
                    commands.set(cmdName, cmd);
                    
                    // Handle aliases if present
                    if (Array.isArray(cmd.aliases)) {
                        cmd.aliases.forEach(alias => {
                            if (typeof alias === 'string') {
                                commands.set(alias.toLowerCase().trim(), cmd);
                            }
                        });
                    }
                    
                    console.log(`✅ Loaded: ${cmdName} (${folder}/${file})`);
                    loadedCount++;
                    
                } catch (error) {
                    console.error(`❌ Failed to load ${folder}/${file}:`, error.message);
                    errorCount++;
                }
            });
        }
    });
    
    console.log(`\n📊 Commands Summary:`);
    console.log(`   ✅ Loaded: ${loadedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📁 Total commands in memory: ${commands.size}\n`);
};

// Bot initialization function
async function startBot() {
    console.log('🤖 Starting WRONG TURN 6 bot...\n');
    
    // Load commands first
    loadCmds();
    
    // Display loaded commands
    if (commands.size > 0) {
        console.log('📋 Available Commands:');
        const categories = {};
        commands.forEach(cmd => {
            if (!categories[cmd.category]) categories[cmd.category] = [];
            categories[cmd.category].push(cmd.name);
        });
        
        Object.keys(categories).forEach(cat => {
            console.log(`   📁 ${cat.toUpperCase()}: ${categories[cat].join(', ')}`);
        });
        console.log('');
    } else {
        console.log('⚠️  No commands loaded. Bot will start but won\'t respond to commands.\n');
    }
    
    try {
        // Load Firebase auth state
        const { useFirebaseAuthState } = require('./lib/firestoreAuth');
        const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS");
        
        // Get latest Baileys version
        const { version } = await fetchLatestBaileysVersion();
        
        // Create WhatsApp socket
        sock = makeWASocket({
            auth: state,
            version,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Safari"),
            printQRInTerminal: false,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000
        });
        
        // Save credentials when updated
        sock.ev.on('creds.update', saveCreds);
        
        // Handle connection events
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log('✅ WRONG TURN 6 IS ONLINE AND READY\n');
                
                // Send bot contact card
                try {
                    const botId = sock.user.id.split(':')[0];
                    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:WRONG TURN 6 ✔️\nORG:STANYTZ;\nTEL;type=CELL;type=VOICE;waid=${botId}:${botId}\nEND:VCARD`;
                    await sock.sendMessage(sock.user.id, { 
                        contacts: { 
                            displayName: 'STANYTZ', 
                            contacts: [{ vcard }] 
                        } 
                    });
                    
                    // Send welcome message
                    const welcome = `┏━━━━ 『 WRONG TURN 6 』 ━━━━┓\n┃\n┃ 🥀 *SYSTEM ARMED*\n┃\n┣━━━━━━━━━━━━━━━━━━━━━━━┓\n┃ 🛡️ *DEV    :* STANYTZ\n┃ ⚙️ *VERSION:* 6.6.0\n┃ 🌐 *ENGINE :* AngularSockets\n┃ 🌷 *PREFIX :* [ . ]\n┃ 📦 *COMMANDS :* ${commands.size}\n┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n🥀🥂 *BOT ACTIVE AND READY*`;
                    await sock.sendMessage(sock.user.id, { text: welcome });
                    
                } catch (error) {
                    console.error('Error sending welcome messages:', error.message);
                }
            }
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log(`🔌 Connection closed. Reason code: ${reason || 'Unknown'}`);
                
                if (reason !== DisconnectReason.loggedOut) {
                    console.log('🔄 Attempting to reconnect...');
                    setTimeout(startBot, 5000);
                } else {
                    console.log('❌ Logged out. Please scan QR code again.');
                }
            }
            
            if (update.qr) {
                console.log('📱 QR Code received. Scan with WhatsApp.');
            }
        });
        
        // Handle incoming messages
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0];
            
            // Ignore if no message or from self
            if (!m.message || m.key.fromMe) return;
            
            const from = m.key.remoteJid;
            const body = (m.message.conversation || 
                         m.message.extendedTextMessage?.text || 
                         m.message.imageMessage?.caption || 
                         "").trim();
            
            // Only process commands starting with .
            if (body.startsWith('.')) {
                try {
                    // Parse command
                    const args = body.slice(1).trim().split(/ +/);
                    const cmdName = args.shift()?.toLowerCase().trim();
                    
                    if (!cmdName) return; // No command provided
                    
                    // Get command
                    const cmd = commands.get(cmdName);
                    
                    if (!cmd) {
                        // Command not found
                        await sock.sendMessage(from, { 
                            text: `❌ Command "${cmdName}" not found.\nType .help to see available commands.` 
                        });
                        return;
                    }
                    
                    // Send typing indicator
                    await sock.sendPresenceUpdate('composing', from);
                    
                    // Execute command
                    await cmd.execute(m, sock, Array.from(commands.values()), args);
                    
                } catch (error) {
                    console.error(`Command execution error:`, error);
                    await sock.sendMessage(from, { 
                        text: `❌ Error executing command: ${error.message}` 
                    });
                }
            }
        });
        
        // Auto-reject calls
        sock.ev.on('call', async (calls) => {
            if (calls[0]) {
                try {
                    await sock.rejectCall(calls[0].id, calls[0].from);
                    console.log(`📞 Call rejected from ${calls[0].from}`);
                } catch (error) {
                    console.error('Error rejecting call:', error.message);
                }
            }
        });
        
        // Keep connection alive
        setInterval(() => {
            if (sock?.user) {
                sock.sendPresenceUpdate('available');
            }
        }, 30000);
        
    } catch (error) {
        console.error('❌ Bot startup failed:', error);
        console.log('🔄 Retrying in 10 seconds...');
        setTimeout(startBot, 10000);
    }
}

// Zero-wait pairing endpoint
app.get('/code', async (req, res) => {
    let num = req.query.number;
    
    if (!num) {
        return res.status(400).json({ 
            success: false, 
            error: "Phone number required (e.g., /code?number=255123456789)" 
        });
    }
    
    // Format number
    num = num.replace(/\D/g, '');
    
    if (!num.startsWith('255') || num.length !== 12) {
        return res.status(400).json({ 
            success: false, 
            error: "Invalid Tanzanian number format. Use 255XXXXXXXXX" 
        });
    }
    
    console.log(`📱 Pairing request for: ${num}`);
    
    try {
        // Ensure bot is running
        if (!sock) {
            console.log('🤖 Starting bot for pairing...');
            await startBot();
            await delay(3000); // Wait for initialization
        }
        
        // Wait for socket to be ready
        let attempts = 0;
        while (!sock || sock.connection !== 'open') {
            await delay(1000);
            attempts++;
            if (attempts > 30) {
                return res.status(408).json({ 
                    success: false, 
                    error: "Bot initialization timeout. Try again." 
                });
            }
        }
        
        // Request pairing code
        const code = await sock.requestPairingCode(num);
        
        console.log(`✅ Pairing code generated for ${num}: ${code}`);
        
        res.json({ 
            success: true, 
            number: num, 
            code: code,
            message: `Enter code ${code} on target phone's WhatsApp > Linked Devices > Link a Device`
        });
        
    } catch (error) {
        console.error('Pairing error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || "WhatsApp pairing failed. Check number format and try again." 
        });
    }
});

// Bot status endpoint
app.get('/status', (req, res) => {
    const status = {
        bot: sock ? {
            connected: sock.connection === 'open',
            user: sock.user?.id || 'Not logged in',
            connection: sock.connection || 'disconnected'
        } : null,
        commands: {
            loaded: commands.size,
            categories: [...new Set(Array.from(commands.values()).map(cmd => cmd.category))]
        },
        timestamp: new Date().toISOString()
    };
    
    res.json(status);
});

// Reload commands endpoint
app.get('/reload', (req, res) => {
    const before = commands.size;
    loadCmds();
    const after = commands.size;
    
    res.json({ 
        success: true, 
        message: `Commands reloaded. Before: ${before}, After: ${after}` 
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start server and bot
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
    console.log(`🔗 Pairing URL: http://localhost:${PORT}/code?number=255XXXXXXXXX\n`);
    startBot().catch(console.error);
});

// Handle process exit
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down WRONG TURN 6...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('🔥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});
