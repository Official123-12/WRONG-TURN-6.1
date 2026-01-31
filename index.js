// =======================================================
// 🤖 WRONG TURN 6 - ULTIMATE WHATSAPP BOT
// 🔥 Developer: STANYTZ
// 📅 Version: 6.0.0
// 🎯 COMPLETELY REWRITTEN & WORKING
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
// 🔐 AUTH STATE MANAGEMENT - WORKING VERSION
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
// 🦾 MAIN BOT ENGINE - WORKING VERSION
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
        await setDoc(doc(db, "ACTIVE_USERS", num), { 
            active: false, 
            error: error.message 
        }, { merge: true });
    }
}

// =======================================================
// 🌐 WEB INTERFACE ROUTES - ORIGINAL FONTS & STYLE
// =======================================================

// Main Dashboard - WITH ORIGINAL FONTS
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
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    background: #000000;
                    color: #ff0000;
                    font-family: 'Orbitron', monospace;
                    min-height: 100vh;
                    overflow-x: hidden;
                    position: relative;
                }
                
                body::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: 
                        radial-gradient(circle at 20% 30%, rgba(255, 0, 0, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 80% 70%, rgba(139, 0, 0, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 40% 80%, rgba(178, 34, 34, 0.1) 0%, transparent 50%);
                    z-index: -1;
                }
                
                .scanline {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 2px;
                    background: linear-gradient(to right, transparent, #ff0000, transparent);
                    animation: scan 3s linear infinite;
                    z-index: 999;
                    box-shadow: 0 0 10px #ff0000;
                }
                
                @keyframes scan {
                    0% { top: 0%; }
                    100% { top: 100%; }
                }
                
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 30px;
                    text-align: center;
                    position: relative;
                    z-index: 1;
                }
                
                .header {
                    margin: 50px 0;
                    position: relative;
                }
                
                .glitch {
                    font-size: 4.5em;
                    font-weight: 900;
                    letter-spacing: 20px;
                    text-transform: uppercase;
                    position: relative;
                    color: #ff0000;
                    text-shadow: 
                        0.05em 0 0 rgba(255, 0, 0, 0.75),
                        -0.025em -0.05em 0 rgba(0, 255, 0, 0.75),
                        0.025em 0.05em 0 rgba(0, 0, 255, 0.75);
                    animation: glitch 500ms infinite;
                }
                
                @keyframes glitch {
                    0% { text-shadow: 0.05em 0 0 rgba(255, 0, 0, 0.75), -0.025em -0.05em 0 rgba(0, 255, 0, 0.75), 0.025em 0.05em 0 rgba(0, 0, 255, 0.75); }
                    14% { text-shadow: 0.05em 0 0 rgba(255, 0, 0, 0.75), -0.025em -0.05em 0 rgba(0, 255, 0, 0.75), 0.025em 0.05em 0 rgba(0, 0, 255, 0.75); }
                    15% { text-shadow: -0.05em -0.025em 0 rgba(255, 0, 0, 0.75), 0.025em 0.025em 0 rgba(0, 255, 0, 0.75), -0.05em -0.05em 0 rgba(0, 0, 255, 0.75); }
                    49% { text-shadow: -0.05em -0.025em 0 rgba(255, 0, 0, 0.75), 0.025em 0.025em 0 rgba(0, 255, 0, 0.75), -0.05em -0.05em 0 rgba(0, 0, 255, 0.75); }
                    50% { text-shadow: 0.025em 0.05em 0 rgba(255, 0, 0, 0.75), 0.05em 0 0 rgba(0, 255, 0, 0.75), 0 -0.05em 0 rgba(0, 0, 255, 0.75); }
                    99% { text-shadow: 0.025em 0.05em 0 rgba(255, 0, 0, 0.75), 0.05em 0 0 rgba(0, 255, 0, 0.75), 0 -0.05em 0 rgba(0, 0, 255, 0.75); }
                    100% { text-shadow: -0.025em 0 0 rgba(255, 0, 0, 0.75), -0.025em -0.025em 0 rgba(0, 255, 0, 0.75), -0.025em -0.05em 0 rgba(0, 0, 255, 0.75); }
                }
                
                .subtitle {
                    font-size: 1.2em;
                    letter-spacing: 8px;
                    color: #ff6666;
                    margin-top: 20px;
                    font-family: 'Share Tech Mono', monospace;
                }
                
                .logo-container {
                    margin: 40px 0;
                    position: relative;
                }
                
                .logo {
                    width: 200px;
                    height: 200px;
                    margin: 0 auto;
                    position: relative;
                }
                
                .logo img {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    border: 3px solid #ff0000;
                    filter: drop-shadow(0 0 20px rgba(255, 0, 0, 0.7));
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7); }
                    70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(255, 0, 0, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); }
                }
                
                .status-board {
                    background: rgba(0, 0, 0, 0.8);
                    border: 2px solid #ff0000;
                    border-radius: 15px;
                    padding: 30px;
                    margin: 40px 0;
                    position: relative;
                    overflow: hidden;
                }
                
                .status-board::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(45deg, transparent 30%, rgba(255, 0, 0, 0.1) 50%, transparent 70%);
                    animation: shine 3s infinite;
                }
                
                @keyframes shine {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                
                .status-title {
                    font-size: 2em;
                    color: #00ff00;
                    margin-bottom: 30px;
                    text-transform: uppercase;
                    letter-spacing: 5px;
                }
                
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 25px;
                    margin-top: 30px;
                }
                
                .stat-card {
                    background: rgba(255, 0, 0, 0.1);
                    border: 1px solid rgba(255, 0, 0, 0.3);
                    border-radius: 10px;
                    padding: 25px;
                    transition: all 0.3s;
                    position: relative;
                    overflow: hidden;
                }
                
                .stat-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 20px rgba(255, 0, 0, 0.2);
                    border-color: #ff0000;
                }
                
                .stat-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 5px;
                    height: 100%;
                    background: #ff0000;
                }
                
                .stat-label {
                    font-size: 0.9em;
                    color: #ff9999;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    margin-bottom: 10px;
                }
                
                .stat-value {
                    font-size: 2.5em;
                    font-weight: 700;
                    color: #fff;
                    font-family: 'Share Tech Mono', monospace;
                }
                
                .stat-value.online {
                    color: #00ff00;
                    text-shadow: 0 0 10px #00ff00;
                }
                
                .controls {
                    margin: 50px 0;
                }
                
                .btn-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin: 30px 0;
                }
                
                .btn {
                    background: linear-gradient(45deg, #ff0000, #8b0000);
                    color: white;
                    border: none;
                    padding: 20px 30px;
                    font-size: 1.1em;
                    font-family: 'Orbitron', sans-serif;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.3s;
                    position: relative;
                    overflow: hidden;
                    text-decoration: none;
                    display: inline-block;
                    text-align: center;
                }
                
                .btn::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                    transition: 0.5s;
                }
                
                .btn:hover::before {
                    left: 100%;
                }
                
                .btn:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 10px 20px rgba(255, 0, 0, 0.4);
                    background: linear-gradient(45deg, #ff3333, #ff0000);
                }
                
                .btn-primary {
                    background: linear-gradient(45deg, #ff0000, #b22222);
                    font-size: 1.2em;
                    padding: 25px 40px;
                }
                
                .features {
                    background: rgba(0, 0, 0, 0.7);
                    border: 1px solid rgba(255, 0, 0, 0.2);
                    border-radius: 15px;
                    padding: 40px;
                    margin: 50px 0;
                }
                
                .features-title {
                    font-size: 1.8em;
                    color: #ff6666;
                    margin-bottom: 30px;
                    text-transform: uppercase;
                    letter-spacing: 3px;
                }
                
                .features-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                }
                
                .feature-item {
                    background: rgba(255, 0, 0, 0.05);
                    padding: 20px;
                    border-radius: 10px;
                    border-left: 4px solid #ff0000;
                    text-align: left;
                }
                
                .feature-item h4 {
                    color: #ff9999;
                    margin-bottom: 10px;
                    font-size: 1.1em;
                }
                
                .feature-item p {
                    color: #ff6666;
                    font-size: 0.9em;
                    line-height: 1.5;
                }
                
                .terminal {
                    background: rgba(0, 0, 0, 0.9);
                    border: 2px solid #ff0000;
                    border-radius: 10px;
                    padding: 25px;
                    margin: 40px 0;
                    text-align: left;
                    font-family: 'Share Tech Mono', monospace;
                    color: #00ff00;
                    overflow: auto;
                    max-height: 300px;
                }
                
                .terminal-line {
                    margin: 10px 0;
                    display: flex;
                    align-items: center;
                }
                
                .prompt {
                    color: #00ff00;
                    margin-right: 10px;
                }
                
                .command {
                    color: #fff;
                    animation: blink 1s infinite;
                }
                
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                .footer {
                    margin-top: 60px;
                    padding-top: 30px;
                    border-top: 1px solid rgba(255, 0, 0, 0.3);
                    color: #666;
                    font-size: 0.9em;
                }
                
                .footer p {
                    margin: 10px 0;
                }
                
                .dev-signature {
                    color: #ff6666;
                    font-size: 1.1em;
                    letter-spacing: 3px;
                    margin-top: 20px;
                }
                
                @media (max-width: 768px) {
                    .container { padding: 15px; }
                    .glitch { font-size: 2.5em; letter-spacing: 10px; }
                    .subtitle { font-size: 1em; letter-spacing: 5px; }
                    .logo { width: 150px; height: 150px; }
                    .btn-grid { grid-template-columns: 1fr; }
                    .features-grid { grid-template-columns: 1fr; }
                }
                
                .floating {
                    animation: floating 3s ease-in-out infinite;
                }
                
                @keyframes floating {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                    100% { transform: translateY(0px); }
                }
            </style>
        </head>
        <body>
            <div class="scanline"></div>
            
            <div class="container">
                <div class="header">
                    <h1 class="glitch">W R O N G &nbsp; T U R N &nbsp; 6</h1>
                    <p class="subtitle">SOVEREIGN MAINFRAME BY STANYTZ</p>
                </div>
                
                <div class="logo-container floating">
                    <div class="logo">
                        <img src="https://files.catbox.moe/59ays3.jpg" alt="WRONG TURN 6 Logo">
                    </div>
                </div>
                
                <div class="status-board">
                    <h2 class="status-title">MAINFRAME STATUS</h2>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-label">OPERATIONAL STATUS</div>
                            <div class="stat-value online">ARMED</div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-label">ACTIVE NODES</div>
                            <div class="stat-value">${activeSessions.size}</div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-label">UPTIME</div>
                            <div class="stat-value">${days}d ${hours}h ${minutes}m</div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-label">ENCRYPTION</div>
                            <div class="stat-value">AES-256</div>
                        </div>
                    </div>
                </div>
                
                <div class="controls">
                    <div class="btn-grid">
                        <a href="/pair" class="btn btn-primary">
                            🔐 ENTER ENCRYPTED TARGET NUMBER
                        </a>
                        
                        <a href="/sessions" class="btn">
                            📊 ACTIVE SESSIONS
                        </a>
                        
                        <a href="/commands" class="btn">
                            ⚙️ COMMAND INTERFACE
                        </a>
                        
                        <a href="/status" class="btn">
                            📡 SYSTEM STATUS
                        </a>
                    </div>
                </div>
                
                <div class="features">
                    <h3 class="features-title">ADVANCED FEATURES</h3>
                    <div class="features-grid">
                        <div class="feature-item">
                            <h4>🔐 MULTI-DEVICE SUPPORT</h4>
                            <p>Connect unlimited WhatsApp accounts with secure session management</p>
                        </div>
                        
                        <div class="feature-item">
                            <h4>🛡️ ADVANCED SECURITY</h4>
                            <p>Anti-scam, anti-porn, anti-link, and real-time threat detection</p>
                        </div>
                        
                        <div class="feature-item">
                            <h4>🤖 AI INTEGRATION</h4>
                            <p>Smart auto-reply and status response with natural language processing</p>
                        </div>
                        
                        <div class="feature-item">
                            <h4>⚡ REAL-TIME MONITORING</h4>
                            <p>24/7 active protection with instant threat neutralization</p>
                        </div>
                    </div>
                </div>
                
                <div class="terminal">
                    <div class="terminal-line">
                        <span class="prompt">$></span>
                        <span class="command">system_status --bot="wrong_turn_6"</span>
                    </div>
                    <div class="terminal-line">
                        <span class="prompt">></span>
                        <span>✓ System: Operational</span>
                    </div>
                    <div class="terminal-line">
                        <span class="prompt">></span>
                        <span>✓ Sessions: ${activeSessions.size} active</span>
                    </div>
                    <div class="terminal-line">
                        <span class="prompt">></span>
                        <span>✓ Security: Level 5 enabled</span>
                    </div>
                    <div class="terminal-line">
                        <span class="prompt">></span>
                        <span>✓ AI Core: Online and responsive</span>
                    </div>
                    <div class="terminal-line">
                        <span class="prompt">></span>
                        <span>✓ Deployment: Railway.app [LIVE]</span>
                    </div>
                </div>
                
                <div class="footer">
                    <p>WRONG TURN 6 - SOVEREIGN WHATSAPP AUTOMATION SYSTEM</p>
                    <p class="dev-signature">DEVELOPED BY STANYTZ</p>
                    <p>© 2024 WRONG TURN SERIES | v6.0.0 | ALL SYSTEMS OPERATIONAL</p>
                </div>
            </div>
            
            <script>
                // Real-time stats update
                function updateStats() {
                    fetch('/api/stats')
                        .then(res => res.json())
                        .then(data => {
                            // Update active nodes
                            const nodesEl = document.querySelector('.stat-card:nth-child(2) .stat-value');
                            if (nodesEl) nodesEl.textContent = data.activeSessions;
                            
                            // Update uptime
                            const uptimeEl = document.querySelector('.stat-card:nth-child(3) .stat-value');
                            if (uptimeEl) {
                                const totalSeconds = Math.floor(process.uptime?.() || data.uptimeSeconds || 0);
                                const days = Math.floor(totalSeconds / 86400);
                                const hours = Math.floor((totalSeconds % 86400) / 3600);
                                const minutes = Math.floor((totalSeconds % 3600) / 60);
                                uptimeEl.textContent = `${days}d ${hours}h ${minutes}m`;
                            }
                            
                            // Update terminal
                            const terminalLines = document.querySelectorAll('.terminal-line');
                            if (terminalLines.length > 1) {
                                terminalLines[1].innerHTML = `<span class="prompt">></span><span>✓ System: Operational</span>`;
                                terminalLines[2].innerHTML = `<span class="prompt">></span><span>✓ Sessions: ${data.activeSessions} active</span>`;
                            }
                        })
                        .catch(console.error);
                }
                
                // Update every 10 seconds
                setInterval(updateStats, 10000);
                
                // Initial update
                setTimeout(updateStats, 1000);
                
                // Add typing effect to terminal
                const commands = [
                    'security_scan --full',
                    'ai_core --status',
                    'session_manager --list',
                    'firebase_sync --status',
                    'deployment_check --railway'
                ];
                
                let cmdIndex = 0;
                function typeCommand() {
                    const cmdEl = document.querySelector('.command');
                    if (cmdEl) {
                        let currentCmd = commands[cmdIndex];
                        let i = 0;
                        
                        function typeChar() {
                            if (i < currentCmd.length) {
                                cmdEl.textContent = currentCmd.substring(0, i + 1);
                                i++;
                                setTimeout(typeChar, 50);
                            } else {
                                setTimeout(() => {
                                    cmdEl.textContent = '';
                                    cmdIndex = (cmdIndex + 1) % commands.length;
                                    setTimeout(typeCommand, 1000);
                                }, 2000);
                            }
                        }
                        
                        typeChar();
                    }
                }
                
                // Start typing effect
                setTimeout(typeCommand, 3000);
            </script>
        </body>
        </html>
    `);
});

// =======================================================
// 🔐 PAIRING PAGE - ORIGINAL STYLE
// =======================================================
app.get('/pair', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WRONG TURN 6 - Pair Device</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    background: #000000;
                    color: #ff0000;
                    font-family: 'Orbitron', monospace;
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                    position: relative;
                    overflow: hidden;
                }
                
                body::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: 
                        radial-gradient(circle at 20% 30%, rgba(255, 0, 0, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 80% 70%, rgba(139, 0, 0, 0.1) 0%, transparent 50%);
                    z-index: -1;
                }
                
                .scanline {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 2px;
                    background: linear-gradient(to right, transparent, #ff0000, transparent);
                    animation: scan 3s linear infinite;
                    z-index: 999;
                    box-shadow: 0 0 10px #ff0000;
                }
                
                @keyframes scan {
                    0% { top: 0%; }
                    100% { top: 100%; }
                }
                
                .container {
                    background: rgba(0, 0, 0, 0.9);
                    border: 3px solid #ff0000;
                    border-radius: 20px;
                    padding: 50px;
                    max-width: 600px;
                    width: 100%;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 0 50px rgba(255, 0, 0, 0.3);
                }
                
                .container::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(45deg, transparent 30%, rgba(255, 0, 0, 0.05) 50%, transparent 70%);
                    animation: shine 3s infinite;
                }
                
                @keyframes shine {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                
                .header {
                    margin-bottom: 40px;
                }
                
                .title {
                    font-size: 2.8em;
                    font-weight: 900;
                    letter-spacing: 10px;
                    text-transform: uppercase;
                    color: #ff0000;
                    text-shadow: 0 0 20px rgba(255, 0, 0, 0.7);
                    margin-bottom: 10px;
                }
                
                .subtitle {
                    font-size: 1.2em;
                    color: #ff6666;
                    letter-spacing: 5px;
                    font-family: 'Share Tech Mono', monospace;
                }
                
                .input-group {
                    margin: 40px 0;
                    text-align: left;
                }
                
                .label {
                    display: block;
                    margin-bottom: 15px;
                    color: #ff9999;
                    font-size: 1.1em;
                    letter-spacing: 2px;
                }
                
                .input-field {
                    width: 100%;
                    padding: 20px;
                    background: rgba(255, 0, 0, 0.1);
                    border: 2px solid rgba(255, 0, 0, 0.3);
                    border-radius: 10px;
                    color: #fff;
                    font-size: 1.2em;
                    font-family: 'Share Tech Mono', monospace;
                    transition: all 0.3s;
                }
                
                .input-field:focus {
                    outline: none;
                    border-color: #ff0000;
                    box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
                    background: rgba(255, 0, 0, 0.15);
                }
                
                .input-field::placeholder {
                    color: rgba(255, 255, 255, 0.3);
                }
                
                .btn {
                    background: linear-gradient(45deg, #ff0000, #8b0000);
                    color: white;
                    border: none;
                    padding: 20px 40px;
                    font-size: 1.3em;
                    font-family: 'Orbitron', sans-serif;
                    letter-spacing: 3px;
                    text-transform: uppercase;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.3s;
                    width: 100%;
                    margin: 20px 0;
                    position: relative;
                    overflow: hidden;
                }
                
                .btn::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                    transition: 0.5s;
                }
                
                .btn:hover::before {
                    left: 100%;
                }
                
                .btn:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 10px 30px rgba(255, 0, 0, 0.4);
                    background: linear-gradient(45deg, #ff3333, #ff0000);
                }
                
                .btn:disabled {
                    background: #444;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }
                
                .btn:disabled:hover::before {
                    left: -100%;
                }
                
                .result {
                    margin: 30px 0;
                    padding: 30px;
                    border-radius: 10px;
                    display: none;
                    text-align: center;
                    animation: fadeIn 0.5s;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .success {
                    background: rgba(0, 255, 0, 0.1);
                    border: 2px solid #00ff00;
                    display: block;
                }
                
                .error {
                    background: rgba(255, 0, 0, 0.1);
                    border: 2px solid #ff0000;
                    display: block;
                }
                
                .code-display {
                    font-size: 3.5em;
                    font-weight: 900;
                    letter-spacing: 15px;
                    color: #00ff00;
                    margin: 30px 0;
                    font-family: 'Share Tech Mono', monospace;
                    text-shadow: 0 0 20px #00ff00;
                    padding: 20px;
                    background: rgba(0, 0, 0, 0.7);
                    border-radius: 10px;
                    border: 1px solid #00ff00;
                }
                
                .instructions {
                    background: rgba(255, 0, 0, 0.05);
                    padding: 25px;
                    border-radius: 10px;
                    margin-top: 40px;
                    text-align: left;
                    border-left: 4px solid #ff0000;
                }
                
                .instructions h3 {
                    color: #ff9999;
                    margin-bottom: 15px;
                    font-size: 1.3em;
                }
                
                .instructions ol {
                    padding-left: 25px;
                    color: #ff6666;
                }
                
                .instructions li {
                    margin-bottom: 12px;
                    line-height: 1.6;
                }
                
                .loader {
                    display: none;
                    text-align: center;
                    margin: 30px 0;
                }
                
                .loader-dots {
                    display: inline-block;
                    position: relative;
                    width: 80px;
                    height: 80px;
                }
                
                .loader-dots div {
                    position: absolute;
                    top: 33px;
                    width: 13px;
                    height: 13px;
                    border-radius: 50%;
                    background: #ff0000;
                    animation-timing-function: cubic-bezier(0, 1, 1, 0);
                }
                
                .loader-dots div:nth-child(1) {
                    left: 8px;
                    animation: loader-dots1 0.6s infinite;
                }
                
                .loader-dots div:nth-child(2) {
                    left: 8px;
                    animation: loader-dots2 0.6s infinite;
                }
                
                .loader-dots div:nth-child(3) {
                    left: 32px;
                    animation: loader-dots2 0.6s infinite;
                }
                
                .loader-dots div:nth-child(4) {
                    left: 56px;
                    animation: loader-dots3 0.6s infinite;
                }
                
                @keyframes loader-dots1 {
                    0% { transform: scale(0); }
                    100% { transform: scale(1); }
                }
                
                @keyframes loader-dots3 {
                    0% { transform: scale(1); }
                    100% { transform: scale(0); }
                }
                
                @keyframes loader-dots2 {
                    0% { transform: translate(0, 0); }
                    100% { transform: translate(24px, 0); }
                }
                
                .back-btn {
                    display: inline-block;
                    margin-top: 30px;
                    color: #ff6666;
                    text-decoration: none;
                    font-size: 1.1em;
                    transition: color 0.3s;
                }
                
                .back-btn:hover {
                    color: #ff0000;
                    text-decoration: underline;
                }
                
                @media (max-width: 768px) {
                    .container { padding: 30px 20px; }
                    .title { font-size: 2em; letter-spacing: 5px; }
                    .subtitle { font-size: 1em; letter-spacing: 3px; }
                    .code-display { font-size: 2em; letter-spacing: 10px; }
                }
            </style>
        </head>
        <body>
            <div class="scanline"></div>
            
            <div class="container">
                <div class="header">
                    <h1 class="title">WRONG TURN 6</h1>
                    <p class="subtitle">ENTER ENCRYPTED TARGET NUMBER</p>
                </div>
                
                <div class="input-group">
                    <label class="label">📱 WHATSAPP NUMBER</label>
                    <input 
                        type="tel" 
                        id="number" 
                        class="input-field"
                        placeholder="255123456789 (without +)"
                        autocomplete="off"
                        autofocus
                    >
                </div>
                
                <button class="btn" onclick="requestPairingCode()" id="pairBtn">
                    🔐 GENERATE PAIRING CODE
                </button>
                
                <div class="loader" id="loader">
                    <div class="loader-dots">
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                    </div>
                    <p style="margin-top: 20px; color: #ff6666;">
                        CONNECTING TO WHATSAPP SERVERS...
                    </p>
                </div>
                
                <div class="result" id="result"></div>
                
                <div class="instructions">
                    <h3>📝 PAIRING INSTRUCTIONS:</h3>
                    <ol>
                        <li>Open WhatsApp on your phone</li>
                        <li>Tap Menu → Linked Devices</li>
                        <li>Tap "Link a Device"</li>
                        <li>Enter the 6-digit code shown above</li>
                        <li>Wait for connection confirmation</li>
                        <li>Bot will start automatically</li>
                    </ol>
                    <p style="margin-top: 15px; color: #ff9999;">
                        ⚠️ Code expires in 5 minutes. Never share it!
                    </p>
                </div>
                
                <a href="/" class="back-btn">← RETURN TO MAINFRAME</a>
            </div>

            <script>
                async function requestPairingCode() {
                    const number = document.getElementById('number').value.trim();
                    const btn = document.getElementById('pairBtn');
                    const loader = document.getElementById('loader');
                    const result = document.getElementById('result');
                    
                    // Validate number
                    if (!number || number.length < 9) {
                        showResult('Please enter a valid WhatsApp number (e.g., 255123456789)', 'error');
                        return;
                    }
                    
                    // Clean number (remove any non-digits)
                    const cleanNumber = number.replace(/\D/g, '');
                    
                    // Show loader, disable button
                    btn.disabled = true;
                    btn.innerHTML = '🔐 PROCESSING...';
                    loader.style.display = 'block';
                    result.style.display = 'none';
                    
                    try {
                        const response = await fetch(`/api/pair?number=${encodeURIComponent(cleanNumber)}`);
                        const data = await response.json();
                        
                        if (data.success) {
                            showResult(`
                                <h2 style="color:#00ff00; margin-bottom:20px;">✅ PAIRING CODE GENERATED</h2>
                                <div class="code-display">${data.code}</div>
                                <p style="color:#ff9999; margin:20px 0;">${data.message}</p>
                                <p style="color:#ff6666;"><strong>⏰ EXPIRES: ${data.expires}</strong></p>
                                <div style="margin-top:30px; padding:15px; background:rgba(0,255,0,0.1); border-radius:8px;">
                                    <p style="color:#00ff00;">✓ Code sent to WhatsApp servers</p>
                                    <p style="color:#00ff00;">✓ Ready for device linking</p>
                                </div>
                            `, 'success');
                            
                            // Auto-copy to clipboard
                            try {
                                await navigator.clipboard.writeText(data.code);
                                console.log('Code copied to clipboard');
                            } catch (e) {}
                        } else {
                            showResult(`
                                <h2 style="color:#ff0000; margin-bottom:20px;">❌ PAIRING FAILED</h2>
                                <p style="color:#ff9999; font-size:1.2em; margin:20px 0;">${data.error}</p>
                                <p style="color:#ff6666;">${data.tips || ''}</p>
                                ${data.solution ? `<p style="color:#ff9999; margin-top:15px;">💡 ${data.solution}</p>` : ''}
                            `, 'error');
                        }
                    } catch (error) {
                        showResult(`
                            <h2 style="color:#ff0000; margin-bottom:20px;">❌ NETWORK ERROR</h2>
                            <p style="color:#ff9999; margin:20px 0;">Failed to connect to server</p>
                            <p style="color:#ff6666;">Check your internet connection and try again</p>
                        `, 'error');
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = '🔐 GENERATE PAIRING CODE';
                        loader.style.display = 'none';
                    }
                }
                
                function showResult(message, type) {
                    const resultDiv = document.getElementById('result');
                    resultDiv.innerHTML = message;
                    resultDiv.className = `result ${type}`;
                    resultDiv.style.display = 'block';
                    
                    // Scroll to result
                    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                
                // Enter key support
                document.getElementById('number').addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') requestPairingCode();
                });
                
                // Auto-format number
                document.getElementById('number').addEventListener('input', function(e) {
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.length > 0 && !value.startsWith('255')) {
                        if (value.length === 9) {
                            value = '255' + value;
                        }
                    }
                    e.target.value = value;
                });
                
                // Focus on input
                document.getElementById('number').focus();
            </script>
        </body>
        </html>
    `);
});

