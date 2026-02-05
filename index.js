require('dotenv').config();
console.log('🚀 WRONG TURN 7 - ULTIMATE EDITION');

// 🔥 Handle Process Signals
process.on('SIGTERM', () => {
    console.log('🔄 Restarting due to SIGTERM');
    setTimeout(() => process.exit(0), 3000);
});

process.on('SIGINT', () => {
    console.log('🔄 Restarting due to SIGINT');
    setTimeout(() => process.exit(0), 3000);
});

// 🌍 Imports
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    getContentType,
    downloadContentFromMessage,
    proto,
    Browsers
} = require('xmd-baileys');

const express = require('express');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { Readable } = require('stream');
const qrcode = require('qrcode-terminal');

// 🔥 Firebase Setup
let db;
try {
    const { initializeApp } = require('firebase/app');
    const { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, increment } = require('firebase/firestore');
    
    const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
    };
    
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    console.log('🔥 Firebase Connected');
} catch (error) {
    console.log('⚠️ Firebase Error:', error.message);
    db = null;
}

const app = express();
app.use(express.json());
app.use(express.static('public'));

// 🎨 Global Variables
const commands = new Map();
const msgCache = new Map();
const activeSessions = new Map();
const statusViewers = new Map();
const userEmojis = new Map();
const typingSessions = new Map();

// 🎯 Theme System
const THEME = {
    FLOWERS: ['🥀', '🌸', '🌺', '🌹', '🌼', '🌷', '💐', '🪷'],
    BORDERS: {
        top: "╭── • 🥀 • ──╮",
        middle: "│ ◦ ",
        bottom: "╰── • 🥀 • ──╯"
    },
    FONTS: {
        bold: (t) => `*${t}*`,
        italic: (t) => `_${t}_`,
        mono: (t) => '```' + t + '```',
        flowerWrap: (t) => `${THEME.FLOWERS[0]} ${t} ${THEME.FLOWERS[0]}`,
        footer: () => `${THEME.BORDERS.bottom}\n\nᴅᴇᴠᴇʟᴏᴘᴇᴅ ʙʏ ꜱᴛᴀɴʏᴛᴢ 🥀`
    }
};

