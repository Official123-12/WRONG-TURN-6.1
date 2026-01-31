// =======================================================
// 🤖 WRONG TURN 6 - ULTIMATE WHATSAPP BOT
// 🔥 Developer: STANYTZ
// 📅 Version: 6.0.0
// =======================================================

require('dotenv').config();
const { 
    default: makeWASocket, DisconnectReason, Browsers, delay, 
    fetchLatestBaileysVersion, makeCacheableSignalKeyStore, 
    getContentType, initAuthCreds, BufferJSON 
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, 
    deleteDoc, collection, getDocs, updateDoc } = require('firebase/firestore');
const express = require('express');
const pino = require('pino');
const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

// =======================================================
// 🛡️ GLOBAL ERROR SHIELDING
// =======================================================
process.on('unhandledRejection', (e) => console.log('🛡️ Rejection Shield:', e.message));
process.on('uncaughtException', (e) => console.log('🛡️ Exception Shield:', e.message));

// =======================================================
// 🔥 FIREBASE CONFIGURATION
// =======================================================
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
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

// =======================================================
// 🌐 EXPRESS SERVER SETUP
// =======================================================
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// =======================================================
// 📦 GLOBAL VARIABLES
// =======================================================
const commands = new Map();
const msgCache = new Map();
const activeSessions = new Map();
const commandUsage = new Map();
const userCooldowns = new Map();

// Constants
const newsletterJid = '120363404317544295@newsletter';
const groupJid = '120363406549688641@g.us';
const ownerNumber = process.env.OWNER_NUMBER || '255xxxxxxxxx';
const PREFIX = process.env.PREFIX || '.';

// Premium Forwarding Context
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: newsletterJid,
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
    }
};

// Bad Words List
const BAD_WORDS = [
    'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'whore', 'slut',
    'bastard', 'motherfucker', 'cunt', 'nigga', 'nigger', 'faggot', 'retard',
    'idiot', 'stupid', 'dumbass', 'bullshit', 'damn', 'hell', 'screw', 'crap'
];

// Scam Keywords
const SCAM_KEYWORDS = [
    'bundle', 'fixed match', 'earn money', 'investment', 'loan', 'quick money',
    'get rich', 'win money', 'lottery', 'free money', 'bitcoin', 'crypto',
    'investment plan', 'double money', 'money double', 'earn daily', 'job offer'
];

// =======================================================
// 🔐 AUTH STATE MANAGEMENT
// =======================================================
async function useFirebaseAuthState(db, collectionName, sessionId) {
    const sessionDoc = doc(db, collectionName, sessionId);
    
    const readState = async () => {
        try {
            const docSnap = await getDoc(sessionDoc);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.creds) {
                    return {
                        creds: JSON.parse(data.creds, BufferJSON.reviver),
                        keys: data.keys ? JSON.parse(data.keys, BufferJSON.reviver) : {}
                    };
                }
            }
            return { creds: initAuthCreds(), keys: {} };
        } catch (error) {
            console.error('Error reading state:', error);
            return { creds: initAuthCreds(), keys: {} };
        }
    };

    const saveCreds = async (creds) => {
        try {
            await setDoc(sessionDoc, {
                creds: JSON.stringify(creds, BufferJSON.replacer),
                updatedAt: new Date().toISOString(),
                sessionId: sessionId
            }, { merge: true });
        } catch (error) {
            console.error('Error saving creds:', error);
        }
    };

    const saveState = async (state) => {
        try {
            await setDoc(sessionDoc, {
                creds: JSON.stringify(state.creds, BufferJSON.replacer),
                keys: JSON.stringify(state.keys, BufferJSON.replacer),
                updatedAt: new Date().toISOString(),
                sessionId: sessionId
            }, { merge: true });
        } catch (error) {
            console.error('Error saving state:', error);
        }
    };

    const wipeSession = async () => {
        try {
            await deleteDoc(sessionDoc);
            return true;
        } catch (error) {
            console.error('Error wiping session:', error);
            return false;
        }
    };

    const state = await readState();
    
    return {
        state,
        saveCreds,
        saveState,
        wipeSession
    };
}

