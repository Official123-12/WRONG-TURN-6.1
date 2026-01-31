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
                return {
                    creds: data.creds ? JSON.parse(data.creds, BufferJSON.reviver) : initAuthCreds(),
                    keys: data.keys ? JSON.parse(data.keys, BufferJSON.reviver) : {}
                };
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
            const text = `❌ *ꜱᴇᴄᴜʀɪᴛʏ ᴀᴄᴛɪᴏɴ*\n\n` +
                        `ᴜꜱᴇʀ: @${sender.split('@')[0]}\n` +
                        `ᴀᴄᴛɪᴏɴ: ᴍᴇꜱꜱᴀɢᴇ ${action}\n` +
                        `ʀᴇᴀꜱᴏɴ: ${reason}\n\n` +
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
            text: `‼️ *ꜱᴄᴀᴍ ᴀʟᴇʀᴛ* ‼️\n` +
                  `@${sender.split('@')[0]} is spreading fraud!\n` +
                  `ᴘʀᴇᴄᴀᴜᴛɪᴏɴ ꜰᴏʀ ᴀʟʟ ᴍᴇᴍʙᴇʀꜱ.`,
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
            keepAliveIntervalMs: 30000
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
                    user: sock.user?.id || num
                }, { merge: true });
                
                // Send welcome message
                const welcome = `╔═══════════════════╗\n` +
                               `       ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼\n` +
                               `╚═══════════════════╝\n\n` +
                               `• ꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\n` +
                               `• ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\n` +
                               `• ꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ\n` +
                               `• ᴘʀᴇꜰɪx: ${PREFIX}\n\n` +
                               `ᴛʏᴘᴇ ${PREFIX}ʜᴇʟᴘ ꜰᴏʀ ᴄᴏᴍᴍᴀɴᴅꜱ`;
                
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
                    await setDoc(doc(db, "ACTIVE_USERS", num), { active: false }, { merge: true });
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
                        const warning = `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ*\n\n` +
                                      `ᴜꜱᴇʀ: @${sender.split('@')[0]}\n` +
                                      `ɢʀᴏᴜᴘ: ${from.split('@')[0]}\n` +
                                      `ᴛɪᴍᴇ: ${new Date().toLocaleTimeString()}`;
                        
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
                        text: `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ*\nᴜꜱᴇʀ: @${sender.split('@')[0]}`,
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
                        const denyMsg = `╔═══════════════════╗\n` +
                                      `     ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ\n` +
                                      `╚═══════════════════╝\n\n` +
                                      `• ʏᴏᴜ ᴍᴜꜱᴛ ᴊᴏɪɴ ᴏᴜʀ ɢʀᴏᴜᴘ\n` +
                                      `• ᴛᴏ ᴜꜱᴇ ᴛʜɪꜱ ʙᴏᴛ\n\n` +
                                      `🔗 https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y`;
                        
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
                        text: aiResponse.data, 
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
                    
                    const aiText = `╔═══════════════════╗\n` +
                                 `       ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼\n` +
                                 `╚═══════════════════╝\n\n` +
                                 `${aiRes.data}\n\n` +
                                 `_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
                    
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

            // J. COMMAND EXECUTION
            let cmdName = body.startsWith(settings.prefix) 
                ? body.slice(settings.prefix.length).trim().split(/ +/)[0].toLowerCase()
                : body.split(' ')[0].toLowerCase();
            
            let args = body.startsWith(settings.prefix)
                ? body.slice(settings.prefix.length).trim().split(/ +/).slice(1)
                : body.split(' ').slice(1);
            
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
                            text: `⏳ Please wait ${waitTime} seconds before using ${settings.prefix}${cmdName} again.`,
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
                    const errorMsg = `❌ *ᴄᴏᴍᴍᴀɴᴅ ᴇʀʀᴏʀ*\n\n` +
                                   `ᴄᴏᴍᴍᴀɴᴅ: ${settings.prefix}${cmdName}\n` +
                                   `ᴇʀʀᴏʀ: ${error.message}\n\n` +
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
                        const welcomeMsg = `╔═══════════════════╗\n` +
                                         `       ᴡᴇʟᴄᴏᴍᴇ\n` +
                                         `╚═══════════════════╝\n\n` +
                                         `• ᴡᴇʟᴄᴏᴍᴇ @${participant.split('@')[0]}\n` +
                                         `• ᴛᴏ ᴛʜᴇ ɢʀᴏᴜᴘ\n` +
                                         `• ᴇɴᴊᴏʏ ʏᴏᴜʀ ꜱᴛᴀʏ\n\n` +
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
                        const goodbyeMsg = `╔═══════════════════╗\n` +
                                         `       ɢᴏᴏᴅʙʏᴇ\n` +
                                         `╚═══════════════════╝\n\n` +
                                         `• ɢᴏᴏᴅʙʏᴇ @${participant.split('@')[0]}\n` +
                                         `• ꜱᴇᴇ ʏᴏᴜ ɴᴇxᴛ ᴛɪᴍᴇ\n\n` +
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
    }
}

// =======================================================
// 🌐 WEB INTERFACE ROUTES
// =======================================================

// Main Dashboard
app.get('/', (req, res) => {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    res.status(200).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WRONG TURN 6</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    background: linear-gradient(135deg, #000000, #1a0000, #330000);
                    color: #ff0000;
                    font-family: 'Courier New', monospace;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 20px;
                    background-attachment: fixed;
                }
                
                .container {
                    max-width: 800px;
                    width: 100%;
                    text-align: center;
                }
                
                .logo {
                    width: 180px;
                    height: 180px;
                    border-radius: 50%;
                    border: 3px solid #ff0000;
                    margin: 30px auto;
                    overflow: hidden;
                    box-shadow: 0 0 30px rgba(255, 0, 0, 0.5);
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { box-shadow: 0 0 30px rgba(255, 0, 0, 0.5); }
                    50% { box-shadow: 0 0 50px rgba(255, 0, 0, 0.8); }
                }
                
                .logo img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                h1 {
                    font-size: 3em;
                    letter-spacing: 15px;
                    margin: 20px 0;
                    text-transform: uppercase;
                    text-shadow: 0 0 10px #ff0000;
                }
                
                .status {
                    font-size: 1.5em;
                    letter-spacing: 5px;
                    margin: 20px 0;
                }
                
                .status span {
                    color: #00ff00;
                    font-weight: bold;
                }
                
                .stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin: 30px 0;
                    padding: 20px;
                    background: rgba(255, 0, 0, 0.1);
                    border-radius: 15px;
                    border: 1px solid rgba(255, 0, 0, 0.3);
                }
                
                .stat-box {
                    padding: 15px;
                    background: rgba(0, 0, 0, 0.5);
                    border-radius: 10px;
                    border: 1px solid rgba(255, 0, 0, 0.2);
                }
                
                .stat-title {
                    color: #ff6666;
                    font-size: 0.9em;
                    margin-bottom: 5px;
                }
                
                .stat-value {
                    color: #fff;
                    font-size: 1.8em;
                    font-weight: bold;
                }
                
                .btn-container {
                    margin: 40px 0;
                }
                
                .btn {
                    display: inline-block;
                    padding: 15px 40px;
                    margin: 10px;
                    background: linear-gradient(45deg, #ff0000, #cc0000);
                    color: white;
                    text-decoration: none;
                    border-radius: 30px;
                    font-weight: bold;
                    font-size: 1.1em;
                    letter-spacing: 2px;
                    transition: all 0.3s;
                    border: 2px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 5px 15px rgba(255, 0, 0, 0.3);
                }
                
                .btn:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 20px rgba(255, 0, 0, 0.5);
                    background: linear-gradient(45deg, #ff3333, #ff0000);
                }
                
                .dev-info {
                    margin-top: 50px;
                    padding: 20px;
                    border-top: 1px solid rgba(255, 0, 0, 0.3);
                    color: #666;
                    font-size: 0.9em;
                }
                
                .feature-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 15px;
                    margin: 30px 0;
                    padding: 20px;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 15px;
                }
                
                .feature {
                    text-align: left;
                    padding: 10px;
                    color: #ff9999;
                }
                
                .feature::before {
                    content: "✓";
                    color: #00ff00;
                    margin-right: 10px;
                }
                
                @media (max-width: 600px) {
                    h1 { font-size: 2em; letter-spacing: 10px; }
                    .stats { grid-template-columns: 1fr; }
                    .btn { padding: 12px 30px; font-size: 1em; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">
                    <img src="https://files.catbox.moe/59ays3.jpg" alt="WRONG TURN 6 Logo">
                </div>
                
                <h1>W R O N G  T U R N  6</h1>
                
                <div class="status">
                    MAINFRAME STATUS: <span>⚡ ARMED & OPERATIONAL</span>
                </div>
                
                <div class="stats">
                    <div class="stat-box">
                        <div class="stat-title">ACTIVE SESSIONS</div>
                        <div class="stat-value">${activeSessions.size}</div>
                    </div>
                    
                    <div class="stat-box">
                        <div class="stat-title">UPTIME</div>
                        <div class="stat-value">${days}d ${hours}h ${minutes}m ${seconds}s</div>
                    </div>
                    
                    <div class="stat-box">
                        <div class="stat-title">COMMANDS LOADED</div>
                        <div class="stat-value">${commands.size}</div>
                    </div>
                    
                    <div class="stat-box">
                        <div class="stat-title">MEMORY USAGE</div>
                        <div class="stat-value">${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                </div>
                
                <div class="feature-list">
                    <div class="feature">Multi-Device Support</div>
                    <div class="feature">Advanced Security System</div>
                    <div class="feature">AI Auto-Reply</div>
                    <div class="feature">Anti-Delete Protection</div>
                    <div class="feature">Anti-Scam Detection</div>
                    <div class="feature">Auto Status Reply</div>
                    <div class="feature">Command System</div>
                    <div class="feature">Group Management</div>
                    <div class="feature">Firebase Storage</div>
                    <div class="feature">Always Online</div>
                </div>
                
                <div class="btn-container">
                    <a href="/pair" class="btn">📱 PAIR DEVICE</a>
                    <a href="/sessions" class="btn">📊 VIEW SESSIONS</a>
                    <a href="/commands" class="btn">⚙️ COMMANDS</a>
                </div>
                
                <div class="dev-info">
                    DEVELOPED BY STANYTZ | WRONG TURN 6 BOT | v6.0.0
                </div>
            </div>
            
            <script>
                // Auto refresh stats every 30 seconds
                setInterval(() => {
                    fetch('/api/stats')
                        .then(res => res.json())
                        .then(data => {
                            document.querySelector('.stat-value:nth-child(1)').textContent = data.activeSessions;
                            document.querySelector('.stat-value:nth-child(2)').textContent = data.uptime;
                        });
                }, 30000);
            </script>
        </body>
        </html>
    `);
});

