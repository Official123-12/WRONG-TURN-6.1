// 🌟 WRONG TURN 6 - COMPLETE WHATSAPP BOT WITH ALL FEATURES
// 🥀 Using xmd-baileys for maximum stability
// 📅 Version: 7.0.0 - Ultimate Edition

require('dotenv').config();
console.log('🚀 Starting WRONG TURN 7 - Ultimate Edition...');

// 🔥 FIX SIGTERM ERROR
process.removeAllListeners('SIGTERM');
process.removeAllListeners('SIGINT');

process.on('SIGTERM', () => {
    console.log('🔄 Bot restarting due to SIGTERM...');
    setTimeout(() => {
        console.log('✅ Bot restarted successfully');
    }, 3000);
});

process.on('SIGINT', () => {
    console.log('🔄 Bot restarting due to SIGINT...');
    setTimeout(() => {
        console.log('✅ Bot restarted successfully');
    }, 3000);
});

// 🌍 MAIN IMPORTS
const { 
    default: makeWASocket, 
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    getContentType,
    downloadContentFromMessage,
    proto
} = require('xmd-baileys');

const express = require('express');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { Readable } = require('stream');

// 🔥 FIREBASE SETUP
let db;
try {
    const { initializeApp } = require('firebase/app');
    const { getFirestore, doc, getDoc, setDoc, collection, getDocs } = require('firebase/firestore');
    
    const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || "stanybots.firebaseapp.com",
        projectId: process.env.FIREBASE_PROJECT_ID || "stanybots",
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "stanybots.firebasestorage.app",
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "381983533939",
        appId: process.env.FIREBASE_APP_ID || "1:381983533939:web:e6cc9445137c74b99df306"
    };
    
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    console.log('🔥 Firebase connected');
} catch (error) {
    console.log('⚠️ Firebase error:', error.message);
    db = null;
}

const app = express();
app.use(express.json());
app.use(express.static('public'));

// 📊 GLOBAL VARIABLES
const commands = new Map();
const msgCache = new Map();
const activeSessions = new Map();
const statusViewers = new Map();

// 🎨 BEAUTIFUL THEME
const THEME = {
    FLOWERS: ['🥀', '🌸', '🌺', '🌹', '🌼', '🌷', '💐', '🪷'],
    FONTS: {
        bold: (t) => `*${t}*`,
        italic: (t) => `_${t}_`,
        mono: (t) => '```' + t + '```',
        flowerWrap: (t) => `${THEME.FLOWERS[0]} ${t} ${THEME.FLOWERS[0]}`,
        footer: "───────────────\n_ᴅᴇᴠᴇʟᴏᴘᴇᴅ ʙʏ ꜱᴛᴀɴʏᴛᴢ 🥀_"
    }
};

// 🏁 CREATE SESSIONS DIRECTORY
if (!fs.existsSync('./sessions')) {
    fs.mkdirSync('./sessions', { recursive: true });
}

/**
 * 🎯 DOWNLOAD MEDIA FUNCTION
 */
