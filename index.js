// 🌟 WRONG TURN 7 - ULTIMATE WHATSAPP BOT
// 🥀 xmd-baileys | Complete All Features
// 📅 Version: 7.0.0 - Ultimate Edition

require('dotenv').config();
console.log('🚀 WRONG TURN 7 STARTING...');

// 🔥 HANDLE PROCESS
process.on('SIGTERM', () => {
    console.log('🔄 Restarting...');
    setTimeout(() => process.exit(0), 3000);
});

process.on('SIGINT', () => {
    console.log('🔄 Restarting...');
    setTimeout(() => process.exit(0), 3000);
});

// 🌍 IMPORTS
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    getContentType,
    downloadContentFromMessage,
    Browsers,
    proto
} = require('xmd-baileys');

const express = require('express');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { Readable } = require('stream');

// 🔥 FIREBASE
let db;
try {
    const { initializeApp } = require('firebase/app');
    const { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, Timestamp } = require('firebase/firestore');
    
    const firebaseConfig = {
        apiKey: "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
        authDomain: "stanybots.firebaseapp.com",
        projectId: "stanybots",
        storageBucket: "stanybots.firebasestorage.app",
        messagingSenderId: "381983533939",
        appId: "1:381983533939:web:e6cc9445137c74b99df306"
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

// 📊 GLOBALS
const commands = new Map();
const msgCache = new Map();
const activeSessions = new Map();
const statusViewers = new Map();
const userActivity = new Map();
const lastSeen = new Map();
const userEmojis = new Map();

// 🏁 CREATE DIRS
['sessions', 'commands', 'public', 'temp'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * 🎯 DOWNLOAD MEDIA
 */
async function downloadMedia(m, type = 'image') {
    try {
        const message = m.message?.[`${type}Message`] || 
                       m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.[`${type}Message`];
        if (!message) return null;
        
        const stream = await downloadContentFromMessage(message, type);
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    } catch (error) {
        return null;
    }
}

/**
 * ⚙️ GET SETTINGS
 */
async function getSettings(number) {
    const defaultSettings = {
        prefix: ".",
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
        autoType: true,
        autoRecord: true,
        autoStatusView: true,
        autoStatusLike: true,
        autoStatusReply: true,
        forceJoin: true,
        autoDeleteInactive: false,
        inactiveThreshold: 7,
        antiLinkAction: 'delete',
        antiScamAction: 'remove',
        antiPornAction: 'remove',
        antiTagAction: 'warn',
        antiMediaAction: 'delete',
        emojiCommand: false,
        userEmoji: '🔥',
        welcomeMsg: true,
        goodbyeMsg: true
    };
    
    if (db) {
        try {
            const settingsDoc = await getDoc(doc(db, "SETTINGS", number));
            if (settingsDoc.exists()) {
                return { ...defaultSettings, ...settingsDoc.data() };
            }
        } catch (e) {}
    }
    return defaultSettings;
}

/**
 * 🛡️ ANTI-LINK SYSTEM
 */
async function checkAntiLink(sock, m, settings, isOwner) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase();
    
    if (!settings.antiLink || isOwner || !from.endsWith('@g.us')) return false;
    
    const links = body.match(/(https?:\/\/[^\s]+)/gi);
    if (!links) return false;
    
    // NO LINKS ALLOWED AT ALL - MARUFUKU YOYOTE
    const action = settings.antiLinkAction;
    const reason = "External links are prohibited in this group";
    
    switch(action) {
        case 'delete':
            await sock.sendMessage(from, { delete: m.key });
            await sock.sendMessage(from, { 
                text: `⚠️ *LINK REMOVED*\n\n@${sender.split('@')[0]} sent a link\n📝 Reason: ${reason}\n\nLinks are not allowed in this group.`,
                mentions: [sender]
            });
            break;
            
        case 'warn':
            await sock.sendMessage(from, {
                text: `🚨 *LINK WARNING*\n\n@${sender.split('@')[0]} sent a link\n📝 Reason: ${reason}\n\nNext violation will result in removal!`,
                mentions: [sender]
            });
            break;
            
        case 'remove':
            await sock.sendMessage(from, { delete: m.key });
            await sock.groupParticipantsUpdate(from, [sender], "remove");
            await sock.sendMessage(from, {
                text: `🚫 *USER REMOVED*\n\n@${sender.split('@')[0]} was removed\n📝 Reason: Sending links (Not allowed)`,
                mentions: [sender]
            });
            break;
    }
    return true;
}

/**
 * 🛡️ ANTI-SCAM SYSTEM
 */
async function checkAntiScam(sock, m, settings, isOwner) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase();
    
    if (!settings.antiScam || isOwner || !from.endsWith('@g.us')) return false;
    
    const scamWords = ["bundle", "fixed match", "earn money", "investment", "quick money", "get rich", "pesa haraka", "make money", "instant cash", "free money", "deposit", "withdraw", "bonus"];
    const isScam = scamWords.some(word => body.includes(word));
    
    if (isScam) {
        const action = settings.antiScamAction;
        const reason = "Scam/fraud content detected";
        
        switch(action) {
            case 'delete':
                await sock.sendMessage(from, { delete: m.key });
                await sock.sendMessage(from, { 
                    text: `⚠️ *SCAM CONTENT REMOVED*\n\n@${sender.split('@')[0]} sent scam content\n📝 Reason: ${reason}\n\nScam messages are prohibited.`,
                    mentions: [sender]
                });
                break;
                
            case 'warn':
                await sock.sendMessage(from, {
                    text: `🚨 *SCAM WARNING*\n\n@${sender.split('@')[0]} sent scam content\n📝 Reason: ${reason}\n\nThis is a warning! Next violation = removal.`,
                    mentions: [sender]
                });
                break;
                
            case 'remove':
                await sock.sendMessage(from, { delete: m.key });
                await sock.groupParticipantsUpdate(from, [sender], "remove");
                await sock.sendMessage(from, {
                    text: `🚫 *USER REMOVED*\n\n@${sender.split('@')[0]} was removed\n📝 Reason: Spreading scam content`,
                    mentions: [sender]
                });
                break;
        }
        return true;
    }
    return false;
}

/**
 * 🛡️ ANTI-PORN SYSTEM
 */
async function checkAntiPorn(sock, m, settings, isOwner) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase();
    
    if (!settings.antiPorn || isOwner || !from.endsWith('@g.us')) return false;
    
    const pornWords = ["porn", "xxx", "sex", "ngono", "nude", "nsfw", "adult", "vixen", "🔞", "🍑", "🥵"];
    const isPorn = pornWords.some(word => body.includes(word));
    
    if (isPorn) {
        const action = settings.antiPornAction;
        const reason = "Adult content detected";
        
        switch(action) {
            case 'delete':
                await sock.sendMessage(from, { delete: m.key });
                await sock.sendMessage(from, { 
                    text: `⚠️ *ADULT CONTENT REMOVED*\n\n@${sender.split('@')[0]} sent adult content\n📝 Reason: ${reason}\n\nAdult content is prohibited.`,
                    mentions: [sender]
                });
                break;
                
            case 'warn':
                await sock.sendMessage(from, {
                    text: `🚨 *ADULT CONTENT WARNING*\n\n@${sender.split('@')[0]} sent adult content\n📝 Reason: ${reason}\n\nThis is inappropriate for this group!`,
                    mentions: [sender]
                });
                break;
                
            case 'remove':
                await sock.sendMessage(from, { delete: m.key });
                await sock.groupParticipantsUpdate(from, [sender], "remove");
                await sock.sendMessage(from, {
                    text: `🚫 *USER REMOVED*\n\n@${sender.split('@')[0]} was removed\n📝 Reason: Sharing adult content`,
                    mentions: [sender]
                });
                break;
        }
        return true;
    }
    return false;
}

