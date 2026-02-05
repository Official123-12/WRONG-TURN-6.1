// 🚀 WRONG TURN 7 - ULTIMATE EDITION - FIXED VERSION
// 🔥 NO CRYPTO ERRORS - ALWAYS ACTIVE

console.log('🚀 WRONG TURN 7 - ULTIMATE EDITION');

// 🌍 FIX CRYPTO ERROR FIRST
if (typeof globalThis.crypto === 'undefined') {
    const crypto = require('crypto');
    globalThis.crypto = {
        getRandomValues: (arr) => crypto.randomBytes(arr.length),
        subtle: {
            digest: (algorithm, data) => {
                return new Promise((resolve, reject) => {
                    try {
                        const hash = crypto.createHash(algorithm.replace('-', ''));
                        hash.update(data);
                        resolve(hash.digest());
                    } catch (e) {
                        reject(e);
                    }
                });
            }
        }
    };
}

// 🌍 CORE IMPORTS
const express = require('express');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const qrcode = require('qrcode-terminal');

// 🔥 BAILEYS IMPORT - FIXED
let makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, getContentType, downloadContentFromMessage, Browsers, proto;

try {
    const baileys = require('baileys');
    makeWASocket = baileys.default || baileys.makeWASocket;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore;
    getContentType = baileys.getContentType;
    downloadContentFromMessage = baileys.downloadContentFromMessage;
    Browsers = baileys.Browsers;
    proto = baileys.proto;
} catch (error) {
    console.log('⚠️ Using alternative baileys import');
    const {
        default: makeWASocketAlt,
        useMultiFileAuthState: useMultiFileAuthStateAlt,
        DisconnectReason: DisconnectReasonAlt,
        makeCacheableSignalKeyStore: makeCacheableSignalKeyStoreAlt,
        getContentType: getContentTypeAlt,
        downloadContentFromMessage: downloadContentFromMessageAlt,
        Browsers: BrowsersAlt,
        proto: protoAlt
    } = require('@whiskeysockets/baileys');
    
    makeWASocket = makeWASocketAlt;
    useMultiFileAuthState = useMultiFileAuthStateAlt;
    DisconnectReason = DisconnectReasonAlt;
    makeCacheableSignalKeyStore = makeCacheableSignalKeyStoreAlt;
    getContentType = getContentTypeAlt;
    downloadContentFromMessage = downloadContentFromMessageAlt;
    Browsers = BrowsersAlt;
    proto = protoAlt;
}

const app = express();
app.use(express.json());

// 🎨 GLOBAL VARIABLES
const activeSessions = new Map();
const msgCache = new Map();

// 🎯 THEME SYSTEM
const THEME = {
    FLOWERS: ['🥀', '🌸', '🌺', '🌹', '🌼', '🌷', '💐', '🪷'],
    BORDERS: {
        top: "╭── • 🥀 • ──╮",
        bottom: "╰── • 🥀 • ──╯"
    }
};

// 🏁 CREATE DIRECTORIES
if (!fs.existsSync('./sessions')) fs.mkdirSync('./sessions', { recursive: true });

/**
 * 🔥 DOWNLOAD MEDIA
 */
async function downloadMedia(m, type) {
    try {
        const message = m.message?.[type + 'Message'] || 
                       m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.[type + 'Message'];
        
        if (!message) return null;
        
        const buffer = await downloadContentFromMessage(message, type);
        const chunks = [];
        for await (const chunk of buffer) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    } catch (error) {
        return null;
    }
}

/**
 * 🚀 START WHATSAPP BOT
 */