// Pairing Page
app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/pair.html'));
});

// Sessions Page
app.get('/sessions', async (req, res) => {
    try {
        const sessionsSnap = await getDocs(collection(db, "ACTIVE_USERS"));
        const sessions = [];
        
        sessionsSnap.forEach(doc => {
            sessions.push({ id: doc.id, ...doc.data() });
        });
        
        res.json({
            success: true,
            total: sessions.length,
            active: sessions.filter(s => s.active).length,
            sessions: sessions
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stats API
app.get('/api/stats', (req, res) => {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    res.json({
        activeSessions: activeSessions.size,
        commands: commands.size,
        uptime: `${days}d ${hours}h ${minutes}m`,
        memory: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
    });
});

// =======================================================
// 🔐 PAIRING SYSTEM (FIXED & WORKING)
// =======================================================
app.get('/api/pair', async (req, res) => {
    let { number } = req.query;
    
    if (!number) {
        return res.status(400).json({ 
            success: false, 
            error: "Phone number is required" 
        });
    }
    
    // Clean number
    number = number.replace(/\D/g, '');
    
    console.log(`🔐 Pairing request for: ${number}`);
    
    try {
        // Check if already active
        if (activeSessions.has(number)) {
            return res.json({ 
                success: false, 
                error: "Session already active. Please logout first." 
            });
        }
        
        // Clear existing session
        const { wipeSession } = await useFirebaseAuthState(db, "WT6_SESSIONS", number);
        await wipeSession();
        
        // Wait for cleanup
        await delay(2000);
        
        // Create fresh auth state
        const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", number);
        
        // Get latest version
        const { version } = await fetchLatestBaileysVersion();
        
        // Create pairing socket
        const pairSocket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            version,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Desktop"),
            printQRInTerminal: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000
        });
        
        // Save credentials when updated
        pairSocket.ev.on('creds.update', saveCreds);
        
        // Wait for socket to initialize
        await delay(5000);
        
        // Request pairing code
        const pairingCode = await pairSocket.requestPairingCode(number);
        
        if (!pairingCode) {
            throw new Error("Failed to get pairing code");
        }
        
        console.log(`✅ Pairing code generated: ${pairingCode}`);
        
        // Handle successful connection
        pairSocket.ev.on('connection.update', async (update) => {
            const { connection } = update;
            
            if (connection === 'open') {
                console.log(`🎉 Device paired successfully for ${number}`);
                
                // Save final state
                await saveCreds(pairSocket.authState.creds);
                
                // Close pairing socket
                setTimeout(() => {
                    pairSocket.ws?.close();
                    pairSocket.end?.();
                }, 3000);
                
                // Start main bot
                setTimeout(() => {
                    startUserBot(number);
                }, 5000);
            }
        });
        
        // Auto-cleanup after 3 minutes
        setTimeout(() => {
            if (!pairSocket.user?.id) {
                pairSocket.ws?.close();
                pairSocket.end?.();
                console.log(`🕐 Cleared pairing socket for ${number} (timeout)`);
            }
        }, 180000);
        
        // Return success
        res.json({
            success: true,
            code: pairingCode,
            message: "Enter this code in WhatsApp > Linked Devices",
            expiresIn: "3 minutes"
        });
        
    } catch (error) {
        console.error(`🔥 Pairing error for ${number}:`, error.message);
        
        let errorMessage = "Pairing failed. Please try again.";
        
        if (error.message.includes('not registered')) {
            errorMessage = "This number is not registered on WhatsApp.";
        } else if (error.message.includes('timeout')) {
            errorMessage = "Pairing timeout. Check your internet connection.";
        } else if (error.message.includes('rate limit')) {
            errorMessage = "Too many attempts. Please wait 10 minutes.";
        }
        
        res.status(500).json({
            success: false,
            error: errorMessage,
            tip: "Ensure: 1. WhatsApp is updated 2. Stable internet 3. Correct number"
        });
    }
});

// =======================================================
// 🚪 LOGOUT ENDPOINT
// =======================================================
app.get('/api/logout', async (req, res) => {
    const { number } = req.query;
    
    if (!number) {
        return res.status(400).json({ 
            success: false, 
            error: "Phone number is required" 
        });
    }
    
    try {
        // Close active session
        const sock = activeSessions.get(number);
        if (sock) {
            sock.logout();
            activeSessions.delete(number);
        }
        
        // Clear from database
        const { wipeSession } = await useFirebaseAuthState(db, "WT6_SESSIONS", number);
        await wipeSession();
        
        await setDoc(doc(db, "ACTIVE_USERS", number), { 
            active: false,
            loggedOutAt: new Date().toISOString()
        }, { merge: true });
        
        res.json({
            success: true,
            message: "Successfully logged out and session cleared"
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =======================================================
// ⚙️ COMMAND LOADING
// =======================================================
function loadCommands() {
    const cmdPath = path.resolve(__dirname, 'commands');
    
    if (!fs.existsSync(cmdPath)) {
        console.log('⚠️ Commands directory not found, creating...');
        fs.ensureDirSync(cmdPath);
        fs.ensureDirSync(path.join(cmdPath, 'owner'));
        fs.ensureDirSync(path.join(cmdPath, 'general'));
        fs.ensureDirSync(path.join(cmdPath, 'admin'));
        
        // Create sample command
        const sampleCmd = `
module.exports = {
    name: 'ping',
    description: 'Check bot response time',
    category: 'general',
    async execute(m, sock, commands, args, db, context) {
        const start = Date.now();
        await sock.sendMessage(m.key.remoteJid, {
            text: '🏓 Pong!',
            contextInfo: context
        });
        const latency = Date.now() - start;
        await sock.sendMessage(m.key.remoteJid, {
            text: \`📊 Response time: \${latency}ms\`,
            contextInfo: context
        });
    }
};
        `;
        
        fs.writeFileSync(path.join(cmdPath, 'general', 'ping.js'), sampleCmd);
    }
    
    // Load commands from all categories
    const categories = fs.readdirSync(cmdPath).filter(f => 
        fs.lstatSync(path.join(cmdPath, f)).isDirectory()
    );
    
    categories.forEach(category => {
        const categoryPath = path.join(cmdPath, category);
        const commandFiles = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
        
        commandFiles.forEach(file => {
            try {
                const cmd = require(path.join(categoryPath, file));
                if (cmd && cmd.name) {
                    cmd.category = category;
                    commands.set(cmd.name.toLowerCase(), cmd);
                    console.log(`✅ Loaded command: ${cmd.name} (${category})`);
                }
            } catch (error) {
                console.error(`❌ Failed to load command ${file}:`, error.message);
            }
        });
    });
    
    console.log(`📦 Total commands loaded: ${commands.size}`);
}

// =======================================================
// 🔄 ALWAYS-ONLINE SYSTEM
// =======================================================
async function keepAliveSystem() {
    console.log('🔄 Starting keep-alive system...');
    
    // Keep sessions alive
    setInterval(async () => {
        for (const [num, sock] of activeSessions.entries()) {
            try {
                if (sock.user) {
                    // Update presence
                    await sock.sendPresenceUpdate('available');
                    
                    // Update profile status periodically
                    const uptime = process.uptime();
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    
                    if (Math.random() > 0.7) { // Randomly update status
                        await sock.updateProfileStatus(
                            `WRONG TURN 6 | ONLINE | ${hours}h ${minutes}m`
                        ).catch(() => {});
                    }
                    
                    // Update database
                    await setDoc(doc(db, "ACTIVE_USERS", num), {
                        lastPing: new Date().toISOString(),
                        uptime: `${hours}h ${minutes}m`
                    }, { merge: true });
                }
            } catch (error) {
                console.error(`Keep-alive error for ${num}:`, error.message);
            }
        }
    }, 30000); // Every 30 seconds
    
    // Auto-restart dead sessions every 5 minutes
    setInterval(async () => {
        try {
            const activeSnap = await getDocs(collection(db, "ACTIVE_USERS"));
            activeSnap.forEach(async (docSnap) => {
                const data = docSnap.data();
                const num = docSnap.id;
                
                if (data.active && !activeSessions.has(num)) {
                    console.log(`🔄 Auto-restarting session for: ${num}`);
                    startUserBot(num);
                }
            });
        } catch (error) {
            console.error('Auto-restart error:', error);
        }
    }, 300000); // Every 5 minutes
}

// =======================================================
// 🚀 SERVER STARTUP
// =======================================================
const PORT = process.env.PORT || 3000;

async function initializeBot() {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║      🥀 WRONG TURN 6 BOT 🥀          ║
    ║         Developed by STANYTZ          ║
    ║        Version: 6.0.0                 ║
    ╚═══════════════════════════════════════╝
    `);
    
    // Load commands
    loadCommands();
    
    // Start keep-alive system
    keepAliveSystem();
    
    // Restore active sessions
    try {
        const activeSnap = await getDocs(collection(db, "ACTIVE_USERS"));
        const restorePromises = [];
        
        activeSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.active && !activeSessions.has(docSnap.id)) {
                console.log(`♻️ Restoring session: ${docSnap.id}`);
                restorePromises.push(startUserBot(docSnap.id));
            }
        });
        
        await Promise.allSettled(restorePromises);
    } catch (error) {
        console.error('Session restore error:', error);
    }
    
    // Start server
    app.listen(PORT, () => {
        console.log(`
    🌐 Server Status:
    ├── Port: ${PORT}
    ├── Active Sessions: ${activeSessions.size}
    ├── Commands: ${commands.size}
    ├── Dashboard: http://localhost:${PORT}
    └── Pairing: http://localhost:${PORT}/pair
    
    📡 Bot is now armed and operational!
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
        await setDoc(doc(db, "ACTIVE_USERS", num), { 
            active: false,
            shutdownAt: new Date().toISOString()
        }, { merge: true });
    }
    
    console.log('✅ All sessions saved. Goodbye!');
    process.exit(0);
});

// =======================================================
// 🚀 START THE BOT
// =======================================================
initializeBot().catch(console.error);

// Export for testing
module.exports = { app, activeSessions, commands };