// =======================================================
// 🔐 WORKING PAIRING API - FIXED VERSION
// =======================================================
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

// =======================================================
// 📊 ADDITIONAL API ENDPOINTS
// =======================================================

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
        let helpText = '╔═══════════════════╗\\n';
        helpText += '       ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼\\n';
        helpText += '╚═══════════════════╝\\n\\n';
        helpText += '📖 *ᴀᴠᴀɪʟᴀʙʟᴇ ᴄᴏᴍᴍᴀɴᴅꜱ*\\n\\n';
        
        const categories = {};
        commands.forEach(cmd => {
            if (!categories[cmd.category]) categories[cmd.category] = [];
            categories[cmd.category].push(cmd);
        });
        
        for (const [category, cmds] of Object.entries(categories)) {
            helpText += \`📁 *\${category.toUpperCase()}*\\n\`;
            cmds.forEach(cmd => {
                helpText += \`• \${process.env.PREFIX || '.'}\${cmd.name}\`;
                if (cmd.description) helpText += \` - \${cmd.description}\`;
                helpText += '\\n';
            });
            helpText += '\\n';
        }
        
        helpText += '\\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_';
        
        await sock.sendMessage(from, { 
            text: helpText,
            contextInfo: context
        });
    }
};
        `;
        
        fs.writeFileSync(path.join(cmdPath, 'general', 'help.js'), helpCmd);
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
    ╔═══════════════════════════════════════╗
    ║      🥀 WRONG TURN 6 BOT 🥀          ║
    ║         Developed by STANYTZ          ║
    ║        Version: 6.0.0                 ║
    ║       Status: ARMED & READY          ║
    ╚═══════════════════════════════════════╝
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
    ├── Pairing: http://localhost:${PORT}/pair
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
