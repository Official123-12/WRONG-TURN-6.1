require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion,
    getAggregateVotesInPollMessage,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, setDoc, getDoc, deleteDoc } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const crypto = require('crypto');

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
let sock = null;
let isConnected = false;
let pairingCode = null;
let pairingNumber = null;

// Simple in-memory auth state (no Firebase dependency for auth)
const useMemoryAuth = () => {
    const state = {
        creds: {},
        keys: {}
    };
    
    return {
        state,
        saveCreds: () => {
            // Save to local file as backup
            fs.writeFileSync('./session.json', JSON.stringify(state, null, 2));
            console.log('💾 Saved session locally');
        }
    };
};

const loadCmds = () => {
    try {
        const cmdPath = path.resolve(__dirname, 'commands');
        if (!fs.existsSync(cmdPath)) {
            console.log('⚠️ Creating commands directory...');
            fs.mkdirSync(cmdPath, { recursive: true });
            
            // Create essential commands
            const cmds = {
                'ping.js': `module.exports = {
    name: 'ping',
    description: 'Check bot status',
    category: 'utility',
    execute: async (m, sock) => {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        await sock.sendMessage(m.key.remoteJid, { 
            text: '🏓 *PONG!*\\n\\n' +
                  '🤖 *WRONG TURN 6*\\n' +
                  '✅ *Status:* ONLINE\\n' +
                  '⏱️ *Uptime:* ' + hours + 'h ' + minutes + 'm ' + seconds + 's\\n' +
                  '📊 *Commands:* ' + commands.size + ' loaded\\n' +
                  '🔧 *Engine:* Pairing-Code Only\\n' +
                  '\\n🥀 *STANYTZ*'
        });
    }
};`,
                
                'menu.js': `module.exports = {
    name: 'menu',
    description: 'Show all commands',
    category: 'utility',
    execute: async (m, sock, commands) => {
        const categories = {};
        commands.forEach(cmd => {
            if (!categories[cmd.category]) categories[cmd.category] = [];
            categories[cmd.category].push(\`• .\${cmd.name}\${cmd.description ? ' - ' + cmd.description : ''}\`);
        });
        
        let menu = '📖 *WRONG TURN 6 COMMANDS*\\n\\n';
        Object.keys(categories).forEach(cat => {
            menu += \`📁 *\${cat.toUpperCase()}*\\n\${categories[cat].join('\\n')}\\n\\n\`;
        });
        menu += '\\n🔧 *Prefix:* .\\n👨‍💻 *Dev:* STANYTZ';
        
        await sock.sendMessage(m.key.remoteJid, { text: menu });
    }
};`,
                
                'owner.js': `module.exports = {
    name: 'owner',
    description: 'Contact bot owner',
    category: 'utility',
    execute: async (m, sock) => {
        const ownerInfo = '👑 *WRONG TURN 6 OWNER*\\n\\n' +
                         '👤 *Name:* STANYTZ\\n' +
                         '📱 *Contact:* wa.me/255000000000\\n' +
                         '🌐 *GitHub:* github.com/stanytz\\n' +
                         '\\n💬 *For bot issues or queries*';
        await sock.sendMessage(m.key.remoteJid, { text: ownerInfo });
    }
};`
            };
            
            Object.entries(cmds).forEach(([fileName, content]) => {
                const utilPath = path.join(cmdPath, 'utility');
                fs.mkdirSync(utilPath, { recursive: true });
                fs.writeFileSync(path.join(utilPath, fileName), content);
            });
            
            console.log('✅ Created essential commands');
        }
        
        let loaded = 0;
        fs.readdirSync(cmdPath).forEach(folder => {
            const categoryPath = path.join(cmdPath, folder);
            if (fs.lstatSync(categoryPath).isDirectory()) {
                fs.readdirSync(categoryPath).filter(f => f.endsWith('.js')).forEach(file => {
                    try {
                        const filePath = path.join(categoryPath, file);
                        delete require.cache[require.resolve(filePath)];
                        
                        const cmd = require(filePath);
                        
                        if (!cmd?.name || typeof cmd.execute !== 'function') {
                            console.log(`⚠️ Skipping ${file}: Invalid command`);
                            return;
                        }
                        
                        const cmdName = cmd.name.trim().toLowerCase();
                        commands.set(cmdName, cmd);
                        cmd.category = folder;
                        loaded++;
                        
                    } catch (e) {
                        console.log(`❌ Error loading ${file}:`, e.message);
                    }
                });
            }
        });
        
        console.log(`✅ Loaded ${loaded} commands`);
        
    } catch (error) {
        console.error('❌ Command loading error:', error);
    }
};

