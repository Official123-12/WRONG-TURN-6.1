require('dotenv').config();
const { 
    default: makeWASocket, DisconnectReason, Browsers, delay, fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, initAuthCreds, BufferJSON, getContentType 
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc, collection, query, getDocs, where } = require('firebase/firestore');
const express = require('express');
const pino = require('pino');
const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');

// 🟢 GLOBAL STABILITY
process.on('unhandledRejection', e => console.log('🛡️ Rejection Shield:', e));
process.on('uncaughtException', e => console.log('🛡️ Exception Shield:', e));

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
const activeSessions = new Map(); 

const newsletterJid = '120363404317544295@newsletter';
const groupJid = '120363406549688641@g.us';

// 💎 PREMIUM FORWARDING MASK
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
 * 🔐 ARMED SECURITY SCANNER (Warn, Delete, Remove)
 */
async function armedScanner(sock, m, s, isOwner) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase();
    const type = getContentType(m.message);

    if (!from.endsWith('@g.us') || isOwner) return false;

    const scams = ["bundle", "fixed match", "earn money", "investment", "wa.me/settings"];
    const isPorn = /(porn|xxx|sex|ngono|vixen|🔞)/gi.test(body);
    
    if ((s.antiLink && body.match(/https?:\/\/[^\s]+/gi)) || (s.antiScam && scams.some(w => body.includes(w))) || (s.antiPorn && isPorn)) {
        await sock.sendMessage(from, { delete: m.key });
        await sock.sendMessage(from, { 
            text: `❌ *ꜱᴇᴄᴜʀɪᴛʏ ᴀᴄᴛɪᴏɴ*\nᴜꜱᴇʀ: @${sender.split('@')[0]}\nʀᴇᴀꜱᴏɴ: Restricted Content\n\n_ꜱʏꜱᴛᴇᴍ: ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼_`,
            mentions: [sender],
            contextInfo: forwardedContext
        });
        if (isPorn || scams.some(w => body.includes(w))) await sock.groupParticipantsUpdate(from, [sender], "remove");
        return true;
    }
    return false;
}

/**
 * 🧠 SUPREME INJECTED LOGIC
 */
async function handleSupremeLogic(sock, m, db, num) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
    const type = getContentType(m.message);

    msgCache.set(m.key.id, m);
    const ownerId = sock.user.id.split(':')[0];
    const isOwner = sender.startsWith(num) || m.key.fromMe;

    const setSnap = await getDoc(doc(db, "SETTINGS", ownerId));
    const s = setSnap.exists() ? setSnap.data() : { prefix: ".", mode: "public", autoAI: true, forceJoin: true, autoStatus: true, antiDelete: true, antiViewOnce: true, autoReact: true };

    if (s.mode === "private" && !isOwner) return;

    // A. AUTO PRESENCE & REACT
    if (s.autoReact && !m.key.fromMe) await sock.sendMessage(from, { react: { text: '🥀', key: m.key } });
    await sock.sendPresenceUpdate('composing', from);
    if (Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);

    // B. SECURITY SCANNER
    if (await armedScanner(sock, m, s, isOwner)) return;

    // C. ANTI-DELETE & VIEWONCE (Forward to User DM)
    if (m.message?.protocolMessage?.type === 0 && s.antiDelete && !m.key.fromMe) {
        const cached = msgCache.get(m.message.protocolMessage.key.id);
        if (cached) {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ* Recovered from @${sender.split('@')[0]}`, mentions: [sender] });
            await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
        }
    }
    if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
        await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ* Bypass` });
        await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
    }

    // D. FORCE JOIN
    const prefix = s.prefix || ".";
    const isCmd = body.startsWith(prefix) || commands.has(body.split(' ')[0].toLowerCase());
    if (isCmd && !isOwner && s.forceJoin) {
        const groupMetadata = await sock.groupMetadata(groupJid);
        if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
            return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
        }
    }

    // E. AUTO STATUS ENGINE
    if (from === 'status@broadcast' && s.autoStatus) {
        await sock.readMessages([m.key]);
        const moodRes = await axios.get(`https://text.pollinations.ai/React as a human friend in 1 short English sentence: "${body}". No quotes.`);
        await sock.sendMessage(from, { text: moodRes.data, contextInfo: forwardedContext }, { quoted: m });
        await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
    }

    // F. UNIVERSAL AI CHAT (Natural Human Persona)
    if (!isCmd && !m.key.fromMe && s.autoAI && body.length > 2 && !from.endsWith('@g.us')) {
        try {
            const aiRes = await axios.get(`https://text.pollinations.ai/Your name is WRONG TURN 6. Developer: STANYTZ. Chat naturally and helpfully in the user's language to: ${encodeURIComponent(body)}`);
            await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) {}
    }

    // G. REPLY-BY-NUMBER LOGIC
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = (quoted?.conversation || quoted?.extendedTextMessage?.text || "").toLowerCase();
    if (quoted && !isNaN(body) && body.length > 0) {
        for (let [name, obj] of commands) {
            if (quotedText.includes(name)) { await obj.execute(m, sock, Array.from(commands.values()), [body.trim()], db, forwardedContext); return; }
        }
    }

    // H. COMMAND EXECUTION (Support Prefix & No-Prefix)
    let cmdName = body.startsWith(prefix) ? body.slice(prefix.length).trim().split(/ +/)[0].toLowerCase() : body.split(' ')[0].toLowerCase();
    let args = body.startsWith(prefix) ? body.slice(prefix.length).trim().split(/ +/).slice(1) : body.split(' ').slice(1);
    const cmd = commands.get(cmdName);
    if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
}