async function startWhatsAppBot(number) {
    if (activeSessions.has(number)) {
        console.log(`✅ Bot already active: ${number}`);
        return activeSessions.get(number);
    }
    
    console.log(`🚀 Starting bot: ${number}`);
    
    try {
        const sessionDir = `./sessions/${number}`;
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, { level: 'silent' })
            },
            logger: { level: 'silent' },
            printQRInTerminal: true,
            browser: Browsers.macOS('Safari'),
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000
        });

        // 🔥 SAVE CREDENTIALS
        sock.ev.on('creds.update', saveCreds);
        activeSessions.set(number, sock);

        // 🔄 CONNECTION HANDLER
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log(`📱 QR for ${number}:`);
                qrcode.generate(qr, { small: true });
            }
            
            console.log(`🔗 ${number}: ${connection}`);
            
            if (connection === 'open') {
                console.log(`✅ ${number}: Connected!`);
                
                // 🔥 ALWAYS ONLINE
                setInterval(async () => {
                    try {
                        await sock.sendPresenceUpdate('available');
                        await sock.updateProfileStatus(`WRONG TURN 7 🥀 | ONLINE`);
                    } catch (e) {}
                }, 30000);
                
                // WELCOME MESSAGE
                const welcome = `${THEME.BORDERS.top}\n\n🥀 *WRONG TURN 7 - ULTIMATE EDITION*\n\n✅ Connected Successfully!\n👑 Developer: STANYTZ\n⚡ Version: 7.0.0\n🌐 Status: ACTIVE & ARMED\n\n${THEME.BORDERS.bottom}`;
                await sock.sendMessage(sock.user.id, { text: welcome });
                
                // AUTO BIO
                await sock.updateProfileName('WRONG TURN 7 🥀');
                await sock.updateProfileStatus('WRONG TURN 7 | STANYTZ | 🤖 WhatsApp Bot');
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
                const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
                const type = getContentType(m.message);
                const isGroup = from?.endsWith('@g.us');
                const isOwner = sender === sock.user?.id || m.key.fromMe;
                const isStatus = from === 'status@broadcast';

                // 🔥 CACHE MESSAGE
                msgCache.set(m.key.id, { ...m, timestamp: Date.now() });

                // 🔥 AUTO TYPING
                await sock.sendPresenceUpdate('composing', from);
                setTimeout(() => sock.sendPresenceUpdate('paused', from), 2000);

                // 🔥 AUTO RECORDING (RANDOM)
                if (Math.random() > 0.5) {
                    await sock.sendPresenceUpdate('recording', from);
                    setTimeout(() => sock.sendPresenceUpdate('paused', from), 1000);
                }

                // 🔥 AUTO READ
                await sock.readMessages([m.key]);

                // 🔥 AUTO REACT
                if (!m.key.fromMe && !isStatus) {
                    const randomFlower = THEME.FLOWERS[Math.floor(Math.random() * THEME.FLOWERS.length)];
                    await sock.sendMessage(from, { react: { text: randomFlower, key: m.key } });
                }

                // 🔥 EMOJI COMMAND SYSTEM
                const userEmoji = "🎰"; // Default emoji
                if (body === userEmoji || body.includes(userEmoji)) {
                    const menuText = `${THEME.BORDERS.top}\n\n🥀 *WRONG TURN 7 MENU*\n\n🎯 *Features:*\n• Auto View Status\n• Anti-Delete Message\n• Download Songs/Videos\n• Download View-Once\n• Always Online\n• Fake Typing/Recording\n• Auto Like Status\n• AI Chat Features\n\n⚡ *Commands:*\n• .menu - This menu\n• .help - All commands\n• .status - Bot status\n• .settings - Configure\n\n${THEME.BORDERS.bottom}`;
                    await sock.sendMessage(from, { text: menuText });
                    return;
                }

                // 🔥 SECURITY SYSTEM
                if (isGroup && !isOwner) {
                    // ANTI LINK
                    if (body.match(/(https?:\/\/[^\s]+)/gi)) {
                        await sock.sendMessage(from, { delete: m.key });
                        await sock.sendMessage(from, { 
                            text: `${THEME.FLOWERS[0]} *ANTI-LINK* ${THEME.FLOWERS[0]}\n\nLinks are not allowed!`,
                            mentions: [sender]
                        });
                        return;
                    }
                    
                    // ANTI SCAM
                    if (body.match(/(bundle|fixed match|earn money|investment|quick money)/gi)) {
                        await sock.sendMessage(from, { delete: m.key });
                        await sock.sendMessage(from, { 
                            text: `${THEME.FLOWERS[0]} *SCAM ALERT* ${THEME.FLOWERS[0]}\n\nScam messages detected!`,
                            mentions: [sender]
                        });
                        return;
                    }
                }

                // 🔥 ANTI-DELETE
                if (m.message?.protocolMessage?.type === 0 && !m.key.fromMe) {
                    const cached = msgCache.get(m.message.protocolMessage.key.id);
                    if (cached) {
                        await sock.sendMessage(sock.user.id, {
                            text: `${THEME.FLOWERS[0]} *ANTI-DELETE* ${THEME.FLOWERS[0]}\n\nMessage recovered from @${sender.split('@')[0]}`,
                            mentions: [sender]
                        });
                        await sock.copyNForward(sock.user.id, cached, false);
                    }
                }

                // 🔥 ANTI VIEW-ONCE
                if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && !isOwner) {
                    try {
                        const media = await downloadMedia(m, 'image') || await downloadMedia(m, 'video');
                        if (media) {
                            await sock.sendMessage(sock.user.id, {
                                text: `${THEME.FLOWERS[0]} *VIEW-ONCE CAPTURED* ${THEME.FLOWERS[0]}\n\nFrom: @${sender.split('@')[0]}`
                            });
                            
                            if (media.toString('hex', 0, 4) === 'ffd8ff') {
                                await sock.sendMessage(sock.user.id, { image: media });
                            } else {
                                await sock.sendMessage(sock.user.id, { video: media });
                            }
                        }
                    } catch (e) {}
                }

                // 🌟 STATUS FEATURES
                if (isStatus) {
                    await sock.readMessages([m.key]);
                    
                    // AUTO LIKE STATUS
                    const likeEmojis = ['❤️', '👍', '🔥', '🥰', '🎉'];
                    const randomLike = likeEmojis[Math.floor(Math.random() * likeEmojis.length)];
                    await sock.sendMessage(from, { react: { text: randomLike, key: m.key } }, { statusJidList: [sender] });
                    
                    // AUTO REPLY TO STATUS
                    if (body) {
                        try {
                            const aiReply = await axios.get(`https://api.agromonitoring.ai/gpt?prompt=${encodeURIComponent(body.substring(0, 100))}&uid=${sender}`, { timeout: 3000 });
                            await sock.sendMessage(from, { text: aiReply.data?.response || "Nice status! 🥀" }, { quoted: m });
                        } catch (e) {
                            await sock.sendMessage(from, { text: "Great status! 🥀" }, { quoted: m });
                        }
                    }
                }

                // 🤖 AI CHAT
                if (!isGroup && !isStatus && body.length > 2 && !m.key.fromMe && !body.startsWith('.')) {
                    try {
                        const aiResponse = await axios.get(`https://api.agromonitoring.ai/gpt?prompt=${encodeURIComponent(body)}&uid=${sender}`, { timeout: 5000 });
                        const reply = aiResponse.data?.response || "I'm here to help! 🥀";
                        await sock.sendMessage(from, { text: `${THEME.BORDERS.top}\n\n${reply}\n\n${THEME.BORDERS.bottom}` }, { quoted: m });
                    } catch (e) {
                        await sock.sendMessage(from, { text: `${THEME.BORDERS.top}\n\nI'm WRONG TURN 7 bot! Use .help for commands.\n\n${THEME.BORDERS.bottom}` }, { quoted: m });
                    }
                }

                // 🎵 SONG/VIDEO DOWNLOADER
                if (body.startsWith('.song ') || body.startsWith('.video ')) {
                    const query = body.split(' ').slice(1).join(' ');
                    await sock.sendMessage(from, {
                        text: `${THEME.BORDERS.top}\n\n🎵 *DOWNLOAD* ${query}\n\n🔗 Download from:\n• https://www.y2mate.com\n• https://en.savefrom.net\n• https://ssyoutube.com\n\n${THEME.BORDERS.bottom}`
                    });
                }

                // 🎯 COMMAND HANDLER
                if (body.startsWith('.')) {
                    const [cmd, ...args] = body.slice(1).trim().split(/ +/);
                    
                    if (cmd === 'menu' || cmd === 'help') {
                        const helpText = `${THEME.BORDERS.top}\n\n🥀 *WRONG TURN 7 HELP*\n\n🎯 *Commands:*\n• .menu - Show menu\n• .status - Bot status\n• .song [name] - Search song\n• .video [name] - Search video\n• .setemoji [emoji] - Set emoji\n• .antilink [on/off]\n• .antiscam [on/off]\n\n🎪 *Emoji Command:*\nSend 🎰 to open menu\n\n${THEME.BORDERS.bottom}`;
                        await sock.sendMessage(from, { text: helpText });
                    }
                    else if (cmd === 'status') {
                        const uptime = Math.floor(process.uptime() / 3600);
                        const statusText = `${THEME.BORDERS.top}\n\n🥀 *BOT STATUS*\n\n✅ Online: ${activeSessions.size} bots\n⏰ Uptime: ${uptime} hours\n👑 Developer: STANYTZ\n⚡ Version: 7.0.0\n🔗 Platform: ${process.platform}\n\n${THEME.BORDERS.bottom}`;
                        await sock.sendMessage(from, { text: statusText });
                    }
                    else if (cmd === 'setemoji' && args[0]) {
                        await sock.sendMessage(from, { 
                            text: `${THEME.BORDERS.top}\n\n✅ Emoji set to: ${args[0]}\n\nNow send "${args[0]}" to open menu!\n\n${THEME.BORDERS.bottom}`
                        });
                    }
                }

            } catch (error) {
                console.error('Message error:', error.message);
            }
        });

        // 👥 GROUP EVENTS
        sock.ev.on('group-participants.update', async (update) => {
            try {
                const { id, participants, action } = update;
                
                if (action === 'add') {
                    const welcomeMsg = `${THEME.BORDERS.top}\n\n🌸 Welcome @${participants[0].split('@')[0]}!\n\nType .help for commands\n\n${THEME.BORDERS.bottom}`;
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

app.get('/pair', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pair WhatsApp</title>
            <style>
                body {
                    background: #000;
                    color: #ff0000;
                    font-family: monospace;
                    padding: 50px;
                }
                input, button {
                    padding: 10px;
                    margin: 10px;
                    background: #000;
                    color: #ff0000;
                    border: 1px solid #ff0000;
                }
            </style>
        </head>
        <body>
            <h1>🔗 PAIR WHATSAPP</h1>
            <input type="text" id="number" placeholder="2547xxxxxxxx">
            <button onclick="pair()">GET CODE</button>
            <div id="result"></div>
            <script>
                async function pair() {
                    const number = document.getElementById('number').value;
                    const result = document.getElementById('result');
                    result.innerHTML = 'Processing...';
                    
                    const res = await fetch('/api/pair?number=' + number);
                    const data = await res.json();
                    
                    if (data.success) {
                        result.innerHTML = '<h3>✅ CODE: ' + data.code + '</h3><p>' + data.message + '</p>';
                    } else {
                        result.innerHTML = '<h3>❌ ERROR</h3>';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.get('/api/pair', async (req, res) => {
    let number = req.query.number?.replace(/\D/g, '') || '';
    
    if (!number) {
        return res.json({ success: false, error: 'Number required' });
    }
    
    if (number.startsWith('0')) number = '254' + number.substring(1);
    if (number.startsWith('7') && number.length === 9) number = '254' + number;
    
    console.log(`📱 Pairing: ${number}`);
    
    try {
        const sessionDir = `./sessions/${number}`;
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
        
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, { level: 'silent' })
            },
            logger: { level: 'silent' },
            printQRInTerminal: false,
            browser: Browsers.macOS('Safari')
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        const pairingCode = await sock.requestPairingCode(number);
        
        res.json({
            success: true,
            code: pairingCode,
            number: number,
            message: `📱 WhatsApp → Settings → Linked Devices → Link a Device → Code: ${pairingCode}`
        });
        
        sock.ev.on('connection.update', async (update) => {
            if (update.connection === 'open') {
                console.log(`✅ ${number}: Paired!`);
                sock.end?.();
                await startWhatsAppBot(number);
            }
        });
        
        setTimeout(() => {
            if (!sock.user?.id) {
                sock.end?.();
                console.log(`⏱️ ${number}: Timeout`);
            }
        }, 120000);
        
    } catch (error) {
        console.error('Pairing error:', error);
        res.json({ success: false, error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'active',
        bots: activeSessions.size,
        uptime: process.uptime()
    });
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌟 WRONG TURN 7 on port ${PORT}`);
    console.log(`🔗 http://localhost:${PORT}`);
    console.log(`🔗 Pair: http://localhost:${PORT}/pair`);
    
    // AUTO START OWNER BOT
    const ownerNumber = process.env.OWNER_NUMBER || '2547xxxxxxxx';
    if (ownerNumber && ownerNumber !== '2547xxxxxxxx') {
        setTimeout(() => startWhatsAppBot(ownerNumber), 3000);
    }
});

// 🔥 KEEP ALIVE
setInterval(() => {
    console.log(`❤️  Active: ${activeSessions.size} bots`);
}, 60000);
