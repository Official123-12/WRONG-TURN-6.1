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
    downloadContentFromMessage,
    proto
} = require('@whiskeysockets/baileys');

const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc, updateDoc, collection, query, where, getDocs } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');

const firebaseConfig = {
    apiKey: "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
    authDomain: "stanybots.firebasestorage.app",
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
const statusViewers = new Map();
let sock = null;

// 🎨 THEME & DESIGN
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
        footer: `\n${THEME.BORDERS.bottom}\n\nᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ 🥀`
    }
};

// ⚙️ DEFAULT SETTINGS
const DEFAULT_SETTINGS = {
    prefix: ".",
    emojiCommand: "🎰",
    autoType: true,
    autoRecord: true,
    autoReply: true,
    autoStatusView: true,
    autoStatusLike: true,
    autoStatusReply: true,
    antiLink: true,
    antiDelete: true,
    antiViewOnce: true,
    antiPorn: true,
    antiMedia: true,
    antiScam: true,
    antiTag: true,
    antiCall: true,
    autoReact: true,
    autoAI: true,
    autoBio: true,
    autoSaveContacts: true,
    autoRead: true,
    welcome: true,
    goodbye: true,
    forceFollow: true,
    autoKickInactive: true,
    inactiveDays: 7
};

// 1. DYNAMIC COMMAND LOADER
const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath, { recursive: true });
    fs.readdirSync(cmdPath).forEach(folder => {
        const folderPath = path.join(cmdPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            fs.readdirSync(folderPath).filter(f => f.endsWith('.js')).forEach(file => {
                try {
                    const cmd = require(path.join(folderPath, file));
                    if (cmd && cmd.name) {
                        cmd.category = folder;
                        commands.set(cmd.name.toLowerCase(), cmd);
                        console.log(`✅ Loaded: ${cmd.name}`);
                    }
                } catch (e) { console.log(`❌ Failed ${file}:`, e.message); }
            });
        }
    });
};

// 2. FIREBASE AUTH HANDLER
async function useFirebaseAuthState(db, collectionName, sessionId) {
    const fixId = (id) => `${sessionId}_${id.replace(/\//g, '__').replace(/\@/g, 'at')}`;
    const writeData = async (data, id) => setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
        } catch (e) { return null; }
    };
    const removeData = async (id) => deleteDoc(doc(db, collectionName, fixId(id)));

    let creds = await readData('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            value ? await writeData(value, `${type}-${id}`) : await removeData(`${type}-${id}`);
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds'),
        clearSession: () => removeData('creds')
    };
}

// 🎯 MEDIA DOWNLOADER
async function downloadMedia(m, type = 'image') {
    try {
        let mediaMsg = m.message?.[`${type}Message`] ||
            m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.[`${type}Message`];

        if (!mediaMsg) return null;

        const stream = await downloadContentFromMessage(mediaMsg, type);
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    } catch {
        return null;
    }
}

// 🤖 AI SYSTEM (All Languages)
class AISystem {
    static async generateResponse(message) {
        try {
            // Detect language and respond in same language
            const prompt = `Respond naturally in the same language as this message: "${message.substring(0, 150)}"`;
            const urls = [
                `https://api.popcat.xyz/chat?msg=${encodeURIComponent(prompt)}`,
                `https://text.pollinations.ai/${encodeURIComponent(prompt)}`
            ];

            for (const url of urls) {
                try {
                    const response = await axios.get(url, { timeout: 3000 });
                    if (response.data) {
                        return typeof response.data === 'object' ? 
                            response.data.response || JSON.stringify(response.data) : 
                            response.data.toString().substring(0, 300);
                    }
                } catch { continue; }
            }

            // Fallback responses in multiple languages
            const fallbacks = [
                "I understand, please continue.",
                "Got it, processing your request...",
                "Nimekuelewa, endelea mbele.",
                "Comprendo, por favor continúa.",
                "Je comprends, continuez s'il vous plaît."
            ];
            return fallbacks[Math.floor(Math.random() * fallbacks.length)];

        } catch {
            return "Processing...";
        }
    }