// =======================================================
// 🛡️ ADVANCED SECURITY SYSTEM
// =======================================================
async function armedSecurity(sock, m, settings, isOwner) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message?.conversation || m.message?.extendedTextMessage?.text || "").toLowerCase();
    const type = getContentType(m.message);

    // Skip security checks for owner or non-group messages
    if (isOwner || !from.endsWith('@g.us')) return false;

    // Security explanation function
    const explain = async (reason, action = 'deleted') => {
        try {
            await sock.sendMessage(from, { delete: m.key });
            const text = `╭── • 🥀 • ──╮\n\n` +
                        `❌ *SECURITY ACTION*\n\n` +
                        `ᴜꜱᴇʀ: @${sender.split('@')[0]}\n` +
                        `ᴀᴄᴛɪᴏɴ: ᴍᴇꜱꜱᴀɢᴇ ${action}\n` +
                        `ʀᴇᴀꜱᴏɴ: ${reason}\n\n` +
                        `╰── • 🥀 • ──╯\n` +
                        `_ꜱʏꜱᴛᴇᴍ: ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼_`;
            
            await sock.sendMessage(from, { 
                text, 
                mentions: [sender], 
                contextInfo: forwardedContext 
            });
        } catch (error) {
            console.error('Security explain error:', error);
        }
    };

    // 1. ANTI-LINK
    if (settings.antiLink && body.match(/https?:\/\/[^\s]+/gi)) {
        await explain("External link sharing is prohibited.");
        return true;
    }

    // 2. ANTI-BOT MESSAGES
    if (settings.antiBot && m.key.id.startsWith('BAE5')) {
        await explain("Bot-generated traffic detected.");
        return true;
    }

    // 3. ANTI-SCAM
    if (settings.antiScam && SCAM_KEYWORDS.some(word => body.includes(word))) {
        const metadata = await sock.groupMetadata(from);
        await sock.sendMessage(from, { 
            text: `╭── • 🥀 • ──╮\n\n` +
                  `‼️ *SCAM ALERT* ‼️\n\n` +
                  `@${sender.split('@')[0]} is spreading fraud!\n` +
                  `ᴘʀᴇᴄᴀᴜᴛɪᴏɴ ꜰᴏʀ ᴀʟʟ ᴍᴇᴍʙᴇʀꜱ.\n\n` +
                  `╰── • 🥀 • ──╯`,
            mentions: metadata.participants.map(v => v.id),
            contextInfo: forwardedContext 
        });
        await sock.sendMessage(from, { delete: m.key });
        await sock.groupParticipantsUpdate(from, [sender], "remove");
        return true;
    }

    // 4. ANTI-PORN
    const pornKeywords = /(porn|xxx|sex|ngono|vixen|🔞|nude|pussy|dick)/gi;
    if (settings.antiPorn && pornKeywords.test(body)) {
        await explain("Pornographic content prohibited.", "deleted & user removed");
        await sock.groupParticipantsUpdate(from, [sender], "remove");
        return true;
    }

    // 5. ANTI-BAD WORDS
    if (settings.antiBadWords && BAD_WORDS.some(word => body.includes(word))) {
        await explain("Inappropriate language detected.");
        return true;
    }

    // 6. ANTI-MEDIA
    if (settings.antiMedia && ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'].includes(type)) {
        await explain("Media sharing is currently disabled.");
        return true;
    }

    // 7. ANTI-TAG (excessive tagging)
    const tagCount = (body.match(/@/g) || []).length;
    if (settings.antiTag && tagCount > 5) {
        await explain("Excessive tagging detected (max 5 tags).");
        return true;
    }

    // 8. ANTI-FLOOD (message spam)
    const userKey = `${from}-${sender}`;
    if (!userCooldowns.has(userKey)) {
        userCooldowns.set(userKey, []);
    }
    
    const userMessages = userCooldowns.get(userKey);
    const now = Date.now();
    const recentMessages = userMessages.filter(time => now - time < 3000);
    
    if (recentMessages.length > 5) { // More than 5 messages in 3 seconds
        await explain("Flood/spam detected.");
        return true;
    }
    
    userMessages.push(now);
    if (userMessages.length > 10) userMessages.splice(0, 5);
    
    return false;
}

