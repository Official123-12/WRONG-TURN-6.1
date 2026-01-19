require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion, 
    initAuthCreds,
    BufferJSON,
    makeCacheableSignalKeyStore,
    getContentType,
    generateForwardMessageContent,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, updateDoc, collection } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');

// 1. FIREBASE CONFIG
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
let sock = null;

// PREMIUM FORWARDING CONTEXT (Newsletter ID Masking)
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
    }
};

// 2. MOOD ENGINE
const getMoodResponse = (text) => {
    const t = text.toLowerCase();
    if (/(sad|cry|pain|😭|💔)/.test(t)) return "ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 ᴅᴇᴛᴇᴄᴛᴇᴅ ꜱᴀᴅɴᴇꜱꜱ. ʙᴇ ꜱᴛʀᴏɴɢ. 🥀";
    if (/(happy|win|fire|🔥|🚀)/.test(t)) return "ꜱᴜᴄᴄᴇꜱꜱ ᴄᴏɴꜰɪʀᴍᴇᴅ. ᴋᴇᴇᴘ ᴡɪɴɴɪɴɢ! 🥂";
    if (/(money|cash|💰|💸)/.test(t)) return "ɢᴇᴛ ᴛʜᴀᴛ ᴍᴏɴᴇʏ! ᴡʀᴏɴɢ ᴛᴜʀɴ ᴀᴘᴘʀᴏᴠᴇꜱ. 💰";
    return "ᴏʙꜱᴇʀᴠᴇᴅ ʙʏ ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼. 🥀";
};

// 3. COMMAND LOADER
const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    fs.readdirSync(cmdPath).forEach(folder => {
        const folderPath = path.join(cmdPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            fs.readdirSync(folderPath).filter(f => f.endsWith('.js')).forEach(file => {
                try {
                    const cmd = require(path.join(folderPath, file));
                    if (cmd && cmd.name) {
                        cmd.category = folder;
                        commands.set(cmd.name.toLowerCase(), cmd);
                    }
                } catch (e) {}
            });
        }
    });
};

// 4. MAIN ENGINE START
async function startBot() {
    loadCmds();
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    sock.ev.on('creds.update', saveCreds);

    // CONNECTION & ONE-TIME WELCOME
    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WRONG TURN BOT: ARMED");
            await sock.sendMessage(sock.user.id, { 
                text: "ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ",
                contextInfo: forwardedContext
            });
        }
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        }
    });

    // GROUP UPDATES (WELCOME/GOODBYE)
    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu;
        const setSnap = await getDoc(doc(db, "SETTINGS", id));
        const s = setSnap.exists() ? setSnap.data() : { welcome: true };

        for (let num of participants) {
            if (action === 'add' && s.welcome) {
                const groupLogo = await sock.profilePictureUrl(id, 'image').catch(() => 'https://files.catbox.moe/59ays3.jpg');
                const welcome = `ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ ᴍᴀɪɴꜰʀᴀᴍᴇ 🥀\n\nᴜꜱᴇʀ: @${num.split('@')[0]}\n"ᴋɴᴏᴡʟᴇᴅɢᴇ ɪꜱ ᴛʜᴇ ᴏɴʟʏ ᴡᴀʏ ᴏᴜᴛ."\n\nᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ`;
                await sock.sendMessage(id, { image: { url: groupLogo }, caption: welcome, mentions: [num], contextInfo: forwardedContext });
            }
        }
    });

    // MESSAGE PROCESSING
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
        const type = getContentType(m.message);

        msgCache.set(m.key.id, m);

        // FETCH SETTINGS
        const setSnap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const s = setSnap.exists() ? setSnap.data() : { autoType: true, autoRecord: true, autoAI: true, antiDelete: true, antiViewOnce: true, forceJoin: true, autoStatus: true };

        const ownerId = sock.user.id.split(':')[0];
        const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

        // A. AUTO PRESENCE
        if (s.autoType) await sock.sendPresenceUpdate('composing', from);
        if (s.autoRecord && Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);

        // B. FORCE JOIN CHECK (Normalized ID)
        if (body.startsWith('.') && !isOwner && s.forceJoin) {
            const groupJid = '120363406549688641@g.us';
            try {
                const groupMetadata = await sock.groupMetadata(groupJid);
                if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ ᴏᴜʀ ɢʀᴏᴜᴘ ᴛᴏ ᴜꜱᴇ ʙᴏᴛ:\nhttps://chat.whatsapp.com/invite_link", contextInfo: forwardedContext });
                }
            } catch (e) {}
        }

        // C. ANTI-DELETE & ANTI-VIEWONCE (Auto-DM Forward)
        if (m.message.protocolMessage?.type === 0 && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ* @${sender.split('@')[0]}`, mentions: [sender] });
                await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
            }
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ* @${sender.split('@')[0]}`, mentions: [sender] });
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // D. ANTI-LINK / PORN / SCAM
        if (from.endsWith('@g.us') && !isOwner) {
            const isPorn = /(porn|xxx|nude|sex|vixen|ngono)/gi.test(body);
            const isScam = /(bundle|fixed match|earn money|invest|free data)/gi.test(body);
            if (isPorn || isScam || body.includes('http')) {
                await sock.sendMessage(from, { delete: m.key });
            }
        }

        // E. AUTO STATUS ENGINE
        if (from === 'status@broadcast' && s.autoStatus) {
            await sock.readMessages([m.key]);
            const mood = getMoodResponse(body);
            await sock.sendMessage(from, { text: mood }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
        }

        // F. UNIVERSAL AUTO AI CHAT (Global natural response in all languages)
        if (!body.startsWith('.') && !m.key.fromMe && s.autoAI && body.length > 2 && !from.endsWith('@g.us')) {
            try {
                const aiPrompt = `You are WRONG TURN 6 AI by STANYTZ. Respond naturally and helpfully to the following in its original language: ${body}`;
                const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // G. COMMAND HANDLER
        const prefix = s.prefix || ".";
        if (body.startsWith(prefix)) {
            const args = body.slice(prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
    setInterval(() => { if (sock?.user) sock.sendPresenceUpdate('available'); }, 15000);
}

// 5. STABLE PAIRING API
app.get('/code', async (req, res) => {
    let num = req.query.number;
    const pSock = makeWASocket({ auth: { creds: initAuthCreds(), keys: makeCacheableSignalKeyStore({}, pino({level:'silent'})) }, logger: pino({level:'silent'}), browser: Browsers.macOS("Safari") });
    await delay(3000);
    let code = await pSock.requestPairingCode(num.replace(/\D/g, ''));
    res.send({ code });
    pSock.ev.on('creds.update', async (creds) => { await setDoc(doc(db, "WT6_SESSIONS", "MASTER_creds"), JSON.parse(JSON.stringify(creds, BufferJSON.replacer))); });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(process.env.PORT || 3000, startBot);