async function downloadMedia(m, type = 'all') {
    try {
        const buffer = await downloadContentFromMessage(
            m.message?.[type + 'Message'] || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.[type + 'Message'],
            type
        );
        
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
 * 🔐 ENHANCED SECURITY SYSTEM
 */
async function armedSecurity(sock, m, settings, isOwner) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase();
    const type = getContentType(m.message);

    if (!from.endsWith('@g.us') || isOwner) return false;

    const explain = async (reason) => {
        await sock.sendMessage(from, { delete: m.key });
        const text = `${THEME.FONTS.flowerWrap("SECURITY ACTION")}\n\n👤 User: @${sender.split('@')[0]}\n⚡ Action: Message Deleted\n📝 Reason: ${reason}\n\n${THEME.FONTS.footer}`;
        await sock.sendMessage(from, { text, mentions: [sender] });
        return true;
    };

    // 🔥 ANTI-CALL
    if (settings.antiCall && type === 'call') {
        await sock.sendMessage(from, { text: `${THEME.FLOWERS[0]} *CALL BLOCKED* ${THEME.FLOWERS[0]}\n\nCalls are not allowed in this group!` });
        return true;
    }

    // 🔥 ANTI-LINK
    if (settings.antiLink && body.match(/https?:\/\/[^\s]+/gi)) {
        return await explain("External links are prohibited");
    }

    // 🔥 ANTI-BOT
    if (settings.antiBot && m.key.id.startsWith('BAE5')) {
        return await explain("Bot traffic detected");
    }

    // 🔥 ANTI-SCAM
    const scamWords = ["bundle", "fixed match", "earn money", "investment", "quick money", "get rich", "pesa haraka"];
    if (settings.antiScam && scamWords.some(w => body.includes(w))) {
        const metadata = await sock.groupMetadata(from);
        await sock.sendMessage(from, { 
            text: `${THEME.FLOWERS[0]} *SCAM ALERT* ${THEME.FLOWERS[0]}\n\n@${sender.split('@')[0]} is spreading fraud!\n🚨 Be cautious everyone!`, 
            mentions: metadata.participants.map(v => v.id) 
        });
        await sock.sendMessage(from, { delete: m.key });
        await sock.groupParticipantsUpdate(from, [sender], "remove");
        return true;
    }

    // 🔥 ANTI-PORN
    const adultWords = ["porn", "xxx", "sex", "ngono", "🔞", "nsfw"];
    if (settings.antiPorn && adultWords.some(w => body.includes(w))) {
        return await explain("Adult content prohibited");
    }

    // 🔥 ANTI-TAG (excessive mentioning)
    if (settings.antiTag && body.includes('@')) {
        const mentions = body.split('@').length - 1;
        if (mentions > 5) {
            return await explain("Excessive tagging detected");
        }
    }

    // 🔥 ANTI-MEDIA
    if (settings.antiMedia && ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'].includes(type)) {
        return await explain("Media sharing disabled");
    }

    return false;
}

/**
 * 🚀 START WHATSAPP BOT
 */
async function startWhatsAppBot(number) {
    if (activeSessions.has(number)) {
        console.log(`✅ Bot already active for: ${number}`);
        return activeSessions.get(number);
    }
    
    console.log(`🚀 Starting bot for: ${number}`);
    
    try {
        const sessionDir = `./sessions/${number}`;
        
        // 🎯 xmd-baileys SOCKET SYSTEM
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
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
            const { connection, lastDisconnect } = update;
            
            console.log(`🔗 ${number}: ${connection}`);
            
            if (connection === 'open') {
                console.log(`✅ ${number}: Connected to WhatsApp!`);
                
                // 🔥 ALWAYS ONLINE
                await sock.updateProfileStatus(`WRONG TURN 7 🥀 | ONLINE | ${Math.floor(process.uptime()/3600)}h`);
                await sock.sendPresenceUpdate('available');
                
                // Save to Firebase
                if (db) {
                    try {
                        await setDoc(doc(db, "ACTIVE_USERS", number), {
                            active: true,
                            userId: sock.user?.id,
                            connectedAt: new Date().toISOString()
                        });
                    } catch (e) {}
                }
                
                // Welcome message to owner
                const welcome = `${THEME.FONTS.flowerWrap("WRONG TURN 7")}\n\n🌟 System: ARMED & OPERATIONAL\n⚡ Version: Ultimate Edition\n👨‍💻 Developer: STANYTZ\n🌍 Status: ONLINE & ACTIVE\n\n${THEME.FONTS.footer}`;
                await sock.sendMessage(sock.user.id, { text: welcome });
                
                // 🔥 AUTO BIO
                if (settings?.autoBio) {
                    const bio = `WRONG TURN 7 🥀 | Online | STANYTZ | 🤖 WhatsApp Bot`;
                    await sock.updateProfileName('WRONG TURN 7 🥀');
                    await sock.updateProfileStatus(bio);
                }
            }
            
            // 🔄 AUTO-RECONNECT
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`🔒 ${number}: Disconnected. Reconnect: ${shouldReconnect}`);
                
                activeSessions.delete(number);
                
                if (db) {
                    try {
                        await setDoc(doc(db, "ACTIVE_USERS", number), {
                            active: false,
                            disconnectedAt: new Date().toISOString()
                        }, { merge: true });
                    } catch (e) {}
                }
                
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
                const isGroup = from.endsWith('@g.us');
                const isOwner = sender.startsWith(number) || m.key.fromMe;
                const isStatus = from === 'status@broadcast';

                // 🔥 CACHE MESSAGE FOR ANTI-DELETE
                msgCache.set(m.key.id, { ...m, timestamp: Date.now() });

                // 🔥 GET USER SETTINGS
                let settings = {
                    prefix: ".",
                    mode: "public",
                    autoAI: true,
                    autoReact: true,
                    autoRead: true,
                    autoSaveContacts: true,
                    antiDelete: true,
                    antiViewOnce: true,
                    antiLink: true,
                    antiScam: true,
                    antiPorn: true,
                    antiTag: true,
                    antiCall: true,
                    autoBio: true,
                    autoStatus: true
                };
                
                if (db) {
                    try {
                        const settingsDoc = await getDoc(doc(db, "SETTINGS", number));
                        if (settingsDoc.exists()) {
                            settings = { ...settings, ...settingsDoc.data() };
                        }
                    } catch (e) {}
                }

                // 🔥 AUTO READ MESSAGES
                if (settings.autoRead && !isStatus) {
                    await sock.readMessages([m.key]).catch(() => {});
                }

                // 🔥 AUTO SAVE CONTACTS
                if (settings.autoSaveContacts && !isGroup && !isOwner) {
                    await sock.updateBlockStatus(sender, 'unblock').catch(() => {});
                }

                // 🔥 AUTO REACT
                if (settings.autoReact && !m.key.fromMe && !isStatus) {
                    const randomFlower = THEME.FLOWERS[Math.floor(Math.random() * THEME.FLOWERS.length)];
                    await sock.sendMessage(from, { react: { text: randomFlower, key: m.key } }).catch(() => {});
                }

                // 🔥 FAKE TYPING / RECORDING
                if (Math.random() > 0.7) {
                    await sock.sendPresenceUpdate('composing', from).catch(() => {});
                    setTimeout(() => sock.sendPresenceUpdate('recording', from).catch(() => {}), 1000);
                }

                // 🔥 SECURITY CHECK
                if (isGroup && !isOwner && await armedSecurity(sock, m, settings, isOwner)) {
                    return;
                }

                // 🔥 ANTI-DELETE
                if (m.message?.protocolMessage?.type === 0 && settings.antiDelete && !m.key.fromMe) {
                    const cached = msgCache.get(m.message.protocolMessage.key.id);
                    if (cached) {
                        await sock.sendMessage(sock.user.id, {
                            text: `${THEME.FLOWERS[0]} *ANTI-DELETE* ${THEME.FLOWERS[0]}\n\n🚨 Deleted message recovered!\n👤 From: @${sender.split('@')[0]}\n💬 Message was: ${cached.message?.conversation?.substring(0, 50) || 'Media'}`, 
                            mentions: [sender]
                        }).catch(() => {});
                        await sock.copyNForward(sock.user.id, cached, false).catch(() => {});
                    }
                }

                // 🔥 DOWNLOAD VIEW-ONCE PHOTO/VIDEO
                if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && settings.antiViewOnce) {
                    try {
                        const media = await downloadMedia(m, 'image') || await downloadMedia(m, 'video');
                        if (media) {
                            await sock.sendMessage(sock.user.id, {
                                text: `${THEME.FLOWERS[0]} *VIEW-ONCE CAPTURED* ${THEME.FLOWERS[0]}\n\nFrom: @${sender.split('@')[0]}`
                            }).catch(() => {});
                            
                            if (media.toString('hex', 0, 4) === 'ffd8ff') { // JPEG
                                await sock.sendMessage(sock.user.id, { image: media }).catch(() => {});
                            } else {
                                await sock.sendMessage(sock.user.id, { video: media }).catch(() => {});
                            }
                        }
                    } catch (e) {}
                }

                // 🌟 STATUS FEATURES
                if (isStatus && settings.autoStatus) {
                    await sock.readMessages([m.key]).catch(() => {});
                    
                    // 🔥 AUTO VIEW STATUS
                    statusViewers.set(number, (statusViewers.get(number) || 0) + 1);
                    
                    // 🔥 AUTO LIKE STATUS
                    await sock.sendMessage(from, { react: { text: '❤️', key: m.key } }, { statusJidList: [sender] }).catch(() => {});
                    
                    // 🔥 DOWNLOAD STATUS
                    if (body.includes('.download') || body.includes('download status')) {
                        try {
                            const media = await downloadMedia(m, 'image') || await downloadMedia(m, 'video');
                            if (media) {
                                await sock.sendMessage(sock.user.id, {
                                    [media.toString('hex', 0, 4) === 'ffd8ff' ? 'image' : 'video']: media,
                                    caption: `📥 Status downloaded from ${sender.split('@')[0]}`
                                }).catch(() => {});
                            }
                        } catch (e) {}
                    }
                    
                    // 🔥 AUTO REPLY TO STATUS
                    try {
                        const aiReply = await axios.get(`https://text.pollinations.ai/Reply naturally to this status as a friend: "${body.substring(0, 100)}"`, { timeout: 5000 });
                        await sock.sendMessage(from, { text: aiReply.data }, { quoted: m }).catch(() => {});
                    } catch (e) {}
                }

                // 🤖 AI CHAT FEATURES
                if (!isGroup && !isStatus && settings.autoAI && body.length > 2 && !m.key.fromMe) {
                    // 🔥 ChatGPT-LIKE RESPONSES
                    try {
                        let aiResponse;
                        
                        // Check for song/video download request
                        if (body.includes('download') && (body.includes('song') || body.includes('video') || body.includes('music'))) {
                            const query = body.replace(/download|song|video|music/gi, '').trim();
                            aiResponse = `🎵 To download "${query}", use:\n\n🔗 YouTube: https://www.y2mate.com\n🔗 Spotify: Use SpotDL\n🔗 General: https://en.savefrom.net\n\nOr send me the direct link!`;
                        }
                        // Regular AI chat
                        else {
                            const aiPrompt = `You are WRONG TURN 7 WhatsApp Bot. Respond helpfully and briefly in the user's language to: "${body.substring(0, 200)}"`;
                            const response = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`, { timeout: 8000 });
                            aiResponse = response.data;
                        }
                        
                        const formattedResponse = `${THEME.FONTS.flowerWrap("WRONG TURN 7")}\n\n${aiResponse}\n\n${THEME.FONTS.footer}`;
                        await sock.sendMessage(from, { text: formattedResponse }, { quoted: m }).catch(() => {});
                    } catch (e) {}
                }

                // 🎵 SONG/VIDEO DOWNLOADER
                if (body.startsWith(`${settings.prefix}song `) || body.startsWith(`${settings.prefix}video `)) {
                    const query = body.split(' ').slice(1).join(' ');
                    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                    
                    await sock.sendMessage(from, {
                        text: `${THEME.FLOWERS[0]} *DOWNLOAD* ${THEME.FLOWERS[0]}\n\n🎵 Searching: ${query}\n\n🔗 Download from:\n1. https://www.y2mate.com\n2. https://en.savefrom.net\n3. https://ssyoutube.com\n\nOr send me the direct YouTube link!`
                    }).catch(() => {});
                }

                // 🎯 COMMAND HANDLER
                if (body.startsWith(settings.prefix)) {
                    const [cmd, ...args] = body.slice(settings.prefix.length).trim().split(/ +/);
                    const command = commands.get(cmd.toLowerCase());
                    
                    if (command) {
                        await command.execute(m, sock, args, db, THEME);
                    }
                }

                // 📊 LOG ACTIVITY
                if (db && isGroup) {
                    try {
                        await setDoc(doc(db, "ACTIVITY", from), {
                            [sender]: Date.now(),
                            lastMessage: body.substring(0, 50),
                            messageCount: (await getDoc(doc(db, "ACTIVITY", from))).data()?.messageCount + 1 || 1
                        }, { merge: true });
                    } catch (e) {}
                }

            } catch (error) {
                console.error('Message processing error:', error.message);
            }
        });

        // 👥 GROUP PARTICIPANTS UPDATE
        sock.ev.on('group-participants.update', async (update) => {
            try {
                const { id, participants, action } = update;
                
                if (action === 'add') {
                    // 🔥 WELCOME MESSAGE
                    const welcomeMsg = `${THEME.FONTS.flowerWrap("WELCOME")}\n\n🌸 Welcome @${participants[0].split('@')[0]} to the group!\n\nType ${settings.prefix}help to see available commands\n\n${THEME.FONTS.footer}`;
                    await sock.sendMessage(id, { text: welcomeMsg, mentions: participants }).catch(() => {});
                } else if (action === 'remove') {
                    // 🔥 GOODBYE MESSAGE
                    const goodbyeMsg = `${THEME.FLOWERS[0]} Goodbye @${participants[0].split('@')[0]}! ${THEME.FLOWERS[0]}\nHope to see you again!`;
                    await sock.sendMessage(id, { text: goodbyeMsg, mentions: participants }).catch(() => {});
                }
            } catch (e) {}
        });

        console.log(`🌟 Bot started successfully for: ${number}`);
        return sock;

    } catch (error) {
        console.error(`❌ Failed to start bot for ${number}:`, error.message);
        activeSessions.delete(number);
        return null;
    }
}