    static async analyzeStatus(statusText) {
        try {
            const response = await axios.get(
                `https://text.pollinations.ai/Analyze%20this%20status%20with%20deep%20empathy%20and%20reply%20as%20a%20caring%20friend:%20"${statusText.substring(0, 100)}"`,
                { timeout: 2000 }
            );
            return response.data || "Thinking of you. Stay strong. 🥀";
        } catch {
            return "Your status is noted. Sending positive vibes. 🌸";
        }
    }
}

// 🔐 ENHANCED SECURITY SYSTEM
class SecuritySystem {
    static async checkAndAct(sock, m, settings, isOwner) {
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation ||
            m.message.extendedTextMessage?.text ||
            m.message.imageMessage?.caption || "").toLowerCase();
        const type = getContentType(m.message);

        if (!from.endsWith('@g.us') || isOwner) return false;

        const securityAlert = async (reason, action = "deleted") => {
            await sock.sendMessage(from, { delete: m.key });
            const msg = `${THEME.FONTS.flowerWrap("SECURITY ACTION")}\n\n👤 User: @${sender.split('@')[0]}\n⚡ Action: Message ${action}\n📝 Reason: ${reason}\n${THEME.FONTS.footer}`;
            await sock.sendMessage(from, { text: msg, mentions: [sender] });
            return true;
        };

        // 🔗 ANTI-LINK
        if (settings.antiLink && /https?:\/\/[^\s]+/gi.test(body)) {
            return await securityAlert("External links are prohibited", "deleted & warned");
        }

        // 🚫 ANTI-SCAM
        if (settings.antiScam) {
            const scamWords = ["bundle", "fixed match", "earn money", "investment", "quick money", "get rich", "pesa haraka", "online job"];
            if (scamWords.some(word => body.includes(word))) {
                const metadata = await sock.groupMetadata(from);
                await sock.sendMessage(from, {
                    text: `${THEME.FONTS.flowerWrap("SCAM ALERT")}\n\n@${sender.split('@')[0]} is spreading fraud!\n🚨 Be cautious everyone!\n\n${THEME.FONTS.footer}`,
                    mentions: metadata.participants.map(p => p.id)
                });
                await sock.sendMessage(from, { delete: m.key });
                await sock.groupParticipantsUpdate(from, [sender], "remove");
                return true;
            }
        }

        // 🔞 ANTI-PORN
        if (settings.antiPorn) {
            const adultWords = ["porn", "xxx", "sex", "ngono", "nude", "onlyfans", "🔞", "nsfw"];
            if (adultWords.some(word => body.includes(word))) {
                await sock.sendMessage(from, { delete: m.key });
                await sock.groupParticipantsUpdate(from, [sender], "remove");
                await sock.sendMessage(from, {
                    text: `${THEME.FLOWERS[0]} User removed for adult content! ${THEME.FLOWERS[0]}`,
                    mentions: [sender]
                });
                return true;
            }
        }

        // 🎭 ANTI-MEDIA
        if (settings.antiMedia && ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'].includes(type)) {
            return await securityAlert("Media sharing is disabled");
        }

        // @ ANTI-TAG
        if (settings.antiTag && (body.match(/@/g) || []).length > 5) {
            return await securityAlert("Excessive tagging detected");
        }

        return false;
    }
}

// ⚙️ SETTINGS MANAGER
class SettingsManager {
    static async getSettings(number) {
        try {
            const settingsRef = doc(db, "BOT_SETTINGS", number);
            const settingsSnap = await getDoc(settingsRef);

            if (settingsSnap.exists()) {
                return { ...DEFAULT_SETTINGS, ...settingsSnap.data() };
            } else {
                await setDoc(settingsRef, DEFAULT_SETTINGS);
                return DEFAULT_SETTINGS;
            }
        } catch {
            return DEFAULT_SETTINGS;
        }
    }