async function connectToWhatsApp(authState = null) {
    try {
        console.log('🔗 Initializing WhatsApp connection...');
        
        let state;
        if (authState && authState.creds && Object.keys(authState.creds).length > 0) {
            console.log('📥 Using provided auth state');
            state = authState;
        } else {
            console.log('🆕 Creating new auth state');
            state = useMemoryAuth().state;
        }
        
        const { version } = await fetchLatestBaileysVersion();
        
        sock = makeWASocket({
            auth: state,
            version,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Safari"),
            printQRInTerminal: false, // No QR codes
            markOnlineOnConnect: true,
            syncFullHistory: false,
            emitOwnEvents: true,
            generateHighQualityLinkPreview: true,
            defaultQueryTimeoutMs: 60000,
        });
        
        // Save credentials when updated
        sock.ev.on('creds.update', () => {
            if (sock?.authState?.creds) {
                useMemoryAuth().saveCreds();
            }
        });
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (connection === 'open') {
                console.log('✅ WRONG TURN 6 IS ONLINE');
                isConnected = true;
                
                const botId = sock.user.id.split(':')[0];
                console.log(`🤖 Bot ID: ${botId}`);
                
                try {
                    // Send system message to owner
                    const welcome = `┏━━━━ 『 WRONG TURN 6 』 ━━━━┓
┃
┃ 🥀 *PAIRING SYSTEM ACTIVE*
┃
┣━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🛡️ *DEV    :* STANYTZ
┃ ⚙️ *VERSION:* 6.6.0
┃ 🌐 *AUTH   :* Pairing-Code Only
┃ 🌷 *PREFIX :* [ . ]
┗━━━━━━━━━━━━━━━━━━━━━━━┛

✅ *SYSTEM ARMED AND READY*`;
                    
                    await sock.sendMessage(sock.user.id, { text: welcome });
                    
                    // Save successful connection to Firebase
                    const sessionRef = doc(db, 'bots', 'wt6');
                    await setDoc(sessionRef, {
                        status: 'online',
                        botId: botId,
                        lastOnline: new Date().toISOString(),
                        commands: commands.size,
                        pairingCode: null // Clear pairing code after success
                    }, { merge: true });
                    
                    pairingCode = null;
                    pairingNumber = null;
                    
                } catch (error) {
                    console.error('Welcome message error:', error.message);
                }
            }
            
            if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'Unknown';
                
                console.log(`🔌 Connection closed: ${statusCode} - ${errorMessage}`);
                
                if (statusCode === DisconnectReason.loggedOut || 
                    errorMessage.includes('401') || 
                    errorMessage.includes('Not Authorized')) {
                    
                    console.log('🚫 Session logged out. New pairing required.');
                    
                    // Clear session data
                    try {
                        const sessionRef = doc(db, 'bots', 'wt6');
                        await setDoc(sessionRef, {
                            status: 'logged_out',
                            lastLogout: new Date().toISOString(),
                            pairingCode: null
                        }, { merge: true });
                        
                        // Delete local session
                        if (fs.existsSync('./session.json')) {
                            fs.unlinkSync('./session.json');
                        }
                        
                    } catch (error) {
                        console.error('Session cleanup error:', error.message);
                    }
                    
                    // Wait and try to reconnect with new pairing
                    setTimeout(() => {
                        console.log('🔄 Ready for new pairing...');
                        // Don't auto-reconnect - wait for new pairing
                    }, 5000);
                    
                } else {
                    // Network error - try to reconnect
                    console.log('🔄 Reconnecting in 10 seconds...');
                    setTimeout(() => connectToWhatsApp(sock?.authState), 10000);
                }
            }
        });
        
        // Message handler
        sock.ev.on('messages.upsert', async ({ messages }) => {
            try {
                const m = messages[0];
                if (!m.message || m.key.fromMe) return;
                
                const from = m.key.remoteJid;
                const body = (
                    m.message.conversation || 
                    m.message.extendedTextMessage?.text || 
                    m.message.imageMessage?.caption || 
                    ""
                ).trim();
                
                if (body.startsWith('.')) {
                    const args = body.slice(1).trim().split(/ +/);
                    const cmdName = args.shift().toLowerCase();
                    
                    const cmd = commands.get(cmdName);
                    if (cmd) {
                        console.log(`📨 Command: ${cmd.name} from ${from.split('@')[0]}`);
                        await cmd.execute(m, sock, Array.from(commands.values()), args);
                    }
                }
                
            } catch (error) {
                console.error('Message processing error:', error.message);
            }
        });
        
        // Keep-alive
        setInterval(() => {
            if (sock?.user) {
                sock.sendPresenceUpdate('available');
            }
        }, 30000);
        
    } catch (error) {
        console.error('❌ Connection error:', error.message);
        console.log('🔄 Retrying in 15 seconds...');
        setTimeout(() => connectToWhatsApp(), 15000);
    }
}