/**
 * 🛡️ ANTI-TAG SYSTEM
 */
async function checkAntiTag(sock, m, settings, isOwner) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || "");
    
    if (!settings.antiTag || isOwner || !from.endsWith('@g.us')) return false;
    
    const mentions = (body.match(/@/g) || []).length;
    if (mentions > 5) {
        const action = settings.antiTagAction;
        const reason = "Excessive tagging detected";
        
        switch(action) {
            case 'delete':
                await sock.sendMessage(from, { delete: m.key });
                await sock.sendMessage(from, { 
                    text: `⚠️ *EXCESSIVE TAGGING REMOVED*\n\n@${sender.split('@')[0]} tagged too many people\n📝 Reason: ${reason}\n\nMaximum 5 tags allowed.`,
                    mentions: [sender]
                });
                break;
                
            case 'warn':
                await sock.sendMessage(from, {
                    text: `🚨 *EXCESSIVE TAGGING WARNING*\n\n@${sender.split('@')[0]} tagged too many people\n📝 Reason: ${reason}\n\nPlease don't spam tags.`,
                    mentions: [sender]
                });
                break;
        }
        return true;
    }
    return false;
}

/**
 * 🛡️ ANTI-MEDIA SYSTEM
 */
async function checkAntiMedia(sock, m, settings, isOwner) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const type = getContentType(m.message);
    
    if (!settings.antiMedia || isOwner || !from.endsWith('@g.us')) return false;
    
    const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
    if (mediaTypes.includes(type)) {
        const action = settings.antiMediaAction;
        const reason = "Media sharing is disabled";
        
        switch(action) {
            case 'delete':
                await sock.sendMessage(from, { delete: m.key });
                await sock.sendMessage(from, { 
                    text: `⚠️ *MEDIA REMOVED*\n\n@${sender.split('@')[0]} sent media\n📝 Reason: ${reason}\n\nMedia sharing is not allowed.`,
                    mentions: [sender]
                });
                break;
                
            case 'warn':
                await sock.sendMessage(from, {
                    text: `🚨 *MEDIA WARNING*\n\n@${sender.split('@')[0]} sent media\n📝 Reason: ${reason}\n\nMedia sharing is disabled in this group.`,
                    mentions: [sender]
                });
                break;
        }
        return true;
    }
    return false;
}

