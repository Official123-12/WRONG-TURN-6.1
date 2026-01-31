require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason,
    Browsers, 
    delay,
    makeCacheableSignalKeyStore,
    getContentType
} = require('xmd-baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, collection, getDocs } = require('firebase/firestore');
const express = require('express');
const pino = require('pino');
const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');

// Global error handling
process.on('unhandledRejection', e => console.log('🛡️ Error:', e?.message));
process.on('uncaughtException', e => console.log('🛡️ Exception:', e?.message));

// Firebase Configuration
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "stanybots.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "stanybots",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "stanybots.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "381983533939",
    appId: process.env.FIREBASE_APP_ID || "1:381983533939:web:e6cc9445137c74b99df306"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const app = express();
const commands = new Map();
const msgCache = new Map(); 
const activeSessions = new Map(); 
const newsletterJid = '120363404317544295@newsletter';
const groupJid = '120363406549688641@g.us';

const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: newsletterJid,
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
    }
};

/**
 * Firestore Auth State Manager
 */
async function useFirebaseAuthState(db, collectionName, sessionId) {
    const docRef = doc(db, collectionName, sessionId);
    
    const readState = async () => {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            try {
                return {
                    creds: JSON.parse(data.creds || '{}'),
                    keys: data.keys || {}
                };
            } catch (e) {
                return { creds: {}, keys: {} };
            }
        }
        return { creds: {}, keys: {} };
    };

    const saveCreds = async () => {
        const state = { creds: {}, keys: {} };
        try {
            await setDoc(docRef, {
                creds: JSON.stringify(state.creds),
                keys: state.keys,
                updatedAt: new Date().toISOString()
            });
        } catch (e) {}
    };

    const wipeSession = async () => {
        await setDoc(docRef, {
            creds: JSON.stringify({}),
            keys: {},
            updatedAt: new Date().toISOString()
        });
    };

    const state = await readState();
    
    return {
        state,
        saveCreds,
        wipeSession
    };
}

/**
 * Security Function
 */
async function armedSecurity(sock, m, s, isOwner) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase();
    const type = getContentType(m.message);

    if (!from.endsWith('@g.us') || isOwner) return false;

    const explain = async (reason) => {
        await sock.sendMessage(from, { delete: m.key });
        const text = `❌ *ꜱᴇᴄᴜʀɪᴛʏ ᴀᴄᴛɪᴏɴ*\n\nᴜꜱᴇʀ: @${sender.split('@')[0]}\nᴀᴄᴛɪᴏɴ: ᴍᴇꜱꜱᴀɢᴇ ᴅᴇʟᴇᴛᴇᴅ\nʀᴇᴀꜱᴏɴ: ${reason}\n\n_ꜱʏꜱᴛᴇᴍ: ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼_`;
        await sock.sendMessage(from, { text, mentions: [sender], contextInfo: forwardedContext });
    };

    if (s.antiLink && body.match(/https?:\/\/[^\s]+/gi)) { await explain("External link sharing is prohibited."); return true; }
    if (s.antiBot && m.key.id.startsWith('BAE5')) { await explain("Bot-generated traffic detected."); return true; }
    
    const scams = ["bundle", "fixed match", "earn money", "investment"];
    if (s.antiScam && scams.some(w => body.includes(w))) {
        const metadata = await sock.groupMetadata(from);
        await sock.sendMessage(from, { 
            text: `‼️ *ꜱᴄᴀᴍ ᴀʟᴇʀᴛ* ‼️\n@${sender.split('@')[0]} is spreading fraud! Precaution for all members.`, 
            mentions: metadata.participants.map(v => v.id), 
            contextInfo: forwardedContext 
        });
        await sock.sendMessage(from, { delete: m.key });
        await sock.groupParticipantsUpdate(from, [sender], "remove");
        return true;
    }

    const isPorn = /(porn|xxx|sex|ngono|vixen|🔞)/gi.test(body);
    if (s.antiPorn && isPorn) { await explain("Pornographic content prohibited."); await sock.groupParticipantsUpdate(from, [sender], "remove"); return true; }

    if (s.antiMedia && (type === 'imageMessage' || type === 'videoMessage' || type === 'audioMessage' || type === 'stickerMessage')) {
        await explain("Media sharing is currently disabled.");
        return true;
    }

    return false;
}

/**
 * Start User Bot with Firebase Session
 */