async function startBot() {
    console.log('🚀 Starting WRONG TURN 6 (Pairing-Only Mode)');
    console.log('📡 No QR Codes - Pairing Code Only');
    loadCmds();
    
    // Try to load existing session
    try {
        if (fs.existsSync('./session.json')) {
            console.log('📥 Loading existing session...');
            const sessionData = JSON.parse(fs.readFileSync('./session.json', 'utf8'));
            await connectToWhatsApp(sessionData);
        } else {
            console.log('📭 No existing session found');
            console.log('💡 Use /pair?number=PHONE to get pairing code');
        }
    } catch (error) {
        console.log('❌ Session load failed:', error.message);
        await connectToWhatsApp();
    }
}

// API Routes
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Main pairing endpoint
app.get('/pair', async (req, res) => {
    try {
        const number = req.query.number;
        if (!number) {
            return res.json({ 
                success: false, 
                error: "Phone number required. Use /pair?number=255XXXXXXXXX" 
            });
        }
        
        const cleanNumber = number.replace(/\D/g, '');
        if (!cleanNumber.match(/^\d{10,15}$/)) {
            return res.json({ 
                success: false, 
                error: "Invalid phone number format" 
            });
        }
        
        console.log(`📱 Pairing request for: ${cleanNumber}`);
        
        // If already connected, disconnect first
        if (sock && isConnected) {
            console.log('🔄 Disconnecting existing session...');
            await sock.logout();
            sock = null;
            isConnected = false;
            await delay(2000);
        }
        
        // Start fresh connection
        if (fs.existsSync('./session.json')) {
            fs.unlinkSync('./session.json');
        }
        
        // Initialize new socket for pairing
        const { state, saveCreds } = useMemoryAuth();
        const { version } = await fetchLatestBaileysVersion();
        
        const tempSock = makeWASocket({
            auth: state,
            version,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Safari"),
            printQRInTerminal: false,
            markOnlineOnConnect: false,
        });
        
        tempSock.ev.on('creds.update', saveCreds);
        
        // Request pairing code
        try {
            console.log(`🔐 Requesting pairing code for ${cleanNumber}...`);
            const code = await tempSock.requestPairingCode(cleanNumber);
            
            // Save pairing info
            pairingCode = code;
            pairingNumber = cleanNumber;
            
            const sessionRef = doc(db, 'bots', 'wt6');
            await setDoc(sessionRef, {
                pairingCode: code,
                pairingNumber: cleanNumber,
                pairingTime: new Date().toISOString(),
                status: 'pairing_pending'
            }, { merge: true });
            
            console.log(`✅ Pairing code generated: ${code}`);
            
            // Close temporary socket
            setTimeout(() => {
                if (tempSock) tempSock.end(undefined);
            }, 1000);
            
            res.json({
                success: true,
                code: code,
                number: cleanNumber,
                instructions: `Send this code to WhatsApp: *${code}*\\nEnter it in WhatsApp → Linked Devices → Link a Device`,
                expires: "Code expires in 60 seconds"
            });
            
            // Wait for pairing and connect
            setTimeout(async () => {
                console.log('🔄 Attempting to connect with new pairing...');
                await delay(2000);
                
                if (fs.existsSync('./session.json')) {
                    const sessionData = JSON.parse(fs.readFileSync('./session.json', 'utf8'));
                    await connectToWhatsApp(sessionData);
                }
            }, 3000);
            
        } catch (pairError) {
            console.error('❌ Pairing failed:', pairError.message);
            
            if (tempSock) tempSock.end(undefined);
            
            // Specific error handling
            if (pairError.message.includes('timed out')) {
                res.json({ 
                    success: false, 
                    error: "WhatsApp server timeout",
                    solution: "Try again in 30 seconds" 
                });
            } else if (pairError.message.includes('precondition')) {
                res.json({ 
                    success: false, 
                    error: "Phone not ready",
                    solution: "Make sure WhatsApp is open on your phone" 
                });
            } else {
                res.json({ 
                    success: false, 
                    error: pairError.message 
                });
            }
        }
        
    } catch (error) {
        console.error('Pairing route error:', error);
        res.json({ 
            success: false, 
            error: "Server error: " + error.message 
        });
    }
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({
        bot: "WRONG TURN 6",
        version: "6.6.0",
        status: isConnected ? "🟢 ONLINE" : "🔴 OFFLINE",
        connection: sock?.user ? {
            id: sock.user.id.split(':')[0],
            name: sock.user.name || 'Unknown'
        } : null,
        commands: commands.size,
        pairing: {
            code: pairingCode,
            number: pairingNumber
        },
        uptime: process.uptime(),
        mode: "Pairing-Code Only (No QR)"
    });
});

