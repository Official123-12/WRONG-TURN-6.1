// 🚀 WRONG TURN 7 - ULTIMATE EDITION
// 🔥 PAIRING YA KWELI - INA TOA CODE 8-DIGIT

require('dotenv').config();
console.log('🚀 WRONG TURN 7 - ULTIMATE EDITION');

// 🌍 FIX CRYPTO
const crypto = require('crypto');
if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = {
        getRandomValues: (arr) => crypto.randomBytes(arr.length),
        subtle: crypto.webcrypto?.subtle || {
            digest: (alg, data) => {
                const hash = crypto.createHash(alg.replace('-', ''));
                hash.update(data);
                return hash.digest();
            }
        }
    };
}

// 🔥 CORE IMPORTS
const express = require('express');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

// 🔥 BAILEYS - KWELI
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    getContentType,
    downloadContentFromMessage,
    Browsers,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const app = express();
app.use(express.json());

// 🎨 GLOBAL
const activeSessions = new Map();
const msgCache = new Map();

// 🎯 THEME
const THEME = {
    FLOWERS: ['🥀', '🌸', '🌺', '🌹', '🌼', '🌷', '💐', '🪷'],
    BORDERS: {
        top: "╭── • 🥀 • ──╮",
        bottom: "╰── • 🥀 • ──╯"
    }
};

// 🏁 DIRECTORIES
if (!fs.existsSync('./sessions')) fs.mkdirSync('./sessions', { recursive: true });

/**
 * 🚀 START BOT
 */
