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
    getContentType
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, updateDoc, collection, onSnapshot } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');

// 1. FIREBASE WEB SDK CONFIG
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

// PREMIUM FORWARDING WRAPPER
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
    }
};

// 2. COMMAND LOADER
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

// 3. MAIN BOT ENGINE
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

    // CONNECTION & WELCOME
    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WRONG TURN BOT: ARMED");
            const welcomeMsg = `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ\nᴠᴇʀꜱɪᴏɴ: 𝟼.𝟼.𝟶\n\nꜱᴛᴀᴛᴜꜱ: ᴄᴏɴɴᴇᴄᴛᴇᴅ ✔️`;
            await sock.sendMessage(sock.user.id, { text: welcomeMsg, contextInfo: forwardedContext });
        }
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        }
    });

    // GROUP EVENTS (WELCOME/GOODBYE/AUTO-KICK)
    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu;
        const setSnap = await getDoc(doc(db, "SETTINGS", id));
        const s = setSnap.exists() ? setSnap.data() : { welcome: true, goodbye: true };

        for (let num of participants) {
            const groupLogo = await sock.profilePictureUrl(id, 'image').catch(() => 'https://files.catbox.moe/59ays3.jpg');
            const metadata = await sock.groupMetadata(id);

            if (action === 'add' && s.welcome) {
                const welcomeText = `*ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ* ${metadata.subject}\n\nᴜꜱᴇʀ: @${num.split('@')[0]}\n\n"ᴋɴᴏᴡʟᴇᴅɢᴇ ɪꜱ ᴛʜᴇ ᴏɴʟʏ ᴡᴀʏ ᴏᴜᴛ."\n\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ`;
                await sock.sendMessage(id, { image: { url: groupLogo }, caption: welcomeText, mentions: [num], contextInfo: forwardedContext });
            }
            if (action === 'remove' && s.goodbye) {
                const byeText = `@${num.split('@')[0]} ʜᴀꜱ ʟᴇꜰᴛ ᴛʜᴇ ᴍᴀɪɴꜰʀᴀᴍᴇ. 🥀`;
                await sock.sendMessage(id, { text: byeText, mentions: [num], contextInfo: forwardedContext });
            }
        }
    });

    // MESSAGE PROCESSING
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || "").trim();
        const type = getContentType(m.message);

        msgCache.set(m.key.id, m);

        // FETCH SETTINGS
        const globalSnap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const s = globalSnap.exists() ? globalSnap.data() : { autoType: true, autoRecord: true, antiDelete: true, antiViewOnce: true, autoAI: true, forceJoin: true };

        const ownerId = sock.user.id.split(':')[0];
        const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

        // --- SECURITY FILTERS ---
        if (from.endsWith('@g.us') && !isOwner) {
            const isScam = /(bundle|fixed match|earn money|invest|free data|wa.me\/settings)/gi.test(body);
            const isPorn = /(porn|xxx|nude|sex|vixen|ngono)/gi.test(body);
            const isLink = body.includes('http');
            const isMedia = (type === 'imageMessage' || type === 'videoMessage' || type === 'audioMessage');

            if (isScam || isPorn || isLink || isMedia) {
                await sock.sendMessage(from, { delete: m.key });
                // Optional: await sock.groupParticipantsUpdate(from, [sender], "remove");
            }
        }

        // --- ANTI-DELETE & ANTI-VIEWONCE ---
        if (m.message.protocolMessage?.type === 0 && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ:* recovered from @${sender.split('@')[0]}`, mentions: [sender] });
                await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
            }
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ ʙʏᴘᴀꜱꜱ*` });
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // --- AUTO PRESENCE ---
        if (s.autoType) await sock.sendPresenceUpdate('composing', from);
        if (s.autoRecord && Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);

        // --- FORCE JOIN ---
        if (body.startsWith('.') && !isOwner && s.forceJoin) {
            const groupJid = '120363406549688641@g.us';
            try {
                const groupMetadata = await sock.groupMetadata(groupJid);
                if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    const deny = `❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ ᴏᴜʀ ɢʀᴏᴜᴘ/ᴄʜᴀɴɴᴇʟ ᴛᴏ ᴜꜱᴇ ʙᴏᴛ.\n\n🥀 *ᴅᴇᴠ:* ꜱᴛᴀɴʏᴛᴢ\n🛡️ *ʙᴏᴛ:* ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼`;
                    return sock.sendMessage(from, { text: deny, contextInfo: forwardedContext });
                }
            } catch (e) {}
        }

        // --- AUTO AI CHAT (No Command Required) ---
        if (!from.endsWith('@g.us') && !body.startsWith('.') && !m.key.fromMe && s.autoAI && body.length > 1) {
            try {
                const aiRes = await axios.get(`https://text.pollinations.ai/You%20are%20WRONG%20TURN%206%20AI%20by%20STANYTZ.%20Reply%20briefly%20and%20naturally%20to:%20${encodeURIComponent(body)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // --- STATUS ENGINE ---
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]);
            const mood = /(sad|😭|💔)/.test(body.toLowerCase()) ? "Stay strong. 🥀" : "Observed. 🥂";
            await sock.sendMessage(from, { text: mood }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
        }

        // --- COMMAND EXECUTION ---
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

// PAIRING API
app.get('/code', async (req, res) => {
    const pSock = makeWASocket({ auth: { creds: initAuthCreds(), keys: makeCacheableSignalKeyStore({}, pino({level:'silent'})) }, logger: pino({level:'silent'}), browser: Browsers.macOS("Safari") });
    await delay(3000);
    let code = await pSock.requestPairingCode(req.query.number.replace(/\D/g, ''));
    res.send({ code });
    pSock.ev.on('creds.update', async (creds) => { await setDoc(doc(db, "WT6_SESSIONS", "MASTER_creds"), JSON.parse(JSON.stringify(creds, BufferJSON.replacer))); });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(process.env.PORT || 3000, startBot);