/**
 * 🤖 AI RESPONSE IN USER'S LANGUAGE
 */
async function getAIResponse(message) {
    try {
        // Detect language (Swahili/English)
        const isSwahili = /(mambo|vipi|sasa|asante|nzuri|habari|pole|sawa)/i.test(message);
        const language = isSwahili ? 'sw' : 'en';
        
        let prompt;
        if (language === 'sw') {
            prompt = `Jibu kwa Kiswahili kwa ufupi na kirafiki: "${message.substring(0, 200)}"`;
        } else {
            prompt = `Respond naturally and briefly in English: "${message.substring(0, 200)}"`;
        }
        
        const response = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { 
            timeout: 8000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        return response.data || (language === 'sw' ? "Sielewi, tafadhali elezea zaidi." : "I didn't understand, please explain more.");
    } catch (e) {
        return "⚠️ AI service is currently unavailable.";
    }
}

/**
 * 👤 GET USER EMOJI
 */
async function getUserEmoji(sender) {
    if (db) {
        try {
            const emojiDoc = await getDoc(doc(db, "USER_EMOJIS", sender));
            if (emojiDoc.exists()) {
                return emojiDoc.data().emoji || '🔥';
            }
        } catch (e) {}
    }
    return userEmojis.get(sender) || '🔥';
}

/**
 * 🚀 START WHATSAPP BOT
 */
async function startWhatsAppBot(number) {
    if (activeSessions.has(number)) {
        console.log(`✅ Bot already running: ${number}`);
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
            printQRInTerminal: false,
            browser: Browsers.macOS("Safari"),
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000
        });
        
        sock.ev.on('creds.update', saveCreds);
        activeSessions.set(number, sock);
        
        // 🔄 CONNECTION HANDLER
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(`✅ ${number}: CONNECTED TO WHATSAPP`);
                
                // Always online
                await sock.updateProfileStatus(`WRONG TURN 7 🥀 | Online`);
                await sock.sendPresenceUpdate('available');
                
                // Save session to Firebase
                if (db) {
                    await setDoc(doc(db, "ACTIVE_SESSIONS", number), {
                        number: number,
                        connectedAt: new Date().toISOString(),
                        userId: sock.user?.id,
                        status: 'online'
                    });
                }
                
                // Send welcome to owner
                const welcomeMsg = `🌟 *WRONG TURN 7 ULTIMATE*\n\n✅ Bot connected successfully!\n📱 Number: ${number}\n⚡ Version: 7.0.0\n👨‍💻 Developer: STANYTZ\n\nAll features are now active!`;
                await sock.sendMessage(sock.user.id, { text: welcomeMsg });
                
                // Set up auto delete inactive members check (every 6 hours)
                setInterval(async () => {
                    const settings = await getSettings(number);
                    if (settings.autoDeleteInactive) {
                        await deleteInactiveMembers(sock, settings);
                    }
                }, 6 * 60 * 60 * 1000); // 6 hours
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`${number}: Disconnected. Reconnect: ${shouldReconnect}`);
                
                activeSessions.delete(number);
                
                if (db) {
                    await setDoc(doc(db, "ACTIVE_SESSIONS", number), {
                        status: 'offline',
                        disconnectedAt: new Date().toISOString()
                    }, { merge: true });
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
                
                // Get settings
                const settings = await getSettings(number);
                
                // Force join check
                if (!isOwner && settings.forceJoin && (body.startsWith(settings.prefix) || body.startsWith(await getUserEmoji(sender)))) {
                    const allowed = await checkMembership(sock, sender, settings);
                    if (!allowed) return;
                }
                
                // Cache message for anti-delete
                msgCache.set(m.key.id, { ...m, timestamp: Date.now() });
                
                // Track activity
                if (isGroup) {
                    trackActivity(from, sender, body);
                }
                
                // Auto read messages
                if (settings.autoRead && !isStatus) {
                    await sock.readMessages([m.key]);
                }
                
                // Auto save contacts
                if (settings.autoSaveContacts && !isGroup && !isOwner) {
                    await sock.updateBlockStatus(sender, 'unblock');
                }
                
                // Auto react
                if (settings.autoReact && !m.key.fromMe && !isStatus) {
                    const emoji = settings.userEmoji;
                    await sock.sendMessage(from, { react: { text: emoji, key: m.key } });
                }
                
                // Auto typing/recording
                if (settings.autoType) {
                    await sock.sendPresenceUpdate('composing', from);
                    if (settings.autoRecord) {
                        setTimeout(() => sock.sendPresenceUpdate('recording', from), 1000);
                    }
                }
                
                // 🔥 SECURITY CHECKS
                if (isGroup && !isOwner) {
                    if (await checkAntiLink(sock, m, settings, isOwner)) return;
                    if (await checkAntiScam(sock, m, settings, isOwner)) return;
                    if (await checkAntiPorn(sock, m, settings, isOwner)) return;
                    if (await checkAntiTag(sock, m, settings, isOwner)) return;
                    if (await checkAntiMedia(sock, m, settings, isOwner)) return;
                }
                
                // ANTI-DELETE
                if (m.message.protocolMessage?.type === 0 && settings.antiDelete && !m.key.fromMe) {
                    const cached = msgCache.get(m.message.protocolMessage.key.id);
                    if (cached) {
                        await sock.sendMessage(sock.user.id, {
                            text: `🛡️ *DELETED MESSAGE*\n\n👤 From: @${sender.split('@')[0]}\n💬 Message: ${cached.message?.conversation?.substring(0, 100) || 'Media'}\n📍 Group: ${from}`,
                            mentions: [sender]
                        });
                        await sock.copyNForward(sock.user.id, cached, false);
                    }
                }
                
                // ANTI VIEW-ONCE
                if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && settings.antiViewOnce) {
                    try {
                        const media = await downloadMedia(m, 'image') || await downloadMedia(m, 'video');
                        if (media) {
                            await sock.sendMessage(sock.user.id, {
                                text: `👁️ *VIEW-ONCE CAPTURED*\n\nFrom: @${sender.split('@')[0]}\nType: ${type.includes('image') ? 'Photo' : 'Video'}\nLocation: ${isGroup ? 'Group' : 'Private'}`
                            });
                            
                            if (media.toString('hex', 0, 4) === 'ffd8ff') {
                                await sock.sendMessage(sock.user.id, { image: media });
                            } else {
                                await sock.sendMessage(sock.user.id, { video: media });
                            }
                        }
                    } catch (e) {}
                }
                
                // STATUS FEATURES
                if (isStatus && settings.autoStatus) {
                    // Auto view status
                    if (settings.autoStatusView) {
                        await sock.readMessages([m.key]);
                        statusViewers.set(number, (statusViewers.get(number) || 0) + 1);
                    }
                    
                    // Auto like status
                    if (settings.autoStatusLike) {
                        const likes = ['❤️', '🔥', '👍', '👏', '🎉', '🥰', '😍', '🤩'];
                        const like = likes[Math.floor(Math.random() * likes.length)];
                        await sock.sendMessage(from, { react: { text: like, key: m.key } }, { statusJidList: [sender] });
                    }
                    
                    // Auto reply to status
                    if (settings.autoStatusReply && body && body.length > 3) {
                        const reply = await getAIResponse(body);
                        await sock.sendMessage(from, { text: reply }, { quoted: m });
                    }
                }
                
                // 🤖 AI AUTO REPLY (LIKE HUMAN)
                if (!isGroup && !isStatus && settings.autoAI && body.length > 2 && !m.key.fromMe) {
                    const response = await getAIResponse(body);
                    await sock.sendMessage(from, { text: response }, { quoted: m });
                }
                
                // 🎵 SONG/VIDEO DOWNLOAD
                if (body.startsWith(`${settings.prefix}song `) || body.startsWith(`${settings.prefix}video `) || body.startsWith(`${settings.prefix}music `)) {
                    const query = body.split(' ').slice(1).join(' ');
                    const text = `🎵 *DOWNLOAD ASSISTANT*\n\nSearching: ${query}\n\n🔗 YouTube: https://www.y2mate.com\n🔗 Spotify: Use SpotDL\n🔗 General: https://en.savefrom.net\n\nOr send me direct YouTube/Spotify link!`;
                    await sock.sendMessage(from, { text });
                }
                
                // 📊 ACTIVITY COMMAND
                if (body.startsWith(`${settings.prefix}activity`)) {
                    if (isGroup) {
                        const activity = await showActivity(from);
                        await sock.sendMessage(from, { text: activity });
                    }
                }
                
                // 🎯 EMOJI COMMAND SYSTEM
                const userEmoji = await getUserEmoji(sender);
                if (body.startsWith(userEmoji) && settings.emojiCommand) {
                    // EMOJI MENU
                    const menu = `🎯 *WRONG TURN 7 MENU*\n\n🎵 ${userEmoji} song <name> - Download song\n📹 ${userEmoji} video <name> - Download video\n🤖 ${userEmoji} ai <text> - Chat with AI\n📊 ${userEmoji} activity - Group activity\n⚙️ ${userEmoji} settings - Bot settings\n\n📱 Prefix: ${settings.prefix}\n👨‍💻 Developer: STANYTZ`;
                    await sock.sendMessage(from, { text: menu });
                }
                
                // COMMAND HANDLER
                if (body.startsWith(settings.prefix)) {
                    const [cmd, ...args] = body.slice(settings.prefix.length).trim().split(/ +/);
                    const command = commands.get(cmd.toLowerCase());
                    
                    if (command) {
                        await command.execute(m, sock, args, db, settings);
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
                const settings = await getSettings(number);
                
                if (action === 'add' && settings.welcomeMsg) {
                    const welcome = `🌸 *WELCOME*\n\n@${participants[0].split('@')[0]} joined the group!\n\nType .help for commands\nEnjoy your stay! 🥀`;
                    await sock.sendMessage(id, { text: welcome, mentions: participants });
                }
                
                if (action === 'remove' && settings.goodbyeMsg) {
                    const goodbye = `👋 *GOODBYE*\n\n@${participants[0].split('@')[0]} left the group.\n\nHope to see you again! 🥀`;
                    await sock.sendMessage(id, { text: goodbye, mentions: participants });
                }
            } catch (e) {}
        });
        
        // 📞 ANTI-CALL
        sock.ev.on('call', async (call) => {
            try {
                const callData = call[0];
                const settings = await getSettings(number);
                
                if (settings.antiCall) {
                    await sock.rejectCall(callData.id, callData.from);
                    const text = `📞 *CALL REJECTED*\n\nCalls are not allowed!\n\nUse text messages only.`;
                    await sock.sendMessage(callData.from, { text });
                }
            } catch (e) {}
        });
        
        console.log(`✅ Bot started: ${number}`);
        return sock;
        
    } catch (error) {
        console.error(`❌ Start error ${number}:`, error.message);
        activeSessions.delete(number);
        return null;
    }
}