    static async updateSettings(number, updates) {
        try {
            const settingsRef = doc(db, "BOT_SETTINGS", number);
            await updateDoc(settingsRef, updates);
            return true;
        } catch {
            return false;
        }
    }
}

// 3. MAIN BOT ENGINE WITH ALL FEATURES
async function startBot() {
    loadCmds();
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT7_SESSIONS", "MASTER");

    const { version } = await fetchLatestBaileysVersion();
    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        printQRInTerminal: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WRONG TURN 7: ARMED & OPERATIONAL");
            
            // 📊 UPDATE PROFILE
            await sock.updateProfileStatus(`WRONG TURN 7 🥀 | ONLINE | STANYTZ`);
            await sock.sendPresenceUpdate('available');
            
            const welcome = `
${THEME.BORDERS.top}

${THEME.FONTS.bold("WRONG TURN 7 ULTIMATE")}

🥀 SYSTEM ARMED & ACTIVE
⚡ VERSION: 7.0.0 ULTIMATE
👨‍💻 DEVELOPER: STANYTZ
🌍 STATUS: ONLINE & ACTIVE
🔒 SECURITY: FULLY ARMED

${THEME.BORDERS.middle}
🎰 EMOJI COMMAND: 🎰
🔤 PREFIX: .
📡 PLATFORM: RAILWAY
${THEME.FONTS.footer}
            `.trim();
            
            await sock.sendMessage(sock.user.id, { text: welcome });
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`🔒 Disconnected, reason: ${reason}`);
            if (reason !== DisconnectReason.loggedOut) {
                console.log('🔄 Reconnecting in 3 seconds...');
                setTimeout(startBot, 3000);
            }
        }
    });

    // 💬 MESSAGE HANDLER WITH ALL FEATURES
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const sender = m.key.participant || from;
            const body = (m.message.conversation || 
                         m.message.extendedTextMessage?.text || 
                         m.message.imageMessage?.caption || "").trim();
            const type = getContentType(m.message);
            const isGroup = from.endsWith('@g.us');
            const isOwner = sender.startsWith(sock.user?.id?.split(':')[0]) || m.key.fromMe;
            const isStatus = from === 'status@broadcast';

            // 📝 CACHE FOR ANTI-DELETE
            msgCache.set(m.key.id, { ...m, timestamp: Date.now() });

            // ⚙️ GET SETTINGS
            const settings = await SettingsManager.getSettings(sock.user?.id?.split(':')[0]);

            // 🔒 SECURITY CHECK
            if (isGroup && !isOwner) {
                const blocked = await SecuritySystem.checkAndAct(sock, m, settings, isOwner);
                if (blocked) return;
            }

            // 🎮 EMOJI COMMAND SYSTEM (NO TYPING COMMAND NAME)
            if (body === settings.emojiCommand) {
                const menu = `
${THEME.BORDERS.top}

${THEME.FONTS.bold("🎰 WRONG TURN 7 MENU")}

📱 *User Commands:*
${settings.emojiCommand} - Open this menu
📊 .info - Bot information
🎵 .song <name> - Download song
🎥 .video <name> - Download video
🤖 .ai <text> - Chat with AI
🔒 .security - Security status

👨‍💻 *Admin Commands:*
⚙️ .settings - Bot settings
👥 .group - Group management
🛡️ .security on/off - Security toggle
📊 .stats - Statistics

${THEME.BORDERS.middle}
🔧 Prefix: ${settings.prefix}
🎰 Emoji: ${settings.emojiCommand}
👤 User: @${sender.split('@')[0]}
${THEME.FONTS.footer}
                `.trim();

                await sock.sendMessage(from, { text: menu, mentions: [sender] });
                return;
            }

            // 🔄 AUTO FEATURES
            if (settings.autoType) {
                await sock.sendPresenceUpdate('composing', from);
                setTimeout(() => sock.sendPresenceUpdate('paused', from), 1000);
            }

            if (settings.autoRecord && Math.random() > 0.7) {
                await sock.sendPresenceUpdate('recording', from);
                setTimeout(() => sock.sendPresenceUpdate('paused', from), 800);
            }

            if (settings.autoRead && !isStatus) {
                await sock.readMessages([m.key]).catch(() => {});
            }

            if (settings.autoReact && !isStatus) {
                const emojis = ['🥀', '🌸', '🌺', '🌹', '👍', '❤️', '🔥', '👏'];
                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                await sock.sendMessage(from, {
                    react: { text: randomEmoji, key: m.key }
                }).catch(() => {});
            }

            // 🤖 AUTO AI REPLY (User's Original Language)
            if (!isGroup && !isStatus && settings.autoAI && body.length > 2 && !m.key.fromMe) {
                const aiResponse = await AISystem.generateResponse(body);
                const formatted = `
${THEME.FONTS.flowerWrap("AI RESPONSE")}

${aiResponse}

${THEME.FONTS.footer}
                `.trim();

                await sock.sendMessage(from, { text: formatted }, { quoted: m });
            }

            // 🌟 STATUS FEATURES
            if (isStatus) {
                // 👁️ AUTO VIEW
                if (settings.autoStatusView) {
                    await sock.readMessages([m.key]).catch(() => {});
                }

                // ❤️ AUTO LIKE WITH DIFFERENT EMOJIS
                if (settings.autoStatusLike) {
                    const likeEmojis = ['❤️', '👍', '🔥', '👏', '🎉', '🥀', '🌟', '💯', '😍', '🤩'];
                    const randomEmoji = likeEmojis[Math.floor(Math.random() * likeEmojis.length)];
                    await sock.sendMessage(from, {
                        react: { text: randomEmoji, key: m.key }
                    }, { statusJidList: [sender] }).catch(() => {});
                }

                // 💭 AUTO REPLY WITH DEEP THINKING
                if (settings.autoStatusReply && body) {
                    const analysis = await AISystem.analyzeStatus(body);
                    await sock.sendMessage(from, { text: analysis }, { quoted: m }).catch(() => {});
                }

                // 📥 DOWNLOAD STATUS
                if (body.includes('.download') || body.includes('download status')) {
                    const media = await downloadMedia(m, 'image') || await downloadMedia(m, 'video');
                    if (media) {
                        await sock.sendMessage(sock.user.id, {
                            [media.slice(0, 4).toString('hex') === 'ffd8ffe0' ? 'image' : 'video']: media,
                            caption: `📥 Status downloaded from ${sender.split('@')[0]}`
                        }).catch(() => {});
                    }
                }
            }

            // 🚫 ANTI-DELETE
            if (m.message?.protocolMessage?.type === 0 && settings.antiDelete) {
                const cached = msgCache.get(m.message.protocolMessage.key.id);
                if (cached) {
                    await sock.sendMessage(sock.user.id, {
                        text: `${THEME.FONTS.flowerWrap("ANTI-DELETE CAPTURED")}\n\n👤 From: @${sender.split('@')[0]}\n💬 Message: ${cached.message?.conversation?.substring(0, 100) || 'Media'}`
                    });
                    await sock.copyNForward(sock.user.id, cached, true).catch(() => {});
                }
            }

            // 👁️ ANTI VIEW-ONCE
            if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && settings.antiViewOnce) {
                const media = await downloadMedia(m, 'image') || await downloadMedia(m, 'video');
                if (media) {
                    await sock.sendMessage(sock.user.id, {
                        text: `${THEME.FONTS.flowerWrap("VIEW-ONCE CAPTURED")}\n\nFrom: @${sender.split('@')[0]}`
                    });

                    if (media.slice(0, 4).toString('hex') === 'ffd8ffe0') {
                        await sock.sendMessage(sock.user.id, { image: media }).catch(() => {});
                    } else {
                        await sock.sendMessage(sock.user.id, { video: media }).catch(() => {});
                    }
                }
            }

            // 📞 ANTI-CALL (Already handled by event)

            // 🎵 SONG DOWNLOAD
            if (body.startsWith(`${settings.prefix}song `)) {
                const query = body.split(' ').slice(1).join(' ');
                await sock.sendMessage(from, {
                    text: `🎵 *SONG DOWNLOAD*\n\nQuery: ${query}\n\n🔗 Download from:\n• https://snaptik.app\n• https://en.y2mate.is/\n• https://spotdl.org`
                });
            }

            // 🎥 VIDEO DOWNLOAD
            if (body.startsWith(`${settings.prefix}video `)) {
                const query = body.split(' ').slice(1).join(' ');
                await sock.sendMessage(from, {
                    text: `🎥 *VIDEO DOWNLOAD*\n\nQuery: ${query}\n\n🔗 Download from:\n• https://ssyoutube.com\n• https://y2mate.com\n• https://en.savefrom.net`
                });
            }

            // 🤖 AI COMMAND
            if (body.startsWith(`${settings.prefix}ai `)) {
                const query = body.split(' ').slice(1).join(' ');
                const response = await AISystem.generateResponse(query);
                await sock.sendMessage(from, {
                    text: `${THEME.FONTS.flowerWrap("AI RESPONSE")}\n\n${response}\n\n${THEME.FONTS.footer}`
                });
            }

            // ⚙️ SETTINGS COMMAND
            if (body === `${settings.prefix}settings` && isOwner) {
                const settingsText = `
${THEME.BORDERS.top}

${THEME.FONTS.bold("BOT SETTINGS")}

🎰 Emoji Command: ${settings.emojiCommand}
🔤 Prefix: ${settings.prefix}

${THEME.FONTS.bold("Auto Features:")}
🤖 Auto AI: ${settings.autoAI ? '✅' : '❌'}
📖 Auto Read: ${settings.autoRead ? '✅' : '❌'}
💬 Auto Reply: ${settings.autoReply ? '✅' : '❌'}
🎭 Auto React: ${settings.autoReact ? '✅' : '❌'}

${THEME.FONTS.bold("Security:")}
🔗 Anti-Link: ${settings.antiLink ? '✅' : '❌'}
🚫 Anti-Scam: ${settings.antiScam ? '✅' : '❌'}
🔞 Anti-Porn: ${settings.antiPorn ? '✅' : '❌'}
👁️ Anti-ViewOnce: ${settings.antiViewOnce ? '✅' : '❌'}
📞 Anti-Call: ${settings.antiCall ? '✅' : '❌'}

${THEME.BORDERS.middle}
Use: .set <feature> <on/off>
Example: .set emojiCommand 🎮
${THEME.FONTS.footer}
                `.trim();

                await sock.sendMessage(from, { text: settingsText });
            }

            // 👥 GROUP INFO
            if (body === `${settings.prefix}group` && isGroup) {
                try {
                    const metadata = await sock.groupMetadata(from);
                    const participants = metadata.participants;
                    
                    const activeCount = participants.filter(p => 
                        !p.id.endsWith('@s.whatsapp.net')
                    ).length;
                    
                    const groupInfo = `
${THEME.BORDERS.top}

${THEME.FONTS.bold("GROUP INFO")}

📛 Name: ${metadata.subject}
👥 Total Members: ${participants.length}
✅ Active: ${activeCount}
❌ Inactive: ${participants.length - activeCount}
👑 Admins: ${participants.filter(p => p.admin).length}

${THEME.BORDERS.middle}
🔧 Commands:
.kick @user - Remove user
.promote @user - Make admin
.demote @user - Remove admin
${THEME.FONTS.footer}
                    `.trim();

                    await sock.sendMessage(from, { text: groupInfo });
                } catch (e) {}
            }

            // 🛡️ SECURITY STATUS
            if (body === `${settings.prefix}security`) {
                const securityStatus = `
${THEME.BORDERS.top}

${THEME.FONTS.bold("SECURITY STATUS")}

🔒 Active Protections:
${settings.antiLink ? '✅ Anti-Link' : '❌ Anti-Link'}
${settings.antiScam ? '✅ Anti-Scam' : '❌ Anti-Scam'}
${settings.antiPorn ? '✅ Anti-Porn' : '❌ Anti-Porn'}
${settings.antiDelete ? '✅ Anti-Delete' : '❌ Anti-Delete'}
${settings.antiViewOnce ? '✅ Anti-ViewOnce' : '❌ Anti-ViewOnce'}

${THEME.BORDERS.middle}
🛡️ System: ARMED & ACTIVE
👨‍💻 Admin: @${sender.split('@')[0]}
${THEME.FONTS.footer}
                `.trim();

                await sock.sendMessage(from, { text: securityStatus, mentions: [sender] });
            }

        } catch (error) {
            console.log('Message error:', error.message);
        }
    });

    // 👥 GROUP PARTICIPANTS UPDATE
    sock.ev.on('group-participants.update', async (update) => {
        try {
            const { id, participants, action } = update;
            const settings = await SettingsManager.getSettings(sock.user?.id?.split(':')[0]);

            if (action === 'add' && settings.welcome) {
                const welcomeMsg = `
${THEME.BORDERS.top}

${THEME.FONTS.bold("WELCOME TO GROUP")}

🌸 Welcome @${participants[0].split('@')[0]}!
🎯 You are member #${(await sock.groupMetadata(id)).participants.length}

${THEME.BORDERS.middle}
📌 Rules: No spam, No adult content
🔗 Follow our channel to use bot
${THEME.FONTS.footer}
                `.trim();

                await sock.sendMessage(id, {
                    text: welcomeMsg,
                    mentions: participants
                });
            }

            if (action === 'remove' && settings.goodbye) {
                await sock.sendMessage(id, {
                    text: `👋 Goodbye @${participants[0].split('@')[0]}! Hope to see you again. ${THEME.FLOWERS[0]}`,
                    mentions: participants
                });
            }
        } catch (error) {}
    });

    // 📞 CALL BLOCKER
    sock.ev.on('call', async (call) => {
        const settings = await SettingsManager.getSettings(sock.user?.id?.split(':')[0]);
        if (settings.antiCall) {
            await sock.rejectCall(call[0].id, call[0].from);
        }
    });

    // 🔄 KEEP ALIVE
    setInterval(() => {
        if (sock) {
            sock.sendPresenceUpdate('available').catch(() => {});
        }
    }, 30000);
}