// Force logout
app.get('/logout', async (req, res) => {
    try {
        if (sock) {
            await sock.logout();
            sock = null;
        }
        
        if (fs.existsSync('./session.json')) {
            fs.unlinkSync('./session.json');
        }
        
        isConnected = false;
        
        const sessionRef = doc(db, 'bots', 'wt6');
        await setDoc(sessionRef, {
            status: 'logged_out',
            lastLogout: new Date().toISOString(),
            pairingCode: null
        }, { merge: true });
        
        res.json({ 
            success: true, 
            message: "Logged out successfully. New pairing required." 
        });
        
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Test command execution
app.get('/test', (req, res) => {
    res.json({
        commands: Array.from(commands.keys()),
        count: commands.size,
        categories: [...new Set(Array.from(commands.values()).map(c => c.category))]
    });
});

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 WRONG TURN 6 Server`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🔧 Mode: Pairing-Code Authentication Only`);
    console.log(`📱 Pairing URL: http://localhost:${PORT}/pair?number=YOUR_NUMBER`);
    console.log(`📊 Status URL: http://localhost:${PORT}/status`);
    console.log('='.repeat(50));
    
    startBot();
});

// Clean exit
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down WRONG TURN 6...');
    if (sock) {
        await sock.logout();
    }
    process.exit(0);
});