// 📊 ACTIVITY TRACKING
function trackActivity(group, user, message) {
    if (!group.endsWith('@g.us')) return;
    
    let groupActivity = userActivity.get(group);
    if (!groupActivity) {
        groupActivity = new Map();
        userActivity.set(group, groupActivity);
    }
    
    let userData = groupActivity.get(user) || { messages: 0, lastSeen: Date.now() };
    userData.messages++;
    userData.lastSeen = Date.now();
    userData.lastMessage = message.substring(0, 50);
    
    groupActivity.set(user, userData);
    lastSeen.set(user, Date.now());
    
    // Save to Firebase
    if (db) {
        setDoc(doc(db, "ACTIVITY", group, "USERS", user), {
            messages: userData.messages,
            lastSeen: new Date().toISOString(),
            lastMessage: userData.lastMessage
        }, { merge: true }).catch(() => {});
    }
}

// 📊 SHOW ACTIVITY
async function showActivity(group) {
    const activity = userActivity.get(group);
    if (!activity) return "📊 No activity data yet.";
    
    const now = Date.now();
    let active = [], inactive = [];
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    activity.forEach((data, user) => {
        if (data.lastSeen > weekAgo) {
            active.push({ user, ...data });
        } else {
            inactive.push({ user, ...data });
        }
    });
    
    active.sort((a, b) => b.messages - a.messages);
    
    let text = `📊 *GROUP ACTIVITY*\n\n👥 Total Tracked: ${activity.size}\n✅ Active (7d): ${active.length}\n❌ Inactive: ${inactive.length}\n\n`;
    
    text += `🏆 *TOP 5 ACTIVE*\n`;
    active.slice(0, 5).forEach((user, i) => {
        const days = Math.floor((now - user.lastSeen) / (24 * 60 * 60 * 1000));
        text += `${i+1}. @${user.user.split('@')[0]} - ${user.messages} msgs (${days === 0 ? 'Today' : days + 'd ago'})\n`;
    });
    
    return text;
}