// 4. THE ULTIMATE PAIRING ROUTE (FIXED)
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Missing Number" });

    try {
        // Clean old session
        const auth = await useFirebaseAuthState(db, "WT7_SESSIONS", "MASTER");
        await auth.clearSession();

        // Create temporary socket for pairing
        const tempSock = makeWASocket({
            auth: auth.state,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Safari")
        });

        // Save credentials
        tempSock.ev.on('creds.update', auth.saveCreds);

        // Get pairing code
        await delay(3000);
        let code = await tempSock.requestPairingCode(num.replace(/\D/g, ''));
        console.log(`✅ Code for ${num}: ${code}`);
        
        res.send({ 
            code,
            message: `📱 Go to WhatsApp → Settings → Linked Devices → Link a Device\n\n🔢 Enter this code: ${code}`
        });

        // Handle connection
        tempSock.ev.on('connection.update', async (u) => {
            if (u.connection === 'open') {
                console.log(`✅ ${num}: Paired successfully!`);
                // Close temporary socket and start main bot
                tempSock.end();
                await startBot();
            }
        });

        // Timeout after 2 minutes
        setTimeout(() => {
            if (tempSock) tempSock.end();
        }, 120000);

    } catch (e) {
        console.error('Pairing error:', e);
        res.status(500).send({ 
            error: "Pairing failed",
            solution: "Use international format: 254712345678"
        });
    }
});