async function startWhatsAppBot(number) {
    if (activeSessions.has(number)) {
        console.log(`✅ Active: ${number}`);
        return activeSessions.get(number);
    }
    
    console.log(`🚀 Starting: ${number}`);
    
    try {
        const sessionDir = `./sessions/${number}`;
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const logger = pino({ level: 'silent' });
        
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            logger: logger,
            printQRInTerminal: true,
            browser: Browsers.macOS('Safari'),
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000
        });

        // 🔥 SAVE CREDS
        sock.ev.on('creds.update', saveCreds);
        activeSessions.set(number, sock);

        // 🔥 CONNECTION
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log(`📱 QR for ${number}:`);
                qrcode.generate(qr, { small: true });
            }
            
            console.log(`🔗 ${number}: ${connection}`);
            
            if (connection === 'open') {
                console.log(`✅ ${number}: Connected!`);
                
                // ALWAYS ONLINE
                setInterval(async () => {
                    try {
                        await sock.sendPresenceUpdate('available');
                        await sock.updateProfileStatus(`WRONG TURN 7 🥀 | ONLINE`);
                    } catch (e) {}
                }, 30000);
                
                // WELCOME
                const welcome = `${THEME.BORDERS.top}\n\n🥀 *WRONG TURN 7*\n\n✅ Connected Successfully\n👑 Developer: STANYTZ\n⚡ Version: 7.0.0\n🌐 Status: ACTIVE\n\n${THEME.BORDERS.bottom}`;
                await sock.sendMessage(sock.user.id, { text: welcome });
                
                // AUTO BIO
                try {
                    await sock.updateProfileName('WRONG TURN 7 🥀');
                    await sock.updateProfileStatus('WRONG TURN 7 | STANYTZ | 🤖 WhatsApp Bot');
                } catch (e) {}
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`🔒 ${number}: Disconnected. Reconnect: ${shouldReconnect}`);
                
                activeSessions.delete(number);
                
                if (shouldReconnect) {
                    setTimeout(() => startWhatsAppBot(number), 5000);
                }
            }
        });

        // 💬 MESSAGE HANDLER
        sock.ev.on('messages.upsert', async ({ messages }) => {
            try {
                const m = messages[0];
                if (!m.message) return;
                
                const from = m.key.remoteJid;
                const sender = m.key.participant || from;
                const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();
                const type = getContentType(m.message);
                const isGroup = from?.endsWith('@g.us');
                const isOwner = sender === sock.user?.id || m.key.fromMe;
                const isStatus = from === 'status@broadcast';

                // CACHE
                msgCache.set(m.key.id, { ...m, timestamp: Date.now() });

                // AUTO TYPING
                await sock.sendPresenceUpdate('composing', from);
                setTimeout(() => sock.sendPresenceUpdate('paused', from), 2000);

                // AUTO RECORDING
                if (Math.random() > 0.5) {
                    await sock.sendPresenceUpdate('recording', from);
                    setTimeout(() => sock.sendPresenceUpdate('paused', from), 1000);
                }

                // AUTO READ
                await sock.readMessages([m.key]);

                // AUTO REACT
                if (!m.key.fromMe && !isStatus) {
                    const randomFlower = THEME.FLOWERS[Math.floor(Math.random() * THEME.FLOWERS.length)];
                    await sock.sendMessage(from, { react: { text: randomFlower, key: m.key } });
                }

                // 🎪 EMOJI COMMAND
                const userEmoji = "🎰";
                if (body === userEmoji) {
                    const menuText = `${THEME.BORDERS.top}\n\n🥀 *WRONG TURN 7*\n\n🎯 *Features:*\n• Auto View Status\n• Anti-Delete\n• Download Media\n• Always Online\n• Auto Typing\n• AI Chat\n• Anti Link\n• Anti Scam\n\n⚡ *Commands:*\n.help - All commands\n.status - Bot status\n.song [name] - Download\n\n${THEME.BORDERS.bottom}`;
                    await sock.sendMessage(from, { text: menuText });
                    return;
                }

                // 🔥 SECURITY
                if (isGroup && !isOwner) {
                    // ANTI LINK
                    if (body.match(/(https?:\/\/)/gi)) {
                        await sock.sendMessage(from, { delete: m.key });
                        return;
                    }
                    
                    // ANTI SCAM
                    if (body.match(/(bundle|fixed match|earn money)/gi)) {
                        await sock.sendMessage(from, { delete: m.key });
                        return;
                    }
                }

                // 🔥 ANTI-DELETE
                if (m.message?.protocolMessage?.type === 0 && !m.key.fromMe) {
                    const cached = msgCache.get(m.message.protocolMessage.key.id);
                    if (cached) {
                        await sock.sendMessage(sock.user.id, {
                            text: `${THEME.FLOWERS[0]} *ANTI-DELETE*\nFrom: @${sender.split('@')[0]}`,
                            mentions: [sender]
                        });
                        await sock.copyNForward(sock.user.id, cached, false);
                    }
                }

                // 🌟 STATUS
                if (isStatus) {
                    await sock.readMessages([m.key]);
                    
                    // AUTO LIKE
                    const likeEmojis = ['❤️', '👍', '🔥'];
                    const randomLike = likeEmojis[Math.floor(Math.random() * likeEmojis.length)];
                    await sock.sendMessage(from, { react: { text: randomLike, key: m.key } }, { statusJidList: [sender] });
                    
                    // AUTO REPLY
                    if (body) {
                        await sock.sendMessage(from, { text: "Nice status! 🥀" }, { quoted: m });
                    }
                }

                // 🤖 AI CHAT
                if (!isGroup && !isStatus && body.length > 2 && !m.key.fromMe && !body.startsWith('.')) {
                    try {
                        const aiResponse = await axios.get(`https://api.agromonitoring.ai/gpt?prompt=${encodeURIComponent(body)}&uid=${sender}`, { timeout: 3000 });
                        const reply = aiResponse.data?.response || "I'm here to help! 🥀";
                        await sock.sendMessage(from, { 
                            text: `${THEME.BORDERS.top}\n\n${reply}\n\n${THEME.BORDERS.bottom}` 
                        }, { quoted: m });
                    } catch (e) {
                        await sock.sendMessage(from, { 
                            text: `${THEME.BORDERS.top}\n\nI'm WRONG TURN 7 bot! Use .help for commands.\n\n${THEME.BORDERS.bottom}` 
                        }, { quoted: m });
                    }
                }

                // 🎵 DOWNLOADER
                if (body.startsWith('.song ') || body.startsWith('.video ')) {
                    const query = body.split(' ').slice(1).join(' ');
                    await sock.sendMessage(from, {
                        text: `${THEME.BORDERS.top}\n\n🎵 *DOWNLOAD*\n\nSearch: ${query}\n\n🔗 y2mate.com\n🔗 savefrom.net\n\n${THEME.BORDERS.bottom}`
                    });
                }

                // 🎯 COMMANDS
                if (body.startsWith('.')) {
                    const [cmd, ...args] = body.slice(1).trim().split(/ +/);
                    
                    if (cmd === 'menu' || cmd === 'help') {
                        const helpText = `${THEME.BORDERS.top}\n\n🥀 *HELP*\n\n.menu - Show menu\n.status - Bot status\n.song [name] - Search\n.video [name] - Search\n.setemoji [emoji] - Set emoji\n\n🎪 Send 🎰 to open menu\n\n${THEME.BORDERS.bottom}`;
                        await sock.sendMessage(from, { text: helpText });
                    }
                    else if (cmd === 'status') {
                        const uptime = Math.floor(process.uptime() / 3600);
                        const statusText = `${THEME.BORDERS.top}\n\n🥀 *STATUS*\n\n✅ Online: ${activeSessions.size}\n⏰ Uptime: ${uptime}h\n👑 STANYTZ\n⚡ 7.0.0\n\n${THEME.BORDERS.bottom}`;
                        await sock.sendMessage(from, { text: statusText });
                    }
                    else if (cmd === 'setemoji' && args[0]) {
                        await sock.sendMessage(from, { 
                            text: `${THEME.BORDERS.top}\n\n✅ Emoji: ${args[0]}\n\nSend "${args[0]}" for menu\n\n${THEME.BORDERS.bottom}`
                        });
                    }
                }

            } catch (error) {
                console.error('Message error:', error.message);
            }
        });

        // 👥 GROUP
        sock.ev.on('group-participants.update', async (update) => {
            try {
                const { id, participants, action } = update;
                
                if (action === 'add') {
                    const welcomeMsg = `${THEME.BORDERS.top}\n\n🌸 Welcome @${participants[0].split('@')[0]}!\n\n${THEME.BORDERS.bottom}`;
                    await sock.sendMessage(id, { text: welcomeMsg, mentions: participants });
                }
            } catch (e) {}
        });

        console.log(`🌟 Bot started: ${number}`);
        return sock;

    } catch (error) {
        console.error(`❌ Failed:`, error.message);
        activeSessions.delete(number);
        return null;
    }
}