// 🗑️ DELETE INACTIVE
async function deleteInactiveMembers(sock, settings) {
    if (!settings.autoDeleteInactive) return;
    
    const threshold = Date.now() - (settings.inactiveThreshold * 24 * 60 * 60 * 1000);
    
    for (const [group, activity] of userActivity.entries()) {
        try {
            for (const [user, data] of activity.entries()) {
                if (data.lastSeen < threshold) {
                    await sock.groupParticipantsUpdate(group, [user], "remove");
                    activity.delete(user);
                }
            }
        } catch (e) {}
    }
}

// 🔗 CHECK MEMBERSHIP
async function checkMembership(sock, user, settings) {
    if (!settings.forceJoin) return true;
    
    const groupJid = '120363406549688641@g.us';
    
    try {
        const metadata = await sock.groupMetadata(groupJid);
        const inGroup = metadata.participants.some(p => p.id === user);
        
        if (!inGroup) {
            const text = `❌ *ACCESS DENIED*\n\nYou must join our group to use this bot!\n\n🔗 https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y\n\nJoin and try again!`;
            await sock.sendMessage(user, { text });
            return false;
        }
        return true;
    } catch (e) {
        return true;
    }
}

// 🌐 WEB SERVER
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WRONG TURN 7</title>
            <style>
                body { background: #000; color: #ff0000; font-family: monospace; padding: 50px; text-align: center; }
                h1 { font-size: 3em; text-shadow: 0 0 10px #ff0000; }
                .btn { background: #ff0000; color: #000; padding: 15px 30px; margin: 10px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; font-weight: bold; }
                .stats { margin: 30px; padding: 20px; background: #111; border-radius: 10px; }
            </style>
        </head>
        <body>
            <h1>WRONG TURN 7 🥀</h1>
            <p>Ultimate WhatsApp Bot v7.0.0</p>
            <div class="stats">
                <p>Active Bots: ${activeSessions.size}</p>
                <p>Groups Tracked: ${userActivity.size}</p>
            </div>
            <a href="/pair" class="btn">🔗 PAIR WHATSAPP</a>
            <a href="/health" class="btn">🏥 HEALTH</a>
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
                body { background: #000; color: #fff; padding: 50px; text-align: center; }
                input, button { padding: 15px; margin: 10px; font-size: 16px; }
                #result { margin: 20px; padding: 20px; background: #111; border-radius: 10px; }
            </style>
        </head>
        <body>
            <h1>🔗 PAIR WHATSAPP</h1>
            <input type="text" id="number" placeholder="254712345678" value="254">
            <button onclick="pair()">GET CODE</button>
            <div id="result"></div>
            <script>
                async function pair() {
                    const number = document.getElementById('number').value;
                    const result = document.getElementById('result');
                    result.innerHTML = '⏳ Generating pairing code...';
                    
                    try {
                        const res = await fetch('/api/pair?number=' + number);
                        const data = await res.json();
                        
                        if (data.success) {
                            result.innerHTML = \`
                                <h3>✅ PAIRING CODE:</h3>
                                <h2 style="letter-spacing: 10px;">\${data.code}</h2>
                                <p>📱 Go to WhatsApp → Settings → Linked Devices → Link a Device</p>
                                <p>🔢 Enter this code: \${data.code}</p>
                                <p>⏱️ Code expires in 2 minutes</p>
                            \`;
                        } else {
                            result.innerHTML = '❌ Error: ' + (data.error || 'Unknown error');
                        }
                    } catch (error) {
                        result.innerHTML = '❌ Connection error';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.get('/api/pair', async (req, res) => {
    let number = req.query.number.replace(/\D/g, '');
    
    if (number.startsWith('0')) number = '254' + number.substring(1);
    if (number.startsWith('7') && number.length === 9) number = '254' + number;
    
    console.log(`📱 Pairing: ${number}`);
    
    try {
        const sessionDir = `./sessions/${number}`;
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true });
        }
        
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.macOS("Safari")
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        const pairingCode = await sock.requestPairingCode(number);
        
        res.json({ success: true, code: pairingCode });
        
        sock.ev.on('connection.update', async (update) => {
            if (update.connection === 'open') {
                console.log(`✅ ${number}: Paired successfully`);
                
                if (db) {
                    await setDoc(doc(db, "PAIRED_DEVICES", number), {
                        number,
                        pairedAt: new Date().toISOString(),
                        deviceId: sock.user?.id
                    });
                }
                
                sock.end();
                await startWhatsAppBot(number);
            }
        });
        
        setTimeout(() => {
            if (!sock.user?.id) {
                sock.end();
                console.log(`⏱️ ${number}: Pairing timeout`);
            }
        }, 120000);
        
    } catch (error) {
        console.error('Pair error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        version: '7.0.0',
        activeBots: activeSessions.size,
        uptime: process.uptime(),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
    });
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server running on port ${PORT}`);
    console.log(`🔗 Dashboard: http://localhost:${PORT}`);
    console.log(`🔗 Pairing: http://localhost:${PORT}/pair`);
    
    // Load commands
    const loadCommands = () => {
        const cmdDir = './commands';
        if (fs.existsSync(cmdDir)) {
            fs.readdirSync(cmdDir).forEach(folder => {
                const folderPath = path.join(cmdDir, folder);
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
        console.log(`📦 Total commands: ${commands.size}`);
    };
    
    loadCommands();
    
    // Create essential commands
    createEssentialCommands();
});

/**
 * 📝 CREATE ESSENTIAL COMMANDS
 */
function createEssentialCommands() {
    const cmdDir = './commands';
    if (!fs.existsSync(cmdDir)) fs.mkdirSync(cmdDir, { recursive: true });
    
    // Create utility directory
    const utilDir = './commands/utility';
    if (!fs.existsSync(utilDir)) fs.mkdirSync(utilDir, { recursive: true });
    
    // HELP COMMAND
    const helpCmd = `
module.exports = {
    name: 'help',
    category: 'utility',
    async execute(m, sock, args, db, settings) {
        const from = m.key.remoteJid;
        const text = \`🎯 *WRONG TURN 7 COMMANDS*\\n\\nPrefix: \${settings.prefix}\\nEmoji: \${settings.userEmoji}\\n\\n*UTILITY*\\n• \${settings.prefix}help - Show this menu\\n• \${settings.prefix}settings - Bot settings\\n• \${settings.prefix}activity - Group activity\\n\\n*MEDIA*\\n• \${settings.prefix}song <name> - Download song\\n• \${settings.prefix}video <name> - Download video\\n• \${settings.prefix}sticker - Create sticker\\n\\n*AI*\\n• \${settings.prefix}ai <text> - Chat with AI\\n\\n*GROUP*\\n• \${settings.prefix}promote @user - Promote user\\n• \${settings.prefix}demote @user - Demote user\\n• \${settings.prefix}remove @user - Remove user\\n\\n*EMOJI*\\nSet your emoji with: \${settings.prefix}setemoji <emoji>\\nThen use: <your-emoji> command\\n\\n👨‍💻 Developer: STANYTZ 🥀\`;
        await sock.sendMessage(from, { text });
    }
};
    `;
    
    // SETTINGS COMMAND
    const settingsCmd = `
module.exports = {
    name: 'settings',
    category: 'utility',
    async execute(m, sock, args, db, settings) {
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const isOwner = sender.startsWith(sock.user.id.split(':')[0]);
        
        if (!isOwner) {
            return sock.sendMessage(from, { text: '❌ This command is for bot owner only!' });
        }
        
        if (args[0] === 'set') {
            const key = args[1];
            const value = args[2];
            if (key && value !== undefined) {
                settings[key] = value === 'true' ? true : value === 'false' ? false : value;
                if (db) {
                    await setDoc(doc(db, "SETTINGS", sock.user.id.split(':')[0]), settings, { merge: true });
                }
                await sock.sendMessage(from, { text: \`✅ Setting \${key} updated to: \${value}\` });
            }
        } else {
            let text = '⚙️ *BOT SETTINGS*\\n\\n';
            Object.entries(settings).forEach(([key, val]) => {
                text += \`• \${key}: \${val}\\n\`;
            });
            text += '\\n💡 Use: .settings set <key> <value>';
            await sock.sendMessage(from, { text });
        }
    }
};
    `;
    
    // SETEMOJI COMMAND
    const setemojiCmd = `
module.exports = {
    name: 'setemoji',
    category: 'utility',
    async execute(m, sock, args, db, settings) {
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        
        if (!args[0]) {
            return sock.sendMessage(from, { text: '❌ Please provide an emoji\\nUsage: .setemoji 🔥' });
        }
        
        const emoji = args[0];
        userEmojis.set(sender, emoji);
        
        if (db) {
            await setDoc(doc(db, "USER_EMOJIS", sender), { emoji: emoji }, { merge: true });
        }
        
        await sock.sendMessage(from, { text: \`✅ Your command emoji set to: \${emoji}\\n\\nNow use: \${emoji} to open menu!\\nExample: \${emoji} song baby shark\` });
    }
};
    `;
    
    // Write command files
    fs.writeFileSync(path.join(utilDir, 'help.js'), helpCmd);
    fs.writeFileSync(path.join(utilDir, 'settings.js'), settingsCmd);
    fs.writeFileSync(path.join(utilDir, 'setemoji.js'), setemojiCmd);
    
    console.log('📝 Created essential commands');
}

// Export for commands
module.exports = {
    userEmojis,
    userActivity,
    lastSeen
};

// 🔄 KEEP ALIVE
setInterval(() => {
    console.log(`❤️  Heartbeat - Active: ${activeSessions.size}, Groups: ${userActivity.size}`);
}, 60000);