// 🌐 WEB DASHBOARD
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>WRONG TURN 7 ULTIMATE</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #000;
            color: #ff0000;
            font-family: 'Courier New', monospace;
            padding: 20px;
            text-align: center;
        }
        .container {
            max-width: 800px;
            margin: 50px auto;
            border: 2px solid #ff0000;
            border-radius: 15px;
            padding: 30px;
            background: rgba(0,0,0,0.9);
        }
        h1 {
            font-size: 3em;
            margin-bottom: 20px;
            text-shadow: 0 0 10px #ff0000;
        }
        .btn {
            display: inline-block;
            margin: 20px;
            padding: 15px 30px;
            background: #ff0000;
            color: black;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
            font-size: 1.2em;
            transition: 0.3s;
        }
        .btn:hover {
            background: #ff3333;
            box-shadow: 0 0 20px #ff0000;
            transform: translateY(-3px);
        }
        .features {
            text-align: left;
            margin: 30px 0;
            padding: 20px;
            background: rgba(255,0,0,0.1);
            border-radius: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>WRONG TURN 7 🥀 ULTIMATE</h1>
        <p>Complete WhatsApp Bot by STANYTZ</p>
        
        <div class="features">
            <h3>🔥 All Features Included:</h3>
            <p>✅ Emoji Command System (Just send emoji)</p>
            <p>✅ Auto Typing/Recording</p>
            <p>✅ Auto Status View/Like/Reply</p>
            <p>✅ Anti-Link/Scam/Porn/Media</p>
            <p>✅ Anti-Delete & Anti-ViewOnce</p>
            <p>✅ AI Chat (User's Original Language)</p>
            <p>✅ Song & Video Downloader</p>
            <p>✅ Group Management</p>
            <p>✅ Always Online</p>
        </div>
        
        <a href="/pair" class="btn">🔗 PAIR WHATSAPP</a>
    </div>
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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #000;
            color: #ff0000;
            font-family: 'Courier New', monospace;
            padding: 20px;
            text-align: center;
        }
        .container {
            max-width: 500px;
            margin: 50px auto;
            border: 2px solid #ff0000;
            border-radius: 15px;
            padding: 30px;
            background: rgba(0,0,0,0.9);
        }
        input {
            width: 100%;
            padding: 15px;
            margin: 15px 0;
            background: #111;
            border: 1px solid #ff0000;
            color: white;
            border-radius: 10px;
            font-size: 1.1em;
            text-align: center;
        }
        button {
            width: 100%;
            padding: 15px;
            background: #ff0000;
            color: black;
            border: none;
            border-radius: 10px;
            font-size: 1.2em;
            font-weight: bold;
            cursor: pointer;
        }
        button:hover {
            background: #ff3333;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔗 PAIR WHATSAPP</h1>
        <p>Enter number with country code (e.g., 254712345678)</p>
        
        <input type="text" id="number" placeholder="254712345678" />
        <button onclick="getCode()">GET PAIRING CODE</button>
        
        <div id="result" style="margin-top: 20px; padding: 15px; border-radius: 10px; background: rgba(255,0,0,0.1); display: none;"></div>
    </div>

    <script>
        async function getCode() {
            const number = document.getElementById('number').value.trim();
            const result = document.getElementById('result');
            
            if (!number) {
                result.style.display = 'block';
                result.innerHTML = '⚠️ Please enter a number';
                return;
            }
            
            result.style.display = 'block';
            result.innerHTML = '🔄 Generating code...';
            
            try {
                const response = await fetch('/code?number=' + encodeURIComponent(number));
                const data = await response.json();
                
                if (data.code) {
                    result.innerHTML = \`✅ Code: <b>\${data.code}</b><br><br>\${data.message || ''}\`;
                } else {
                    result.innerHTML = \`❌ Error: \${data.error}\`;
                }
            } catch (error) {
                result.innerHTML = '❌ Connection failed';
            }
        }
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server Online: http://localhost:${PORT}`);
    console.log(`📱 Pair at: http://localhost:${PORT}/pair`);
    startBot();
});
