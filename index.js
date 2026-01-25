require('dotenv').config();
const { 
    default: makeWASocket, DisconnectReason, Browsers, delay, fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, initAuthCreds, BufferJSON, getContentType, jidDecode 
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, updateDoc, collection, query, getDocs, deleteDoc } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');

// CONFIGURATION
const DEVELOPER = "StanyTz"; 
const firebaseConfig = {
    apiKey: "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
    authDomain: "stanybots.firebaseapp.com",
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
const sessions = new Map();

const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
    }
};

/**
 * 🛠️ ACTION HANDLER (Delete, Warn, Remove)
 */
async function applyAction(sock, from, sender, m, s) {
    const ownerId = sock.user.id.split(':')[0];
    const warnId = `${ownerId}_${from}_${sender}`;
    const warnDoc = doc(db, "WARNINGS", warnId);

    if (s.action === 'delete') {
        await sock.sendMessage(from, { delete: m.key });
    } 
    else if (s.action === 'warn') {
        await sock.sendMessage(from, { delete: m.key });
        const snap = await getDoc(warnDoc);
        let count = snap.exists() ? snap.data().count + 1 : 1;
        
        if (count >= s.warnLimit) {
            await sock.sendMessage(from, { text: `🚫 *LIMIT REACHED*: @${sender.split('@')[0]} has been removed for violating rules.`, mentions: [sender] });
            await sock.groupParticipantsUpdate(from, [sender], "remove");
            await deleteDoc(warnDoc);
        } else {
            await setDoc(warnDoc, { count: count });
            await sock.sendMessage(from, { text: `⚠️ *WARNING [${count}/${s.warnLimit}]*: @${sender.split('@')[0]}, stop that or you will be removed!`, mentions: [sender] });
        }
    } 
    else if (s.action === 'remove') {
        await sock.sendMessage(from, { delete: m.key });
        await sock.groupParticipantsUpdate(from, [sender], "remove");
    }
}

/**
 * 🚀 FEATURE ENGINE
 */
async function handleAutomations(sock, m, db) {
    try {
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
        const type = getContentType(m.message);
        const isGroup = from.endsWith('@g.us');

        msgCache.set(m.key.id, m);
        const ownerId = sock.user.id.split(':')[0];
        const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

        // FETCH SETTINGS (Per User Bot)
        const setSnap = await getDoc(doc(db, "SETTINGS", ownerId));
        const s = setSnap.exists() ? setSnap.data() : { 
            autoAI: true, forceJoin: true, autoStatus: true, antiDelete: true, 
            antiViewOnce: true, antiScam: true, antiLink: true, antiTag: true,
            warnLimit: 3, scamWords: ['bundle', 'fixed match', 'investment'], 
            action: 'warn', prefix: "." 
        };

        // 1. ANTI-TAG STATUS (Requirement 4)
        if (isGroup && !isOwner && s.antiTag) {
            const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentions.includes('status@broadcast')) {
                return await applyAction(sock, from, sender, m, s);
            }
        }

        // 2. ANTI-LINK WORLDWIDE (Requirement 5)
        if (isGroup && !isOwner && s.antiLink) {
            if (/chat.whatsapp.com|http:\/\/|https:\/\//gi.test(body)) {
                return await applyAction(sock, from, sender, m, s);
            }
        }

        // 3. ANTI-SCAM + TAG ALL PRECAUTION (Requirement 5)
        if (isGroup && !isOwner && s.antiScam) {
            const isScam = s.scamWords.some(word => body.toLowerCase().includes(word.toLowerCase()));
            if (isScam) {
                const metadata = await sock.groupMetadata(from);
                const allMem = metadata.participants.map(v => v.id);
                await sock.sendMessage(from, { 
                    text: `‼️ *SCAM ALERT* ‼️\n\n@${sender.split('@')[0]} is sharing suspicious content. DO NOT TRUST!\n\n_Stay safe members!_`, 
                    mentions: allMem 
                });
                await sock.sendMessage(from, { delete: m.key });
                await sock.groupParticipantsUpdate(from, [sender], "remove");
                return;
            }
        }

        // 4. ANTI-DELETE & VIEWONCE
        if (m.message.protocolMessage?.type === 0 && !m.key.fromMe && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ* Recovered from @${sender.split('@')[0]}`, mentions: [sender] });
                await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
            }
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ* Captured from @${sender.split('@')[0]}`, mentions: [sender] });
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // 5. STATUS AUTO-REPLY
        if (from === 'status@broadcast' && s.autoStatus) {
            await sock.readMessages([m.key]);
            const aiMood = await axios.get(`https://text.pollinations.ai/React as a friend to this status briefly: "${body}".`);
            await sock.sendMessage(from, { text: aiMood.data, contextInfo: forwardedContext }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
        }

        // 6. AUTO-AI CHAT
        if (!body.startsWith(s.prefix) && !m.key.fromMe && s.autoAI && body.length > 2 && !isGroup) {
            try {
                const aiRes = await axios.get(`https://text.pollinations.ai/Your name is WRONG TURN 6. Developer: ${DEVELOPER}. Owner ID: ${ownerId}. Chat naturally to: ${encodeURIComponent(body)}`);
                await sock.sendMessage(from, { text: `${aiRes.data}\n\n_ᴅᴇᴠ: ${DEVELOPER}_`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // 7. COMMANDS
        if (body.startsWith(s.prefix)) {
            const args = body.slice(s.prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    } catch (e) { console.log(e) }
}

/**
 * 🤖 BOT STARTER (Multi-Session)
 */
async function startUserBot(num) {
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        markOnlineOnConnect: true
    });

    sessions.set(num, sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            const welcomeMsg = `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ\nᴅᴇᴠ: ${DEVELOPER}\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ ✔️`;
            await sock.sendMessage(`${num}@s.whatsapp.net`, { text: welcomeMsg, contextInfo: forwardedContext });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startUserBot(num);
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        await handleAutomations(sock, m, db);
    });
}

/**
 * 🌐 EXPRESS & PAIRING API
 */
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    if (!num) return res.status(400).send({ error: "No number" });

    try {
        const { useFirebaseAuthState } = require('./lib/firestoreAuth');
        const auth = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
        
        // FIX: Clear existing stale session to stop infinite loading
        if (auth.clearSession) await auth.clearSession();

        const pSock = makeWASocket({
            auth: auth.state,
            logger: pino({level:'silent'}),
            browser: Browsers.ubuntu("Chrome")
        });

        if (!pSock.authState.creds.registered) {
            await delay(1500);
            let code = await pSock.requestPairingCode(num);
            res.send({ code });
        }

        pSock.ev.on('creds.update', auth.saveCreds);
        pSock.ev.on('connection.update', (u) => {
            if (u.connection === 'open') {
                startUserBot(num);
                pSock.ev.removeAllListeners();
            }
        });
    } catch (e) { res.status(500).send({ error: "System Busy" }); }
});

// AUTO-RESTART ALL BOTS ON SERVER START
async function resumeAll() {
    const q = query(collection(db, "WT6_SESSIONS"));
    const snap = await getDocs(q);
    snap.forEach(doc => {
        if (!sessions.has(doc.id)) startUserBot(doc.id);
    });
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Wrong Turn 6 is live on ${PORT}`);
    resumeAll(); 
});