/**
 * 🦾 ENGINE BOOTSTRAP (SINGLETON RESTORE)
 */
async function startUserBot(num) {
    if (activeSessions.has(num)) return;
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
    
    const sockInstance = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    activeSessions.set(num, sockInstance);
    sockInstance.ev.on('creds.update', saveCreds);

    sockInstance.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            await setDoc(doc(db, "ACTIVE_USERS", num), { active: true });
            const welcome = `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ ✔️`;
            await sockInstance.sendMessage(sockInstance.user.id, { text: welcome, contextInfo: forwardedContext });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            activeSessions.delete(num);
            startUserBot(num);
        }
    });

    sockInstance.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        await handleSupremeLogic(sockInstance, m, db, num);
    });
}

/**
 * 🟢 THE SOVEREIGN INDEX ROUTE (Health check for Render)
 */
app.get('/', (req, res) => {
    res.status(200).send(`
        <body style="background:#000;color:#ff0000;font-family:sans-serif;text-align:center;padding-top:100px;">
            <img src="https://files.catbox.moe/59ays3.jpg" style="width:150px;border-radius:50%;border:2px solid #ff0000;">
            <h1>W R O N G  T U R N  6</h1>
            <p>MAINFRAME STATUS: <span style="color:#00ff00">OPERATIONAL</span></p>
            <p>TOTAL SESSIONS: ${activeSessions.size}</p>
            <p style="color:#444">DEVELOPED BY STANYTZ</p>
        </body>
    `);
});

app.use(express.static('public'));
app.get('/link', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

// 🔥 PAIRING ROUTE (ZERO ERRORS)
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    try {
        const { useFirebaseAuthState } = require('./lib/firestoreAuth');
        const { state, saveCreds, wipeSession } = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
        await wipeSession();
        const pSock = makeWASocket({
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu("Chrome")
        });
        pSock.ev.on('creds.update', saveCreds);
        await delay(5000);
        let code = await pSock.requestPairingCode(num);
        res.send({ code });
        pSock.ev.on('connection.update', (u) => { if (u.connection === 'open') { pSock.end?.(); startUserBot(num); } });
    } catch (e) { res.status(500).send({ error: "System Busy" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    // Command Loader Initialization
    const cmdPath = path.resolve(__dirname, 'commands');
    if (fs.existsSync(cmdPath)) {
        fs.readdirSync(cmdPath).forEach(folder => {
            const folderPath = path.join(cmdPath, folder);
            if (fs.lstatSync(folderPath).isDirectory()) {
                fs.readdirSync(folderPath).filter(f => f.endsWith('.js')).forEach(file => {
                    const cmd = require(path.join(folderPath, file));
                    if (cmd && cmd.name) { cmd.category = folder; commands.set(cmd.name.toLowerCase(), cmd); }
                });
            }
        });
    }
    // 🟢 AUTO-RESTORE ALL SESSIONS
    getDocs(collection(db, "ACTIVE_USERS")).then(snap => snap.forEach(d => d.data().active && startUserBot(d.id)));
});

// Always Online Heartbeat & Bio
setInterval(async () => {
    for (let s of activeSessions.values()) {
        if (s.user) {
            const up = Math.floor(process.uptime() / 3600);
            await s.updateProfileStatus(`WRONG TURN 6 🥀 | ONLINE | UPTIME: ${up}h Active`).catch(() => {});
            await s.sendPresenceUpdate('available');
        }
    }
}, 30000);