// 🏁 Create Directories
['./sessions', './commands', './public'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * 🎯 Download Media Function
 */
async function downloadMedia(m, type = 'all') {
    try {
        const message = m.message?.[type + 'Message'] || 
                       m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.[type + 'Message'] ||
                       m.message?.viewOnceMessage?.message?.[type + 'Message'];
        
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
 * 🔐 Enhanced Security System
 */
async function armedSecurity(sock, m, settings, isOwner) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase();
    const type = getContentType(m.message);

    if (!from.endsWith('@g.us') || isOwner) return false;

    const explain = async (reason) => {
        await sock.sendMessage(from, { delete: m.key });
        const text = `${THEME.FONTS.flowerWrap("SECURITY ACTION")}\n\n👤 User: @${sender.split('@')[0]}\n⚡ Action: Message Deleted\n📝 Reason: ${reason}\n\n${THEME.FONTS.footer()}`;
        await sock.sendMessage(from, { text, mentions: [sender] });
        return true;
    };

    // 🔥 ANTI-CALL
    if (settings.antiCall && type === 'call') {
        await sock.sendMessage(from, { 
            text: `${THEME.FONTS.flowerWrap("CALL BLOCKED")}\n\nCalls are not allowed in this group!`,
            mentions: [sender]
        });
        return true;
    }

    // 🔥 ANTI-LINK
    if (settings.antiLink) {
        const links = body.match(/(https?:\/\/[^\s]+)|(www\.[^\s]+)|(wa\.me\/[^\s]+)/gi);
        if (links) {
            return await explain("External links are prohibited");
        }
    }

    // 🔥 ANTI-SCAM
    if (settings.antiScam) {
        const scamWords = settings.scamWords || ["bundle", "fixed match", "earn money", "investment", "quick money", "get rich", "pesa haraka"];
        if (scamWords.some(w => body.includes(w))) {
            const metadata = await sock.groupMetadata(from);
            await sock.sendMessage(from, { 
                text: `${THEME.FONTS.flowerWrap("SCAM ALERT")}\n\n@${sender.split('@')[0]} is spreading fraud!\n🚨 Be cautious everyone!`, 
                mentions: metadata.participants.map(v => v.id) 
            });
            await sock.sendMessage(from, { delete: m.key });
            await sock.groupParticipantsUpdate(from, [sender], "remove");
            return true;
        }
    }

    // 🔥 ANTI-PORN
    if (settings.antiPorn) {
        const adultWords = ["porn", "xxx", "sex", "ngono", "🔞", "nsfw", "nude", "naked"];
        if (adultWords.some(w => body.includes(w))) {
            return await explain("Adult content prohibited");
        }
    }

    // 🔥 ANTI-TAG
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
 * 🎪 Generate Menu
 */
async function generateMenu(sock, m, settings) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    
    const menuText = `${THEME.BORDERS.top}

${THEME.FONTS.bold("WRONG TURN 7 🥀")}

${THEME.FONTS.bold("🤖 BOT FEATURES")}
• Auto View Status
• Anti-Delete Message
• Download Songs/Videos
• Download View-Once
• Always Online
• Fake Typing/Recording
• Auto Like Status
• AI Chat Features
• Download Status
• Anti-Call
• Chatbot
• Auto Bio
• Auto React
• Auto Read Messages
• Auto Save Contacts
• Anti WhatsApp Ban Mode

${THEME.FONTS.bold("🎯 COMMANDS")}
• ${settings.prefix}settings - Bot settings
• ${settings.prefix}menu - Show this menu
• ${settings.prefix}status - Check bot status
• ${settings.prefix}help - All commands

${THEME.FONTS.footer()}`;

    await sock.sendMessage(from, { 
        text: menuText,
        contextInfo: {
            isForwarded: true,
            forwardingScore: 999,
            forwardedNewsletterMessageInfo: {
                newsletterJid: process.env.CHANNEL_JID,
                serverMessageId: 1,
                newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
            }
        }
    });
}

/**
 * 🔄 Start WhatsApp Bot
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
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            browser: Browsers.macOS('Safari'),
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000
        });

        // 🔥 Save Credentials
        sock.ev.on('creds.update', saveCreds);
        activeSessions.set(number, sock);

        // 🔄 Connection Handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log(`📱 QR for ${number}:`);
                qrcode.generate(qr, { small: true });
            }
            
            console.log(`🔗 ${number}: ${connection}`);
            
            if (connection === 'open') {
                console.log(`✅ ${number}: Connected!`);
                
                // 🔥 Always Online
                await sock.updateProfileStatus(`WRONG TURN 7 🥀 | ONLINE | ${Math.floor(process.uptime()/3600)}h`);
                await sock.sendPresenceUpdate('available');
                
                // Save to Firebase
                if (db) {
                    try {
                        await setDoc(doc(db, "ACTIVE_USERS", number), {
                            active: true,
                            userId: sock.user?.id,
                            connectedAt: new Date().toISOString(),
                            phoneNumber: number
                        }, { merge: true });
                    } catch (e) {}
                }
                
                // Welcome message
                const welcome = `${THEME.BORDERS.top}\n\n${THEME.FONTS.flowerWrap("WRONG TURN 7")}\n\n${THEME.FONTS.bold("🌟 System: ARMED & OPERATIONAL")}\n${THEME.FONTS.bold("⚡ Version: Ultimate Edition 7.0.0")}\n${THEME.FONTS.bold("👨‍💻 Developer: STANYTZ")}\n${THEME.FONTS.bold("🌍 Status: ONLINE & ACTIVE")}\n\n${THEME.FONTS.footer()}`;
                await sock.sendMessage(sock.user.id, { 
                    text: welcome,
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 999,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: process.env.CHANNEL_JID,
                            serverMessageId: 1,
                            newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
                        }
                    }
                });
                
                // 🔥 Auto Bio
                const bio = `WRONG TURN 7 🥀 | Online | STANYTZ | 🤖 WhatsApp Bot`;
                await sock.updateProfileName('WRONG TURN 7 🥀');
                await sock.updateProfileStatus(bio);
            }
            
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

        // 💬 Message Handler
        sock.ev.on('messages.upsert', async ({ messages }) => {
            try {
                const m = messages[0];
                if (!m.message) return;
                
                const from = m.key.remoteJid;
                const sender = m.key.participant || from;
                const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
                const type = getContentType(m.message);
                const isGroup = from.endsWith('@g.us');
                const isOwner = sender === sock.user.id || m.key.fromMe;
                const isStatus = from === 'status@broadcast';

                // 🔥 Cache Message
                msgCache.set(m.key.id, { ...m, timestamp: Date.now() });

                // 🔥 Get User Settings
                let settings = {
                    prefix: process.env.PREFIX || ".",
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
                    antiMedia: false,
                    autoBio: true,
                    autoStatus: true,
                    autoTyping: true,
                    autoRecording: true,
                    scamWords: ["bundle", "fixed match", "earn money", "investment"],
                    userEmoji: "🎰"
                };
                
                if (db) {
                    try {
                        const settingsDoc = await getDoc(doc(db, "SETTINGS", number));
                        if (settingsDoc.exists()) {
                            settings = { ...settings, ...settingsDoc.data() };
                        }
                    } catch (e) {}
                }

                // 🔥 Auto Typing
                if (settings.autoTyping && !isStatus && !m.key.fromMe) {
                    await sock.sendPresenceUpdate('composing', from).catch(() => {});
                    typingSessions.set(from, setTimeout(() => {
                        sock.sendPresenceUpdate('paused', from).catch(() => {});
                    }, 2000));
                }

                // 🔥 Auto Recording
                if (settings.autoRecording && !isStatus && Math.random() > 0.7) {
                    await sock.sendPresenceUpdate('recording', from).catch(() => {});
                    setTimeout(() => sock.sendPresenceUpdate('paused', from).catch(() => {}), 1000);
                }

                // 🔥 Auto Read Messages
                if (settings.autoRead && !isStatus) {
                    await sock.readMessages([m.key]).catch(() => {});
                }

                // 🔥 Auto React
                if (settings.autoReact && !m.key.fromMe && !isStatus) {
                    const randomFlower = THEME.FLOWERS[Math.floor(Math.random() * THEME.FLOWERS.length)];
                    await sock.sendMessage(from, { react: { text: randomFlower, key: m.key } }).catch(() => {});
                }

                // 🔥 Emoji Command System
                if (!body.startsWith(settings.prefix) && !isStatus) {
                    const userEmoji = settings.userEmoji || process.env.DEFAULT_EMOJI || "🎰";
                    if (body === userEmoji || body.includes(userEmoji)) {
                        await generateMenu(sock, m, settings);
                        return;
                    }
                }

                // 🔥 Force Follow System
                const allowed = await checkFollowStatus(sock, sender, settings);
                if (!allowed && body.startsWith(settings.prefix)) {
                    const forceMsg = `${THEME.BORDERS.top}\n\n${THEME.FONTS.flowerWrap("ACCESS DENIED")}\n\nYou must follow our channel and group to use this bot!\n\n📢 Channel: ${process.env.CHANNEL_JID}\n👥 Group: ${process.env.GROUP_JID}\n\n${THEME.FONTS.footer()}`;
                    await sock.sendMessage(from, { text: forceMsg });
                    return;
                }

                // 🔥 Security Check
                if (isGroup && !isOwner && await armedSecurity(sock, m, settings, isOwner)) {
                    return;
                }

                // 🔥 Anti-Delete
                if (m.message?.protocolMessage?.type === 0 && settings.antiDelete && !m.key.fromMe) {
                    const cached = msgCache.get(m.message.protocolMessage.key.id);
                    if (cached) {
                        await sock.sendMessage(sock.user.id, {
                            text: `${THEME.FONTS.flowerWrap("ANTI-DELETE")}\n\n🚨 Deleted message recovered!\n👤 From: @${sender.split('@')[0]}\n💬 Message was: ${cached.message?.conversation?.substring(0, 50) || 'Media'}`, 
                            mentions: [sender]
                        }).catch(() => {});
                        await sock.copyNForward(sock.user.id, cached, false).catch(() => {});
                    }
                }

                // 🔥 Anti View-Once
                if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && settings.antiViewOnce) {
                    try {
                        const media = await downloadMedia(m, 'image') || await downloadMedia(m, 'video');
                        if (media) {
                            await sock.sendMessage(sock.user.id, {
                                text: `${THEME.FONTS.flowerWrap("VIEW-ONCE CAPTURED")}\n\nFrom: @${sender.split('@')[0]}`
                            }).catch(() => {});
                            
                            if (media.toString('hex', 0, 4) === 'ffd8ff') {
                                await sock.sendMessage(sock.user.id, { image: media }).catch(() => {});
                            } else {
                                await sock.sendMessage(sock.user.id, { video: media }).catch(() => {});
                            }
                        }
                    } catch (e) {}
                }

                // 🌟 Status Features
                if (isStatus && settings.autoStatus) {
                    await sock.readMessages([m.key]).catch(() => {});
                    
                    // Auto View Status
                    statusViewers.set(number, (statusViewers.get(number) || 0) + 1);
                    
                    // Auto Like Status
                    const likeEmojis = ['❤️', '👍', '🔥', '🥰', '🎉'];
                    const randomLike = likeEmojis[Math.floor(Math.random() * likeEmojis.length)];
                    await sock.sendMessage(from, { react: { text: randomLike, key: m.key } }, { statusJidList: [sender] }).catch(() => {});
                    
                    // Auto Reply to Status
                    if (settings.autoAI) {
                        try {
                            const aiReply = await axios.get(`https://text.pollinations.ai/Reply naturally to this status as a friend in Swahili or English based on the content: "${body.substring(0, 100)}"`, { timeout: 5000 });
                            await sock.sendMessage(from, { text: aiReply.data }, { quoted: m }).catch(() => {});
                        } catch (e) {}
                    }
                    
                    // Download Status on Command
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
                }

                // 🤖 AI Chat Features
                if (!isGroup && !isStatus && settings.autoAI && body.length > 2 && !m.key.fromMe && !body.startsWith(settings.prefix)) {
                    try {
                        const lang = detectLanguage(body);
                        const aiPrompt = `You are WRONG TURN 7 WhatsApp Bot. Respond helpfully and briefly in ${lang} to: "${body.substring(0, 200)}"`;
                        const response = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`, { timeout: 8000 });
                        const aiResponse = response.data;
                        
                        const formattedResponse = `${THEME.BORDERS.top}\n\n${THEME.FONTS.flowerWrap("WRONG TURN 7 AI")}\n\n${aiResponse}\n\n${THEME.FONTS.footer()}`;
                        await sock.sendMessage(from, { text: formattedResponse }, { quoted: m }).catch(() => {});
                    } catch (e) {}
                }

                // 🎵 Song/Video Downloader
                if (body.startsWith(`${settings.prefix}song `) || body.startsWith(`${settings.prefix}video `)) {
                    const query = body.split(' ').slice(1).join(' ');
                    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                    
                    await sock.sendMessage(from, {
                        text: `${THEME.BORDERS.top}\n\n${THEME.FONTS.flowerWrap("DOWNLOAD")}\n\n🎵 Searching: ${query}\n\n🔗 Download from:\n1. https://www.y2mate.com\n2. https://en.savefrom.net\n3. https://ssyoutube.com\n\n${THEME.FONTS.footer()}`
                    }).catch(() => {});
                }

                // 🎯 Command Handler
                if (body.startsWith(settings.prefix)) {
                    const [cmd, ...args] = body.slice(settings.prefix.length).trim().split(/ +/);
                    const command = commands.get(cmd.toLowerCase());
                    
                    if (command) {
                        await command.execute(m, sock, args, db, THEME);
                    } else if (cmd === 'menu') {
                        await generateMenu(sock, m, settings);
                    } else if (cmd === 'help') {
                        await showHelp(sock, from, settings);
                    } else if (cmd === 'settings') {
                        await showSettings(sock, from, settings, number);
                    }
                }

                // 📊 Log Activity
                if (db && isGroup) {
                    try {
                        await setDoc(doc(db, "ACTIVITY", from), {
                            [sender]: Date.now(),
                            lastMessage: body.substring(0, 50),
                            messageCount: increment(1)
                        }, { merge: true });
                    } catch (e) {}
                }

            } catch (error) {
                console.error('Message processing error:', error.message);
            }
        });

        // 👥 Group Participants Update
        sock.ev.on('group-participants.update', async (update) => {
            try {
                const { id, participants, action } = update;
                
                if (action === 'add') {
                    // Welcome Message
                    const welcomeMsg = `${THEME.BORDERS.top}\n\n${THEME.FONTS.flowerWrap("WELCOME")}\n\n🌸 Welcome @${participants[0].split('@')[0]} to the group!\n\nType .help to see available commands\n\n${THEME.FONTS.footer()}`;
                    await sock.sendMessage(id, { text: welcomeMsg, mentions: participants }).catch(() => {});
                } else if (action === 'remove') {
                    // Goodbye Message
                    const goodbyeMsg = `${THEME.FLOWERS[0]} Goodbye @${participants[0].split('@')[0]}! ${THEME.FLOWERS[0]}\nHope to see you again!`;
                    await sock.sendMessage(id, { text: goodbyeMsg, mentions: participants }).catch(() => {});
                }
            } catch (e) {}
        });

        console.log(`🌟 Bot started: ${number}`);
        return sock;

    } catch (error) {
        console.error(`❌ Failed to start bot:`, error.message);
        activeSessions.delete(number);
        return null;
    }
}

/**
 * 🔍 Check Follow Status
 */
async function checkFollowStatus(sock, userJid, settings) {
    if (!settings.forceFollow) return true;
    
    try {
        // Check group membership
        const groupMembers = await sock.groupMetadata(process.env.GROUP_JID);
        const inGroup = groupMembers.participants.some(p => p.id === userJid);
        
        // Check channel follow (simulated)
        const channelFollow = true; // Implement actual check
        
        return inGroup && channelFollow;
    } catch (e) {
        return false;
    }
}

/**
 * 🌐 Language Detection
 */
function detectLanguage(text) {
    const swahiliWords = ['mambo', 'sasa', 'nzuri', 'asante', 'habari', 'poa'];
    const hasSwahili = swahiliWords.some(word => text.toLowerCase().includes(word));
    return hasSwahili ? 'Swahili' : 'English';
}

/**
 * 📋 Show Help
 */
async function showHelp(sock, from, settings) {
    const helpText = `${THEME.BORDERS.top}

${THEME.FONTS.bold("WRONG TURN 7 - HELP MENU 🥀")}

${THEME.FONTS.bold("📱 BASIC COMMANDS")}
• ${settings.prefix}menu - Show bot menu
• ${settings.prefix}help - This help message
• ${settings.prefix}status - Bot status
• ${settings.prefix}settings - Configure bot

${THEME.FONTS.bold("🎵 MEDIA COMMANDS")}
• ${settings.prefix}song [name] - Search songs
• ${settings.prefix}video [name] - Search videos
• ${settings.prefix}sticker - Make sticker

${THEME.FONTS.bold("🛡️ SECURITY COMMANDS")}
• ${settings.prefix}antilink [on/off]
• ${settings.prefix}antiscam [on/off]
• ${settings.prefix}antiporn [on/off]
• ${settings.prefix}antitag [on/off]
• ${settings.prefix}antimedia [on/off]

${THEME.FONTS.bold("⚙️ SETTINGS COMMANDS")}
• ${settings.prefix}setemoji [emoji] - Set command emoji
• ${settings.prefix}setprefix [prefix] - Change prefix
• ${settings.prefix}autotype [on/off]
• ${settings.prefix}autoreact [on/off]

${THEME.FONTS.bold("🎪 EMOJI COMMAND")}
Send "${settings.userEmoji || '🎰'}" to open menu

${THEME.FONTS.footer()}`;

    await sock.sendMessage(from, { text: helpText });
}

/**
 * ⚙️ Show Settings
 */
async function showSettings(sock, from, settings, number) {
    const statusIcon = (val) => val ? '✅ ON' : '❌ OFF';
    
    const settingsText = `${THEME.BORDERS.top}

${THEME.FONTS.bold("WRONG TURN 7 - SETTINGS 🥀")}

${THEME.FONTS.bold("🔧 BOT SETTINGS")}
• Prefix: ${settings.prefix}
• Command Emoji: ${settings.userEmoji}
• Mode: ${settings.mode}

${THEME.FONTS.bold("🤖 AUTO FEATURES")}
• Auto AI: ${statusIcon(settings.autoAI)}
• Auto React: ${statusIcon(settings.autoReact)}
• Auto Read: ${statusIcon(settings.autoRead)}
• Auto Typing: ${statusIcon(settings.autoTyping)}
• Auto Recording: ${statusIcon(settings.autoRecording)}
• Auto Status: ${statusIcon(settings.autoStatus)}

${THEME.FONTS.bold("🛡️ SECURITY FEATURES")}
• Anti Link: ${statusIcon(settings.antiLink)}
• Anti Scam: ${statusIcon(settings.antiScam)}
• Anti Porn: ${statusIcon(settings.antiPorn)}
• Anti Tag: ${statusIcon(settings.antiTag)}
• Anti Call: ${statusIcon(settings.antiCall)}
• Anti Media: ${statusIcon(settings.antiMedia)}
• Anti Delete: ${statusIcon(settings.antiDelete)}
• Anti View-Once: ${statusIcon(settings.antiViewOnce)}

${THEME.FONTS.bold("⚡ QUICK COMMANDS")}
• ${settings.prefix}setemoji [emoji]
• ${settings.prefix}setprefix [prefix]
• ${settings.prefix}antilink [on/off]

${THEME.FONTS.footer()}`;

    await sock.sendMessage(from, { text: settingsText });
}

// 🌐 Web Dashboard
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

// 🔗 Pairing Page
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
                    font-family: 'Courier New', monospace;
                    padding: 50px;
                    text-align: center;
                }
                input, button {
                    padding: 15px;
                    margin: 10px;
                    border: 2px solid #ff0000;
                    background: #000;
                    color: #ff0000;
                    font-size: 1.2rem;
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
            <button onclick="pair()">GET PAIRING CODE</button>
            <div id="result"></div>
            <script>
                async function pair() {
                    const number = document.getElementById('number').value;
                    const result = document.getElementById('result');
                    result.innerHTML = 'Processing...';
                    
                    const response = await fetch('/api/pair?number=' + number);
                    const data = await response.json();
                    
                    if (data.success) {
                        result.innerHTML = '<h3>✅ PAIRING CODE: ' + data.code + '</h3><p>' + data.message + '</p>';
                    } else {
                        result.innerHTML = '<h3>❌ ERROR: ' + data.error + '</h3>';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// 🔐 Pairing API
app.get('/api/pair', async (req, res) => {
    let number = req.query.number.replace(/\D/g, '');
    
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
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.macOS('Safari')
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        const pairingCode = await sock.requestPairingCode(number);
        
        res.json({
            success: true,
            code: pairingCode,
            number: number,
            message: `📱 Go to WhatsApp → Settings → Linked Devices → Link a Device\n\n🔢 Enter this code: ${pairingCode}`
        });
        
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
        
        setTimeout(() => {
            if (!sock.user?.id) {
                sock.end?.();
                console.log(`⏱️ ${number}: Pairing timeout`);
            }
        }, 120000);
        
    } catch (error) {
        console.error('Pairing error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            solution: "Use international format: 254712345678"
        });
    }
});

// 🏥 Health Check
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

// 🚀 Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌟 WRONG TURN 7 running on port ${PORT}`);
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
    
    // Auto-start owner bot
    if (process.env.OWNER_NUMBER) {
        setTimeout(() => startWhatsAppBot(process.env.OWNER_NUMBER), 3000);
    }
});

// 🔄 Keep Alive
setInterval(() => {
    console.log(`❤️  Heartbeat - ${activeSessions.size} active bots`);
    
    // Update all active bots status
    activeSessions.forEach(async (sock, number) => {
        if (sock && sock.user) {
            try {
                await sock.updateProfileStatus(`WRONG TURN 7 🥀 | ${Math.floor(process.uptime()/3600)}h online`);
                await sock.sendPresenceUpdate('available');
            } catch (e) {}
        }
    });
}, 30000);