// 🌐 WEB DASHBOARD
app.get('/', (req, res) => {
    const uptime = Math.floor(process.uptime() / 3600);
    const memory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WRONG TURN 7 - ULTIMATE BOT</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: #000;
                    color: #ff0000;
                    font-family: 'Courier New', monospace;
                    text-align: center;
                    padding: 50px 20px;
                    background-image: url('https://www.transparenttextures.com/patterns/black-paper.png');
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 40px;
                    border: 2px solid #ff0000;
                    border-radius: 20px;
                    background: rgba(0,0,0,0.9);
                    box-shadow: 0 0 50px rgba(255,0,0,0.3);
                }
                h1 {
                    font-size: 3rem;
                    margin-bottom: 20px;
                    letter-spacing: 5px;
                    text-shadow: 0 0 10px #ff0000;
                }
                .features {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 15px;
                    margin: 30px 0;
                }
                .feature {
                    padding: 15px;
                    background: rgba(255,0,0,0.1);
                    border-radius: 10px;
                    border: 1px solid #ff0000;
                    text-align: left;
                }
                .btn {
                    display: inline-block;
                    margin: 20px 10px;
                    padding: 15px 30px;
                    background: #ff0000;
                    color: #000;
                    text-decoration: none;
                    border-radius: 10px;
                    font-weight: bold;
                    font-size: 1.2rem;
                    transition: 0.3s;
                }
                .btn:hover {
                    background: #ff3333;
                    box-shadow: 0 0 20px #ff0000;
                    transform: translateY(-3px);
                }
                .stats {
                    margin: 30px 0;
                    padding: 20px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 10px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>WRONG TURN 7 🥀</h1>
                <div class="stats">
                    <p>🔥 ACTIVE BOTS: ${activeSessions.size}</p>
                    <p>⏰ UPTIME: ${uptime} HOURS</p>
                    <p>💾 MEMORY: ${memory} MB</p>
                    <p>👨‍💻 DEVELOPER: STANYTZ</p>
                </div>
                
                <div class="features">
                    <div class="feature">✅ Auto View Status</div>
                    <div class="feature">✅ Anti-Delete Message</div>
                    <div class="feature">✅ Download Songs/Videos</div>
                    <div class="feature">✅ Download View-Once</div>
                    <div class="feature">✅ Always Online</div>
                    <div class="feature">✅ Fake Typing/Recording</div>
                    <div class="feature">✅ Auto Like Status</div>
                    <div class="feature">✅ AI Chat Features</div>
                    <div class="feature">✅ Download Status</div>
                    <div class="feature">✅ Anti-Call</div>
                    <div class="feature">✅ Chatbot</div>
                    <div class="feature">✅ Auto Bio</div>
                    <div class="feature">✅ Auto React</div>
                    <div class="feature">✅ Auto Read Messages</div>
                    <div class="feature">✅ Auto Save Contacts</div>
                    <div class="feature">✅ Anti WhatsApp Ban Mode</div>
                </div>
                
                <a href="/pair" class="btn">🔗 PAIR WHATSAPP</a>
                <a href="https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y" target="_blank" class="btn" style="background:#333;color:#fff;">📱 SUPPORT GROUP</a>
            </div>
        </body>
        </html>
    `);
});

// 🔗 PAIRING PAGE
app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/pair.html'));
});

// 🔐 PAIRING API
app.get('/api/pair', async (req, res) => {
    let number = req.query.number.replace(/\D/g, '');
    
    if (number.startsWith('0')) number = '254' + number.substring(1);
    if (number.startsWith('7') && number.length === 9) number = '254' + number;
    
    console.log(`📱 Pairing request: ${number}`);
    
    try {
        const sessionDir = `./sessions/${number}`;
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
        
        // 🎯 xmd-baileys PAIRING
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        // Get pairing code
        const pairingCode = await sock.requestPairingCode(number);
        
        res.json({
            success: true,
            code: pairingCode,
            number: number,
            message: `📱 Go to WhatsApp → Settings → Linked Devices → Link a Device\n\n🔢 Enter this code: ${pairingCode}`
        });
        
        // Handle connection
        sock.ev.on('connection.update', async (update) => {
            if (update.connection === 'open') {
                console.log(`✅ ${number}: Paired successfully!`);
                
                if (db) {
                    try {
                        await setDoc(doc(db, "PAIRED_DEVICES", number), {
                            pairedAt: new Date().toISOString(),
                            deviceInfo: sock.user?.id
                        });
                    } catch (e) {}
                }
                
                sock.end?.();
                await startWhatsAppBot(number);
            }
        });
        
        // Timeout
        setTimeout(() => {
            if (!sock.user?.id) {
                sock.end?.();
                console.log(`⏱️ ${number}: Pairing timeout`);
            }
        }, 120000);
        
    } catch (error) {
        console.error('Pairing error:', error);
        res.status(500).json({
            error: error.message,
            solution: "Use international format: 254712345678"
        });
    }
});

// 🏥 HEALTH CHECK
app.get('/health', (req, res) => {
    res.json({
        status: 'armed',
        version: '7.0.0',
        activeBots: activeSessions.size,
        uptime: process.uptime(),
        platform: process.env.RAILWAY_ENVIRONMENT ? 'railway' : 
                 process.env.RENDER ? 'render' : 
                 process.env.HEROKU_APP_NAME ? 'heroku' : 'local'
    });
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌟 WRONG TURN 7 ULTIMATE running on port ${PORT}`);
    console.log(`🔗 Dashboard: http://localhost:${PORT}`);
    console.log(`🔗 Pairing: http://localhost:${PORT}/pair`);
    
    // Load commands
    const commandsDir = path.join(__dirname, 'commands');
    if (fs.existsSync(commandsDir)) {
        fs.readdirSync(commandsDir).forEach(folder => {
            const folderPath = path.join(commandsDir, folder);
            if (fs.lstatSync(folderPath).isDirectory()) {
                fs.readdirSync(folderPath).filter(f => f.endsWith('.js')).forEach(file => {
                    try {
                        const cmd = require(path.join(folderPath, file));
                        if (cmd && cmd.name) {
                            commands.set(cmd.name.toLowerCase(), cmd);
                            console.log(`✅ Loaded command: ${cmd.name}`);
                        }
                    } catch (e) {
                        console.log(`❌ Failed to load ${file}:`, e.message);
                    }
                });
            }
        });
    }
    
    console.log(`📦 ${commands.size} commands loaded`);
});

// 🔄 KEEP ALIVE
setInterval(() => {
    console.log(`❤️  Heartbeat - ${activeSessions.size} active bots`);
}, 60000);