// =======================================================
// 🦾 MAIN BOT ENGINE
// =======================================================
async function startUserBot(num) {
    if (activeSessions.has(num)) {
        console.log(`⚠️ Session already active for: ${num}`);
        return;
    }

    console.log(`🚀 Starting bot for: ${num}`);
    
    try {
        const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
        const { version } = await fetchLatestBaileysVersion();

        // Create WhatsApp socket
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            version,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Desktop"),
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            printQRInTerminal: false,
            emitOwnEvents: false
        });

        // Store session
        activeSessions.set(num, sock);
        sock.ev.on('creds.update', saveCreds);

        // Connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(`✅ WRONG TURN 6 ARMED: [${num}]`);
                
                // Update active status
                await setDoc(doc(db, "ACTIVE_USERS", num), { 
                    active: true, 
                    lastActive: new Date().toISOString(),
                    user: sock.user?.id || num,
                    online: true
                }, { merge: true });
                
                // Send welcome message
                const welcome = `╭── • 🥀 • ──╮\n\n` +
                               `✨ WRONG TURN 6 ✨\n\n` +
                               `• System Armed & Operational\n` +
                               `• Dev: Stanytz\n` +
                               `• Status: Online\n` +
                               `• Prefix: ${PREFIX}\n\n` +
                               `Type ${PREFIX}help for commands\n\n` +
                               `╰── • 🥀 • ──╯\n` +
                               `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
                
                await sock.sendMessage(sock.user.id, { 
                    text: welcome, 
                    contextInfo: forwardedContext 
                });
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    console.log(`⚠️ Connection lost for ${num}, reconnecting...`);
                    activeSessions.delete(num);
                    setTimeout(() => startUserBot(num), 5000);
                } else {
                    console.log(`🚫 Logged out: ${num}`);
                    activeSessions.delete(num);
                    await setDoc(doc(db, "ACTIVE_USERS", num), { 
                        active: false, 
                        online: false 
                    }, { merge: true });
                }
            }
        });

        // Message handling
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0];
            if (!m.message) return;
            
            const from = m.key.remoteJid;
            const sender = m.key.participant || from;
            const body = (m.message.conversation || 
                         m.message.extendedTextMessage?.text || 
                         m.message.imageMessage?.caption || "").trim();
            const type = getContentType(m.message);

            // Cache message for anti-delete
            msgCache.set(m.key.id, { ...m, timestamp: Date.now() });
            
            // Clean old cache entries
            if (msgCache.size > 1000) {
                const keys = Array.from(msgCache.keys());
                for (let i = 0; i < 100; i++) {
                    msgCache.delete(keys[i]);
                }
            }

            // Check if owner
            const isOwner = sender.startsWith(ownerNumber) || m.key.fromMe || sender.includes(ownerNumber);

            // Get user settings
            let settings;
            try {
                const settingsDoc = await getDoc(doc(db, "SETTINGS", num));
                settings = settingsDoc.exists() ? settingsDoc.data() : {
                    prefix: PREFIX,
                    mode: "public",
                    autoAI: true,
                    forceJoin: true,
                    autoStatus: true,
                    antiDelete: true,
                    antiViewOnce: true,
                    antiLink: true,
                    antiTag: true,
                    antiScam: true,
                    antiPorn: true,
                    antiBadWords: true,
                    antiMedia: false,
                    antiBot: true,
                    autoReact: true,
                    welcomeMessage: true,
                    goodbyeMessage: true,
                    autoReply: true
                };
            } catch (error) {
                settings = { prefix: PREFIX, mode: "public", autoAI: true };
            }

            // Private mode check
            if (settings.mode === "private" && !isOwner) return;

            // ========================================
            // 🎯 FEATURE EXECUTION
            // ========================================

            // A. AUTO REACT
            if (settings.autoReact && !m.key.fromMe && from.endsWith('@g.us')) {
                try {
                    await sock.sendMessage(from, { react: { text: '🥀', key: m.key } });
                } catch (error) {}
            }

            // B. AUTO TYPING INDICATOR
            if (!m.key.fromMe) {
                try {
                    await sock.sendPresenceUpdate('composing', from);
                    setTimeout(() => sock.sendPresenceUpdate('paused', from), 2000);
                } catch (error) {}
            }

            // C. SECURITY CHECKS
            try {
                if (await armedSecurity(sock, m, settings, isOwner)) return;
            } catch (error) {
                console.error('Security check error:', error);
            }

            // D. ANTI-DELETE
            if (m.message?.protocolMessage?.type === 0 && settings.antiDelete && !m.key.fromMe) {
                try {
                    const cached = msgCache.get(m.message.protocolMessage.key.id);
                    if (cached) {
                        const warning = `╭── • 🥀 • ──╮\n\n` +
                                      `🛡️ *ANTI-DELETE*\n\n` +
                                      `ᴜꜱᴇʀ: @${sender.split('@')[0]}\n` +
                                      `ɢʀᴏᴜᴘ: ${from.split('@')[0]}\n` +
                                      `ᴛɪᴍᴇ: ${new Date().toLocaleTimeString()}\n\n` +
                                      `╰── • 🥀 • ──╯`;
                        
                        await sock.sendMessage(sock.user.id, { 
                            text: warning, 
                            mentions: [sender] 
                        });
                        await sock.copyNForward(sock.user.id, cached, false, { 
                            contextInfo: forwardedContext 
                        });
                    }
                } catch (error) {
                    console.error('Anti-delete error:', error);
                }
            }

            // E. ANTI-VIEW-ONCE
            if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && settings.antiViewOnce) {
                try {
                    await sock.sendMessage(sock.user.id, { 
                        text: `╭── • 🥀 • ──╮\n\n🛡️ *ANTI-VIEWONCE*\n\nᴜꜱᴇʀ: @${sender.split('@')[0]}\n\n╰── • 🥀 • ──╯`,
                        mentions: [sender]
                    });
                    await sock.copyNForward(sock.user.id, m, false, { 
                        contextInfo: forwardedContext 
                    });
                } catch (error) {
                    console.error('Anti-viewonce error:', error);
                }
            }

            // F. FORCE JOIN CHECK
            const isCommand = body.startsWith(settings.prefix) || commands.has(body.split(' ')[0].toLowerCase());
            if (isCommand && !isOwner && settings.forceJoin) {
                try {
                    const metadata = await sock.groupMetadata(groupJid);
                    const isMember = metadata.participants.some(p => p.id === sender);
                    if (!isMember) {
                        const denyMsg = `╭── • 🥀 • ──╮\n\n` +
                                      `❌ *ACCESS DENIED*\n\n` +
                                      `• You must join our group\n` +
                                      `• To use this bot\n\n` +
                                      `🔗 https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y\n\n` +
                                      `╰── • 🥀 • ──╯`;
                        
                        return sock.sendMessage(from, { 
                            text: denyMsg, 
                            contextInfo: forwardedContext 
                        });
                    }
                } catch (error) {}
            }

            // G. STATUS AUTO-REPLY
            if (from === 'status@broadcast' && settings.autoStatus && isOwner) {
                try {
                    await sock.readMessages([m.key]);
                    
                    const aiResponse = await axios.get(
                        `https://text.pollinations.ai/` +
                        `As WRONG TURN 6 bot, reply to this status naturally and briefly: "${body}"`
                    );
                    
                    await sock.sendMessage(from, { 
                        text: `╭── • 🥀 • ──╮\n\n${aiResponse.data}\n\n╰── • 🥀 • ──╯`, 
                        contextInfo: forwardedContext 
                    }, { quoted: m });
                    
                    await sock.sendMessage(from, { 
                        react: { text: '🥀', key: m.key } 
                    }, { statusJidList: [sender] });
                } catch (error) {
                    console.error('Status reply error:', error);
                }
            }

            // H. AI AUTO-REPLY (PRIVATE CHAT)
            if (!isCommand && !m.key.fromMe && settings.autoAI && 
                body.length > 2 && !from.endsWith('@g.us')) {
                try {
                    const aiPrompt = `You are WRONG TURN 6 WhatsApp bot. ` +
                                   `Developer: STANYTZ. ` +
                                   `Reply naturally and helpfully in the user's language to: ${body}`;
                    
                    const aiRes = await axios.get(
                        `https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`,
                        { timeout: 10000 }
                    );
                    
                    const aiText = `╭── • 🥀 • ──╮\n\n` +
                                 `✨ WRONG TURN 6 ✨\n\n` +
                                 `${aiRes.data}\n\n` +
                                 `╰── • 🥀 • ──╯\n` +
                                 `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
                    
                    await sock.sendMessage(from, { 
                        text: aiText, 
                        contextInfo: forwardedContext 
                    }, { quoted: m });
                } catch (error) {
                    console.error('AI reply error:', error);
                }
            }

            // I. REPLY-BY-NUMBER COMMAND EXECUTION
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedText = (quoted?.conversation || quoted?.extendedTextMessage?.text || "").toLowerCase();
            
            if (quoted && !isNaN(body) && body.length > 0) {
                for (let [name, cmdObj] of commands) {
                    if (quotedText.includes(name)) {
                        try {
                            await cmdObj.execute(m, sock, Array.from(commands.values()), 
                                                [body.trim()], db, forwardedContext);
                            return;
                        } catch (error) {
                            console.error('Reply-by-number error:', error);
                        }
                    }
                }
            }

            // J. COMMAND EXECUTION (WITH/WITHOUT PREFIX)
            let cmdName = '';
            let args = [];
            
            // Check if message starts with prefix
            if (body.startsWith(settings.prefix)) {
                cmdName = body.slice(settings.prefix.length).trim().split(/ +/)[0].toLowerCase();
                args = body.slice(settings.prefix.length).trim().split(/ +/).slice(1);
            } else {
                // Check if first word is a command without prefix
                const firstWord = body.split(' ')[0].toLowerCase();
                if (commands.has(firstWord)) {
                    cmdName = firstWord;
                    args = body.split(' ').slice(1);
                }
            }
            
            const cmd = commands.get(cmdName);
            
            if (cmd) {
                try {
                    // Check cooldown
                    const cooldownKey = `${sender}-${cmdName}`;
                    const lastUsed = commandUsage.get(cooldownKey) || 0;
                    const cooldownTime = cmd.cooldown || 3000;
                    
                    if (Date.now() - lastUsed < cooldownTime && !isOwner) {
                        const waitTime = Math.ceil((cooldownTime - (Date.now() - lastUsed)) / 1000);
                        await sock.sendMessage(from, {
                            text: `╭── • 🥀 • ──╮\n\n⏳ Please wait ${waitTime} seconds before using ${cmdName} again.\n\n╰── • 🥀 • ──╯`,
                            contextInfo: forwardedContext
                        });
                        return;
                    }
                    
                    commandUsage.set(cooldownKey, Date.now());
                    
                    // Execute command
                    await cmd.execute(m, sock, Array.from(commands.values()), 
                                     args, db, forwardedContext);
                    
                } catch (error) {
                    console.error(`Command error ${cmdName}:`, error);
                    const errorMsg = `╭── • 🥀 • ──╮\n\n` +
                                   `❌ *COMMAND ERROR*\n\n` +
                                   `ᴄᴏᴍᴍᴀɴᴅ: ${cmdName}\n` +
                                   `ᴇʀʀᴏʀ: ${error.message}\n\n` +
                                   `╰── • 🥀 • ──╯\n` +
                                   `_ᴄᴏɴᴛᴀᴄᴛ ᴅᴇᴠᴇʟᴏᴘᴇʀ ꜰᴏʀ ꜱᴜᴘᴘᴏʀᴛ_`;
                    
                    await sock.sendMessage(from, { 
                        text: errorMsg, 
                        contextInfo: forwardedContext 
                    });
                }
            }

            // K. ACTIVITY TRACKING
            if (from.endsWith('@g.us')) {
                try {
                    await setDoc(doc(db, "ACTIVITY", from), { 
                        [sender]: Date.now(),
                        lastMessage: body.substring(0, 100),
                        timestamp: new Date().toISOString()
                    }, { merge: true });
                } catch (error) {}
            }
        });

        // Group updates (welcome/goodbye messages)
        sock.ev.on('group-participants.update', async (update) => {
            try {
                const { id, participants, action } = update;
                const settingsDoc = await getDoc(doc(db, "SETTINGS", num));
                const settings = settingsDoc.exists() ? settingsDoc.data() : {};
                
                if (action === 'add' && settings.welcomeMessage) {
                    for (let participant of participants) {
                        const welcomeMsg = `╭── • 🥀 • ──╮\n\n` +
                                         `✨ WELCOME ✨\n\n` +
                                         `• Welcome @${participant.split('@')[0]}\n` +
                                         `• To the group\n` +
                                         `• Enjoy your stay\n\n` +
                                         `╰── • 🥀 • ──╯\n` +
                                         `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀`;
                        
                        await sock.sendMessage(id, {
                            text: welcomeMsg,
                            mentions: [participant],
                            contextInfo: forwardedContext
                        });
                    }
                }
                
                if (action === 'remove' && settings.goodbyeMessage) {
                    for (let participant of participants) {
                        const goodbyeMsg = `╭── • 🥀 • ──╮\n\n` +
                                         `👋 GOODBYE 👋\n\n` +
                                         `• Goodbye @${participant.split('@')[0]}\n` +
                                         `• See you next time\n\n` +
                                         `╰── • 🥀 • ──╯\n` +
                                         `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀`;
                        
                        await sock.sendMessage(id, {
                            text: goodbyeMsg,
                            mentions: [participant],
                            contextInfo: forwardedContext
                        });
                    }
                }
            } catch (error) {
                console.error('Group update error:', error);
            }
        });

    } catch (error) {
        console.error(`Failed to start bot for ${num}:`, error);
        activeSessions.delete(num);
        await setDoc(doc(db, "ACTIVE_USERS", num), { 
            active: false, 
            error: error.message 
        }, { merge: true });
    }
}

// =======================================================
// 🌐 API ENDPOINTS ONLY (NO HTML)
// =======================================================

// Home redirect to public/index.html
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// Pairing API - WORKING VERSION
app.get('/api/pair', async (req, res) => {
    let { number } = req.query;
    
    if (!number) {
        return res.json({ 
            success: false, 
            error: "Phone number is required",
            tips: "Enter your WhatsApp number with country code"
        });
    }
    
    // Clean number
    number = number.replace(/\D/g, '');
    
    console.log(`🔐 Pairing request received for: ${number}`);
    
    try {
        // Basic validation
        if (number.length < 9) {
            return res.json({ 
                success: false, 
                error: "Invalid phone number",
                tips: "Use format: 255123456789 (without +)"
            });
        }
        
        // Check if already active
        if (activeSessions.has(number)) {
            return res.json({ 
                success: false, 
                error: "Session already active",
                tips: "Logout first via /api/logout?number=" + number
            });
        }
        
        // Use fresh auth state
        const { state, saveCreds, wipeSession } = await useFirebaseAuthState(db, "WT6_SESSIONS", number);
        
        // Get latest Baileys version
        const { version } = await fetchLatestBaileysVersion();
        
        console.log(`📡 Creating pairing socket...`);
        
        // Create pairing socket with WhatsApp Web compatible settings
        const pairSocket = makeWASocket({
            auth: {
                creds: state.creds || initAuthCreds(),
                keys: makeCacheableSignalKeyStore(state.keys || {}, pino({ level: 'silent' }))
            },
            version,
            logger: pino({ level: 'silent' }),
            browser: ['Chrome', 'Windows', '10'], // Most compatible
            printQRInTerminal: false,
            connectTimeoutMs: 30000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: false,
            syncFullHistory: false,
            fireInitQueries: true,
            retryRequestDelayMs: 1000
        });
        
        // Save credentials when updated
        pairSocket.ev.on('creds.update', saveCreds);
        
        // Wait for socket initialization
        await delay(5000);
        
        console.log(`📞 Requesting pairing code from WhatsApp...`);
        
        // Request pairing code
        const pairingCode = await pairSocket.requestPairingCode(number);
        
        if (!pairingCode) {
            throw new Error("WhatsApp didn't return a pairing code");
        }
        
        console.log(`✅ Pairing code generated: ${pairingCode}`);
        
        // Mark as active in database
        await setDoc(doc(db, "ACTIVE_USERS", number), {
            active: true,
            pairedAt: new Date().toISOString(),
            code: pairingCode,
            status: 'paired'
        }, { merge: true });
        
        // Handle successful connection
        pairSocket.ev.on('connection.update', async (update) => {
            const { connection } = update;
            
            if (connection === 'open') {
                console.log(`🎉 Device paired successfully for ${number}`);
                
                // Save final credentials
                if (pairSocket.authState.creds) {
                    await saveCreds(pairSocket.authState.creds);
                }
                
                // Update database
                await setDoc(doc(db, "ACTIVE_USERS", number), {
                    connectedAt: new Date().toISOString(),
                    status: 'connected'
                }, { merge: true });
                
                // Close pairing socket after delay
                setTimeout(() => {
                    try {
                        pairSocket.ws?.close();
                        pairSocket.end?.();
                        console.log(`🔒 Pairing socket closed for ${number}`);
                    } catch (e) {}
                }, 5000);
                
                // Start main bot after delay
                setTimeout(() => {
                    console.log(`🚀 Starting main bot for ${number}`);
                    startUserBot(number);
                }, 3000);
            }
            
            if (connection === 'close') {
                console.log(`⚠️ Pairing connection closed for ${number}`);
            }
        });
        
        // Auto-cleanup after 5 minutes
        setTimeout(() => {
            if (!pairSocket.user?.id) {
                try {
                    pairSocket.ws?.close();
                    pairSocket.end?.();
                    console.log(`🕐 Cleared pairing socket for ${number} (timeout)`);
                } catch (e) {}
            }
        }, 300000);
        
        // Return success response
        res.json({
            success: true,
            code: pairingCode,
            message: "Enter this 6-digit code in WhatsApp > Linked Devices",
            instructions: "1. Open WhatsApp 2. Menu → Linked Devices 3. Link a Device 4. Enter code",
            expires: "5 minutes"
        });
        
    } catch (error) {
        console.error(`🔥 Pairing Error for ${number}:`, error.message);
        
        // Clear any locks
        try {
            await setDoc(doc(db, "WT6_SESSIONS", number), {
                error: error.message,
                timestamp: new Date().toISOString()
            }, { merge: true });
        } catch (e) {}
        
        // User-friendly error messages
        let errorMessage = "WhatsApp pairing failed. Please try again.";
        let tips = "Ensure WhatsApp is updated and internet is stable.";
        let solution = "Wait 30 seconds and try again";
        
        if (error.message.includes('not registered')) {
            errorMessage = "This number is not registered on WhatsApp.";
            tips = "Make sure you have WhatsApp installed with this number.";
            solution = "Verify your phone number and try again";
        } else if (error.message.includes('timeout')) {
            errorMessage = "Connection timeout. WhatsApp servers are busy.";
            tips = "Try again in 1-2 minutes.";
            solution = "Check your internet connection";
        } else if (error.message.includes('rate limit')) {
            errorMessage = "Too many pairing attempts.";
            tips = "WhatsApp limits pairing attempts for security.";
            solution = "Wait 10 minutes before trying again";
        } else if (error.message.includes('code')) {
            errorMessage = "Failed to get pairing code.";
            tips = "Try restarting your phone's WhatsApp.";
            solution = "Clear WhatsApp cache and restart app";
        }
        
        res.json({
            success: false,
            error: errorMessage,
            tips: tips,
            solution: solution
        });
    }
});

// Stats API
app.get('/api/stats', (req, res) => {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    res.json({
        success: true,
        bot: 'WRONG TURN 6',
        version: '6.0.0',
        activeSessions: activeSessions.size,
        uptime: `${days}d ${hours}h ${minutes}m`,
        uptimeSeconds: Math.floor(uptime),
        memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        commands: commands.size,
        status: 'operational',
        deployment: 'railway.app',
        timestamp: new Date().toISOString()
    });
});

// Sessions API
app.get('/api/sessions', async (req, res) => {
    try {
        const sessionsSnap = await getDocs(collection(db, "ACTIVE_USERS"));
        const sessions = [];
        
        sessionsSnap.forEach(doc => {
            sessions.push({ 
                id: doc.id, 
                ...doc.data(),
                active: doc.data().active || false
            });
        });
        
        res.json({
            success: true,
            total: sessions.length,
            active: sessions.filter(s => s.active).length,
            sessions: sessions
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Logout API
app.get('/api/logout', async (req, res) => {
    const { number } = req.query;
    
    if (!number) {
        return res.json({ 
            success: false, 
            error: "Phone number is required" 
        });
    }
    
    try {
        // Close active session
        const sock = activeSessions.get(number);
        if (sock) {
            try {
                sock.logout();
                activeSessions.delete(number);
            } catch (e) {}
        }
        
        // Clear from database
        const { wipeSession } = await useFirebaseAuthState(db, "WT6_SESSIONS", number);
        await wipeSession();
        
        await setDoc(doc(db, "ACTIVE_USERS", number), { 
            active: false,
            online: false,
            loggedOutAt: new Date().toISOString()
        }, { merge: true });
        
        res.json({
            success: true,
            message: "Successfully logged out and session cleared",
            number: number
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        bot: 'WRONG TURN 6',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// =======================================================
// ⚙️ COMMAND LOADING
// =======================================================
function loadCommands() {
    const cmdPath = path.resolve(__dirname, 'commands');
    
    if (!fs.existsSync(cmdPath)) {
        console.log('📁 Creating commands directory...');
        fs.ensureDirSync(cmdPath);
        fs.ensureDirSync(path.join(cmdPath, 'owner'));
        fs.ensureDirSync(path.join(cmdPath, 'general'));
        fs.ensureDirSync(path.join(cmdPath, 'admin'));
        
        // Create help command
        const helpCmd = `
module.exports = {
    name: 'help',
    description: 'Show all commands',
    category: 'general',
    cooldown: 3000,
    async execute(m, sock, commands, args, db, context) {
        const from = m.key.remoteJid;
        let helpText = '╭── • 🥀 • ──╮\\n\\n';
        helpText += '✨ WRONG TURN 6 ✨\\n\\n';
        helpText += '📖 *AVAILABLE COMMANDS*\\n\\n';
        
        const categories = {};
        commands.forEach(cmd => {
            if (!categories[cmd.category]) categories[cmd.category] = [];
            categories[cmd.category].push(cmd);
        });
        
        for (const [category, cmds] of Object.entries(categories)) {
            helpText += \`📁 *\${category.toUpperCase()}*\\n\`;
            cmds.forEach(cmd => {
                helpText += \`• \${cmd.name}\`;
                if (cmd.description) helpText += \` - \${cmd.description}\`;
                helpText += '\\n';
            });
            helpText += '\\n';
        }
        
        helpText += '\\n╰── • 🥀 • ──╯\\n';
        helpText += '_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_';
        
        await sock.sendMessage(from, { 
            text: helpText,
            contextInfo: context
        });
    }
};
        `;
        
        fs.writeFileSync(path.join(cmdPath, 'general', 'help.js'), helpCmd);
        
        // Create ping command
        const pingCmd = `
module.exports = {
    name: 'ping',
    description: 'Check bot response time',
    category: 'general',
    cooldown: 3000,
    async execute(m, sock, commands, args, db, context) {
        const from = m.key.remoteJid;
        const start = Date.now();
        await sock.sendMessage(from, {
            text: '╭── • 🥀 • ──╮\\n\\n🏓 Pong!\\n\\n╰── • 🥀 • ──╯',
            contextInfo: context
        });
        const latency = Date.now() - start;
        await sock.sendMessage(from, {
            text: \`╭── • 🥀 • ──╮\\n\\n📊 Response time: \${latency}ms\\n\\n╰── • 🥀 • ──╯\`,
            contextInfo: context
        });
    }
};
        `;
        
        fs.writeFileSync(path.join(cmdPath, 'general', 'ping.js'), pingCmd);
    }
    
    // Load commands from all categories
    const categories = fs.readdirSync(cmdPath).filter(f => 
        fs.lstatSync(path.join(cmdPath, f)).isDirectory()
    );
    
    let totalCommands = 0;
    
    categories.forEach(category => {
        const categoryPath = path.join(cmdPath, category);
        const commandFiles = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
        
        commandFiles.forEach(file => {
            try {
                delete require.cache[require.resolve(path.join(categoryPath, file))];
                const cmd = require(path.join(categoryPath, file));
                if (cmd && cmd.name) {
                    cmd.category = category;
                    commands.set(cmd.name.toLowerCase(), cmd);
                    totalCommands++;
                    console.log(`✅ Loaded command: ${cmd.name} (${category})`);
                }
            } catch (error) {
                console.error(`❌ Failed to load command ${file}:`, error.message);
            }
        });
    });
    
    console.log(`📦 Total commands loaded: ${totalCommands}`);
    return totalCommands;
}

// =======================================================
// 🔄 ALWAYS-ONLINE SYSTEM
// =======================================================
function startKeepAliveSystem() {
    console.log('🔄 Starting keep-alive system...');
    
    // Keep sessions alive every 30 seconds
    setInterval(async () => {
        for (const [num, sock] of activeSessions.entries()) {
            try {
                if (sock.user && sock.connection === 'open') {
                    // Update presence
                    await sock.sendPresenceUpdate('available');
                    
                    // Update profile status periodically
                    const uptime = process.uptime();
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    
                    if (Math.random() > 0.7) { // Randomly update status
                        await sock.updateProfileStatus(
                            `WRONG TURN 6 | ONLINE | ${hours}h ${minutes}m | 🥀`
                        ).catch(() => {});
                    }
                    
                    // Update database
                    await setDoc(doc(db, "ACTIVE_USERS", num), {
                        lastPing: new Date().toISOString(),
                        uptime: `${hours}h ${minutes}m`,
                        online: true
                    }, { merge: true });
                }
            } catch (error) {
                console.error(`Keep-alive error for ${num}:`, error.message);
            }
        }
    }, 30000);
    
    // Auto-restart dead sessions every 5 minutes
    setInterval(async () => {
        try {
            const activeSnap = await getDocs(collection(db, "ACTIVE_USERS"));
            const restorePromises = [];
            
            activeSnap.forEach(async (docSnap) => {
                const data = docSnap.data();
                const num = docSnap.id;
                
                if (data.active && !activeSessions.has(num)) {
                    console.log(`🔄 Auto-restarting session for: ${num}`);
                    restorePromises.push(startUserBot(num));
                }
            });
            
            await Promise.allSettled(restorePromises);
        } catch (error) {
            console.error('Auto-restart error:', error);
        }
    }, 300000);
    
    console.log('✅ Keep-alive system started');
}

// =======================================================
// 🚀 SERVER STARTUP
// =======================================================
const PORT = process.env.PORT || 3000;

async function initializeBot() {
    console.log(`
    ╭── • 🥀 • ──╮
    
         WRONG TURN 6
      Developed by STANYTZ
        Version: 6.0.0
       Status: ARMED & READY
    
    ╰── • 🥀 • ──╯
    `);
    
    // Load commands
    const totalCommands = loadCommands();
    
    // Start keep-alive system
    startKeepAliveSystem();
    
    // Restore active sessions
    try {
        const activeSnap = await getDocs(collection(db, "ACTIVE_USERS"));
        let restored = 0;
        
        for (const docSnap of activeSnap.docs) {
            const data = docSnap.data();
            const num = docSnap.id;
            
            if (data.active && !activeSessions.has(num)) {
                console.log(`♻️ Restoring session: ${num}`);
                await startUserBot(num);
                restored++;
                // Delay between restarts to avoid rate limiting
                await delay(2000);
            }
        }
        
        console.log(`✅ Restored ${restored} active sessions`);
    } catch (error) {
        console.error('Session restore error:', error);
    }
    
    // Start server
    app.listen(PORT, () => {
        console.log(`
    🌐 SERVER STATUS:
    ├── Port: ${PORT}
    ├── Active Sessions: ${activeSessions.size}
    ├── Commands Loaded: ${totalCommands}
    ├── Dashboard: http://localhost:${PORT}
    ├── Pairing: http://localhost:${PORT}/pair.html
    ├── Health: http://localhost:${PORT}/health
    └── API Stats: http://localhost:${PORT}/api/stats
    
    📡 BOT IS NOW ARMED AND OPERATIONAL!
    🚀 READY FOR DEPLOYMENT ON RAILWAY!
        `);
    });
}

// =======================================================
// 🛑 GRACEFUL SHUTDOWN
// =======================================================
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down WRONG TURN 6...');
    
    // Mark all sessions as inactive
    for (const num of activeSessions.keys()) {
        try {
            await setDoc(doc(db, "ACTIVE_USERS", num), { 
                active: false,
                online: false,
                shutdownAt: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error(`Error saving session ${num}:`, error.message);
        }
    }
    
    console.log('✅ All sessions saved. Goodbye!');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n⚠️ Received SIGTERM. Graceful shutdown...');
    process.exit(0);
});

// =======================================================
// 🚀 START THE BOT
// =======================================================
initializeBot().catch(error => {
    console.error('❌ Failed to initialize bot:', error);
    process.exit(1);
});

// Export for testing
module.exports = { app, activeSessions, commands };