async function startUserBot(num) {
    if (activeSessions.has(num)) {
        console.log(`⚠️ Session already active for: ${num}`);
        return;
    }
    
    try {
        const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
        
        // Socket configuration using new settings you provided
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
            keepAliveIntervalMs: 25000,
            retryRequestDelayMs: 1000,
            maxRetries: 5,
            emitOwnEvents: true,
            defaultQueryTimeoutMs: 60000,
            syncFullHistory: false,
            transactionOpts: {
                maxCommitRetries: 10,
                delayBetweenTriesMs: 3000
            },
            fireInitQueries: true,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        activeSessions.set(num, sock);
        
        // Save credentials when updated
        sock.ev.on('creds.update', async () => {
            try {
                await setDoc(doc(db, "WT6_SESSIONS", num), {
                    creds: JSON.stringify(sock.authState.creds),
                    keys: sock.authState.keys,
                    updatedAt: new Date().toISOString()
                });
            } catch (e) {}
        });

        sock.ev.on('connection.update', async (u) => {
            const { connection, lastDisconnect } = u;
            
            if (connection === 'open') {
                console.log(`✅ WRONG TURN 6: ARMED [${num}]`);
                
                // Save to active users
                await setDoc(doc(db, "ACTIVE_USERS", num), { 
                    active: true,
                    connectedAt: new Date().toISOString(),
                    userId: sock.user?.id 
                });
                
                // Send welcome message
                const welcome = `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ`;
                await sock.sendMessage(sock.user.id, { 
                    text: welcome, 
                    contextInfo: forwardedContext 
                });
            }
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log(`🔒 Connection closed for ${num}: ${reason}`);
                activeSessions.delete(num);
                
                // Update Firebase
                await setDoc(doc(db, "ACTIVE_USERS", num), { 
                    active: false,
                    disconnectedAt: new Date().toISOString() 
                }, { merge: true });
                
                // Auto-reconnect if not logged out
                if (reason !== DisconnectReason.loggedOut) {
                    setTimeout(() => startUserBot(num), 5000);
                }
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0];
            if (!m.message) return;
            
            const from = m.key.remoteJid;
            const sender = m.key.participant || from;
            const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
            const type = getContentType(m.message);

            msgCache.set(m.key.id, m);
            const isOwner = sender.startsWith(num) || m.key.fromMe;

            // Get settings from Firebase
            const setSnap = await getDoc(doc(db, "SETTINGS", num));
            const s = setSnap.exists() ? setSnap.data() : { 
                prefix: ".", 
                mode: "public", 
                autoAI: true, 
                forceJoin: true, 
                autoStatus: true, 
                antiDelete: true, 
                antiViewOnce: true, 
                antiLink: true, 
                antiTag: true, 
                antiScam: true, 
                autoReact: true 
            };

            if (s.mode === "private" && !isOwner) return;

            if (s.autoReact && !m.key.fromMe) await sock.sendMessage(from, { react: { text: '🥀', key: m.key } });
            await sock.sendPresenceUpdate('composing', from);
            if (Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);

            if (await armedSecurity(sock, m, s, isOwner)) return;

            if (m.message?.protocolMessage?.type === 0 && s.antiDelete && !m.key.fromMe) {
                const cached = msgCache.get(m.message.protocolMessage.key.id);
                if (cached) {
                    await sock.sendMessage(sock.user.id, { 
                        text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ* Recovered from @${sender.split('@')[0]}`, 
                        mentions: [sender] 
                    });
                    await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
                }
            }
            
            if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
                await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ*` });
                await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
            }

            const isCmd = body.startsWith(s.prefix) || commands.has(body.split(' ')[0].toLowerCase());
            if (isCmd && !isOwner && s.forceJoin) {
                const groupMetadata = await sock.groupMetadata(groupJid);
                if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    return sock.sendMessage(from, { 
                        text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", 
                        contextInfo: forwardedContext 
                    });
                }
            }

            if (from === 'status@broadcast' && s.autoStatus) {
                await sock.readMessages([m.key]);
                const moodRes = await axios.get(`https://text.pollinations.ai/React to this status briefly and naturally in English as a human friend: "${body}". No quotes.`);
                await sock.sendMessage(from, { text: moodRes.data, contextInfo: forwardedContext }, { quoted: m });
                await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
            }

            if (!isCmd && !m.key.fromMe && s.autoAI && body.length > 2 && !from.endsWith('@g.us')) {
                try {
                    const aiPrompt = `Your name is WRONG TURN 6. Developer: STANYTZ. Respond naturally, briefly, and helpfully in the user's language: ${body}`;
                    const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
                    await sock.sendMessage(from, { 
                        text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, 
                        contextInfo: forwardedContext 
                    }, { quoted: m });
                } catch (e) {}
            }

            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedText = (quoted?.conversation || quoted?.extendedTextMessage?.text || "").toLowerCase();
            if (quoted && !isNaN(body) && body.length > 0) {
                for (let [name, obj] of commands) {
                    if (quotedText.includes(name)) {
                        await obj.execute(m, sock, Array.from(commands.values()), [body.trim()], db, forwardedContext);
                        return;
                    }
                }
            }

            let cmdName = body.startsWith(s.prefix) ? 
                body.slice(s.prefix.length).trim().split(/ +/)[0].toLowerCase() : 
                body.split(' ')[0].toLowerCase();
            let args = body.startsWith(s.prefix) ? 
                body.slice(s.prefix.length).trim().split(/ +/).slice(1) : 
                body.split(' ').slice(1);
            
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
            
            if (from.endsWith('@g.us')) {
                await setDoc(doc(db, "ACTIVITY", from), { 
                    [sender]: Date.now(),
                    lastMessage: body.substring(0, 50)
                }, { merge: true });
            }
        });

    } catch (error) {
        console.error(`❌ Failed to start bot for ${num}:`, error.message);
        activeSessions.delete(num);
    }
}