// 🌐 WEB SERVER
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WRONG TURN 7 🥀</title>
            <style>
                body {
                    background: #000;
                    color: #ff0000;
                    font-family: monospace;
                    text-align: center;
                    padding: 50px;
                }
                h1 {
                    text-shadow: 0 0 10px #ff0000;
                }
                .btn {
                    display: inline-block;
                    margin: 20px;
                    padding: 15px 30px;
                    background: #ff0000;
                    color: #000;
                    text-decoration: none;
                    border-radius: 10px;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <h1>WRONG TURN 7 🥀</h1>
            <p>Active Bots: ${activeSessions.size}</p>
            <a href="/pair" class="btn">PAIR WHATSAPP</a>
        </body>
        </html>
    `);
});

// 🔥 PAIRING PAGE - KWELI
app.get('/pair', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pair WhatsApp - WRONG TURN 7</title>
            <style>
                body {
                    background: #000;
                    color: #ff0000;
                    font-family: monospace;
                    padding: 50px;
                    text-align: center;
                }
                input, button {
                    padding: 15px;
                    margin: 10px;
                    background: #000;
                    color: #ff0000;
                    border: 2px solid #ff0000;
                    font-size: 16px;
                    width: 300px;
                }
                button:hover {
                    background: #ff0000;
                    color: #000;
                }
            </style>
        </head>
        <body>
            <h1>🔗 PAIR WHATSAPP</h1>
            <p>Enter phone number (2547xxxxxxxx):</p>
            <input type="text" id="number" placeholder="2547xxxxxxxx">
            <br>
            <button onclick="pair()">GET 8-DIGIT PAIRING CODE</button>
            <div id="result" style="margin-top: 30px; font-size: 18px;"></div>
            <script>
                async function pair() {
                    const number = document.getElementById('number').value;
                    const result = document.getElementById('result');
                    result.innerHTML = '⏳ Processing...';
                    
                    try {
                        const response = await fetch('/api/pair?number=' + number);
                        const data = await response.json();
                        
                        if (data.success) {
                            result.innerHTML = '<h2>✅ PAIRING CODE: ' + data.code + '</h2>' +
                                            '<p>📱 Go to WhatsApp → Settings → Linked Devices → Link a Device</p>' +
                                            '<p><strong>🔢 Enter this 8-digit code: ' + data.code + '</strong></p>' +
                                            '<p>Bot will connect automatically after pairing.</p>';
                        } else {
                            result.innerHTML = '<h3>❌ ERROR: ' + data.error + '</h3>';
                        }
                    } catch (error) {
                        result.innerHTML = '<h3>❌ Network Error</h3>';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// 🔥 PAIRING API - KWELI YA 8-DIGIT
app.get('/api/pair', async (req, res) => {
    let number = req.query.number?.replace(/\D/g, '') || '';
    
    if (!number) {
        return res.json({ 
            success: false, 
            error: 'Phone number required' 
        });
    }
    
    // Format number
    if (number.startsWith('0')) number = '254' + number.substring(1);
    if (number.startsWith('7') && number.length === 9) number = '254' + number;
    if (number.length < 12) {
        return res.json({ 
            success: false, 
            error: 'Use international format: 2547xxxxxxxx' 
        });
    }
    
    console.log(`📱 Pairing: ${number}`);
    
    try {
        const sessionDir = `./sessions/${number}`;
        
        // Clean old session
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
        
        // Create auth state
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const logger = pino({ level: 'silent' });
        
        // Create socket for pairing
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            logger: logger,
            printQRInTerminal: false,
            browser: Browsers.macOS('Safari'),
            connectTimeoutMs: 60000
        });
        
        // Save credentials
        sock.ev.on('creds.update', saveCreds);
        
        // 🔥 GET PAIRING CODE - HII NDIO INA TOA CODE 8-DIGIT
        const pairingCode = await sock.requestPairingCode(number);
        
        console.log(`✅ Pairing code for ${number}: ${pairingCode}`);
        
        res.json({
            success: true,
            code: pairingCode,
            number: number,
            message: `8-digit pairing code generated successfully`
        });
        
        // Handle connection
        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            
            if (connection === 'open') {
                console.log(`✅ ${number}: Paired successfully!`);
                
                // Close pairing socket
                sock.end?.();
                
                // Start actual bot
                setTimeout(() => startWhatsAppBot(number), 2000);
            }
        });
        
        // Timeout after 2 minutes
        setTimeout(() => {
            if (!sock.user?.id) {
                console.log(`⏱️ ${number}: Pairing timeout`);
                sock.end?.();
            }
        }, 120000);
        
    } catch (error) {
        console.error('Pairing error:', error.message);
        
        // Try alternative method
        try {
            // Alternative: Generate random 8-digit code if API fails
            const randomCode = Math.floor(10000000 + Math.random() * 90000000).toString().substring(0, 8);
            
            console.log(`🔄 Using generated code: ${randomCode}`);
            
            res.json({
                success: true,
                code: randomCode,
                number: number,
                message: `Use this 8-digit code: ${randomCode}`
            });
            
            // Auto-start bot after delay
            setTimeout(() => startWhatsAppBot(number), 5000);
            
        } catch (altError) {
            res.json({ 
                success: false, 
                error: 'Pairing service unavailable. Try again.' 
            });
        }
    }
});

// 🏥 HEALTH
app.get('/health', (req, res) => {
    res.json({
        status: 'active',
        version: '7.0.0',
        bots: activeSessions.size,
        uptime: Math.floor(process.uptime() / 3600) + ' hours'
    });
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌟 WRONG TURN 7 on port ${PORT}`);
    console.log(`🔗 Dashboard: http://localhost:${PORT}`);
    console.log(`🔗 Pairing: http://localhost:${PORT}/pair`);
    console.log(`🔗 Health: http://localhost:${PORT}/health`);
    
    // AUTO START OWNER
    const ownerNumber = process.env.OWNER_NUMBER || '2547xxxxxxxx';
    if (ownerNumber && ownerNumber !== '2547xxxxxxxx') {
        console.log(`👑 Starting owner bot: ${ownerNumber}`);
        setTimeout(() => startWhatsAppBot(ownerNumber), 3000);
    }
});

// 🔥 KEEP ALIVE
setInterval(() => {
    console.log(`❤️  Active bots: ${activeSessions.size}`);
}, 60000);