// Routes
app.get('/', (req, res) => {
    const uptime = Math.floor(process.uptime() / 3600);
    res.status(200).send(`
        <body style="background:#000;color:#ff0000;font-family:sans-serif;text-align:center;padding-top:100px;">
            <img src="https://files.catbox.moe/59ays3.jpg" style="width:150px;border-radius:50%;border:2px solid #ff0000;">
            <h1 style="letter-spacing:10px;">W R O N G  T U R N  6</h1>
            <p style="letter-spacing:5px;">MAINFRAME STATUS: <span style="color:#00ff00">ARMED</span></p>
            <p>ACTIVE NODES: ${activeSessions.size}</p>
            <p>UPTIME: ${uptime} HOURS</p>
            <p style="color:#444">DEVELOPED BY STANYTZ</p>
            <br>
            <a href="/pair" style="color:#fff;text-decoration:none;border:1px solid #ff0000;padding:15px 30px;border-radius:10px;">PAIR DEVICE</a>
        </body>
    `);
});

app.use(express.static('public'));

app.get('/pair', (req, res) => res.sendFile(path.join(__dirname, 'public/pair.html')));

// Pairing route using new socket settings
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    
    try {
        const { state, saveCreds, wipeSession } = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
        
        // Wipe old session for fresh pairing
        await wipeSession();
        
        // Create pairing socket with new settings
        const pSock = makeWASocket({
            auth: { 
                creds: state.creds, 
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) 
            },
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000
        });
        
        // Save credentials when updated
        pSock.ev.on('creds.update', async () => {
            await setDoc(doc(db, "WT6_SESSIONS", num), {
                creds: JSON.stringify(pSock.authState.creds),
                keys: pSock.authState.keys,
                updatedAt: new Date().toISOString()
            });
        });
        
        // Wait for socket to initialize
        await delay(3000);
        
        // Get pairing code
        let code = await pSock.requestPairingCode(num);
        
        res.send({ 
            success: true,
            code: code,
            number: num,
            message: `Go to WhatsApp > Settings > Linked Devices > Link a Device > Enter code: ${code}`
        });
        
        // Handle connection
        pSock.ev.on('connection.update', async (u) => { 
            if (u.connection === 'open') { 
                console.log(`✅ Connected: ${num}`);
                pSock.end?.();
                
                // Save final session data
                await setDoc(doc(db, "WT6_SESSIONS", num), {
                    creds: JSON.stringify(pSock.authState.creds),
                    keys: pSock.authState.keys,
                    user: pSock.user,
                    connectedAt: new Date().toISOString()
                });
                
                // Start main bot
                await startUserBot(num);
            }
        });
        
        // Timeout after 2 minutes
        setTimeout(() => {
            if (!pSock.user?.id) {
                pSock.end?.();
                console.log(`⏱️ Pairing timeout for: ${num}`);
            }
        }, 120000);
        
    } catch (e) { 
        console.error('Pairing error:', e);
        res.status(500).send({ 
            error: "Pairing failed",
            details: e.message,
            solution: "Use international format (254712345678) and ensure WhatsApp is active"
        }); 
    }
});

const PORT = process.env.PORT || 3000;

// Start server
app.listen(PORT, () => {
    console.log(`🌍 WRONG TURN 6 ARMED on port ${PORT}`);
    
    // Load commands
    const cmdPath = path.resolve(__dirname, 'commands');
    if (fs.existsSync(cmdPath)) {
        fs.readdirSync(cmdPath).forEach(folder => {
            const folderPath = path.join(cmdPath, folder);
            if (fs.lstatSync(folderPath).isDirectory()) {
                fs.readdirSync(folderPath).filter(f => f.endsWith('.js')).forEach(file => {
                    try {
                        const cmd = require(path.join(folderPath, file));
                        if (cmd && cmd.name) { 
                            cmd.category = folder; 
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
    
    // Restart active sessions from Firebase
    getDocs(collection(db, "ACTIVE_USERS")).then(snap => {
        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.active && !activeSessions.has(docSnap.id)) {
                console.log(`🔄 Restarting session for: ${docSnap.id}`);
                startUserBot(docSnap.id);
            }
        });
    });
});

// Keep alive function
setInterval(async () => {
    for (let [num, sock] of activeSessions.entries()) {
        if (sock.user) {
            try {
                const up = Math.floor(process.uptime() / 3600);
                await sock.updateProfileStatus(`WRONG TURN 6 | ONLINE | ${up}h Active`);
                await sock.sendPresenceUpdate('available');
                
                // Update last seen
                await setDoc(doc(db, "ACTIVE_USERS", num), { 
                    lastSeen: new Date().toISOString(),
                    uptime: up 
                }, { merge: true });
                
            } catch (error) {
                console.log(`Keep-alive error for ${num}:`, error.message);
            }
        }
    }
}, 30000);
