require('dotenv').config();
const { 
    default: makeWASocket, DisconnectReason, Browsers, delay, fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, initAuthCreds, BufferJSON, getContentType 
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, updateDoc, collection, query, getDocs } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');

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

// PREMIUM NEWSLETTER CONTEXT
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
    }
};

const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    fs.readdirSync(cmdPath).forEach(folder => {
        const folderPath = path.join(cmdPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            fs.readdirSync(folderPath).filter(f => f.endsWith('.js')).forEach(file => {
                const cmd = require(path.join(folderPath, file));
                if (cmd && cmd.name) {
                    cmd.category = folder;
                    commands.set(cmd.name.toLowerCase(), cmd);
                }
            });
        }
    });
};

/**
 * FEATURE INJECTION MODULE (AI, Security, Status)
 */
async function handleAutomations(sock, m, db) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
    const type = getContentType(m.message);

    msgCache.set(m.key.id, m);
    const ownerId = sock.user.id.split(':')[0];
    const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

    // FETCH SETTINGS
    const setSnap = await getDoc(doc(db, "SETTINGS", ownerId));
    const s = setSnap.exists() ? setSnap.data() : { autoAI: true, forceJoin: true, autoStatus: true, antiDelete: true, antiViewOnce: true, antiScam: true, antiPorn: true, antiMedia: false, prefix: "." };

    // 1. AUTO PRESENCE
    await sock.sendPresenceUpdate('composing', from);
    if (Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);

    // 2. REPLY-BY-NUMBER LOGIC
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = (quoted?.conversation || quoted?.extendedTextMessage?.text || "").toLowerCase();
    if (quoted && !isNaN(body) && body.length > 0) {
        for (let [cmdName, cmdObj] of commands) {
            if (quotedText.includes(cmdName)) {
                await cmdObj.execute(m, sock, Array.from(commands.values()), [body.trim()], db, forwardedContext);
                return;
            }
        }
    }

    // 3. ANTI-DELETE & VIEWONCE (Forward to Owner DM)
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

    // 4. FORCE JOIN (https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y)
    if (body.startsWith(s.prefix) && !isOwner && s.forceJoin) {
        try {
            const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
            const normalizedSender = sender.split(':')[0] + '@s.whatsapp.net';
            if (!groupMetadata.participants.find(p => p.id === normalizedSender)) {
                return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ ᴏᴜʀ ɢʀᴏᴜᴘ ᴛᴏ ᴜꜱᴇ ʙᴏᴛ:\nhttps://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
            }
        } catch (e) {}
    }

    // 5. STATUS ENGINE (HUMAN PERSONA)
    if (from === 'status@broadcast' && s.autoStatus) {
        await sock.readMessages([m.key]);
        const aiMood = await axios.get(`https://text.pollinations.ai/React as a natural friend to this status briefly in English: "${body}". No quotes.`);
        await sock.sendMessage(from, { text: aiMood.data, contextInfo: forwardedContext }, { quoted: m });
        await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
    }

    // 6. UNIVERSAL AUTO-AI CHAT (Group & Private)
    if (!body.startsWith(s.prefix) && !m.key.fromMe && s.autoAI && body.length > 2) {
        try {
            const aiRes = await axios.get(`https://text.pollinations.ai/Your name is WRONG TURN 6 by STANYTZ. Chat naturally and briefly in the user language to: ${encodeURIComponent(body)}`);
            await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) {}
    }

    // 7. PROTECTION (SCAM TAG-ALL / PORN / LINK / MEDIA)
    if (from.endsWith('@g.us') && !isOwner) {
        const isScam = /(bundle|fixed match|earn money|invest|wa.me\/settings)/gi.test(body);
        const isPorn = /(porn|xxx|nude|sex|vixen|ngono|🔞)/gi.test(body);
        if (isScam && s.antiScam) {
            const metadata = await sock.groupMetadata(from);
            const allMem = metadata.participants.map(v => v.id);
            await sock.sendMessage(from, { text: `‼️ *ꜱᴄᴀᴍ ᴅᴇᴛᴇᴄᴛᴇᴅ* ‼️\n@${sender.split('@')[0]} is spreading fraud. Be careful!`, mentions: allMem });
            await sock.sendMessage(from, { delete: m.key });
            await sock.groupParticipantsUpdate(from, [sender], "remove");
        }
        if (isPorn && s.antiPorn) await sock.sendMessage(from, { delete: m.key });
        if (body.includes('http') && s.antiLink) await sock.sendMessage(from, { delete: m.key });
        if (type.includes('Message') && s.antiMedia) await sock.sendMessage(from, { delete: m.key });
    }

    // 8. COMMAND EXECUTION
    if (body.startsWith(s.prefix)) {
        const args = body.slice(s.prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const cmd = commands.get(cmdName);
        if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
    }
}

async function startUserBot(num) {
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"],
        markOnlineOnConnect: true
    });

    sessions.set(num, sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            const welcomeMsg = `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ ✔️`;
            await sock.sendMessage(sock.user.id, { text: welcomeMsg, contextInfo: forwardedContext });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startUserBot(num);
    });

    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu;
        if (action === 'add') {
            const metadata = await sock.groupMetadata(id);
            const groupLogo = await sock.profilePictureUrl(id, 'image').catch(() => 'https://files.catbox.moe/59ays3.jpg');
            for (let n of participants) {
                let txt = `╭── • 🥀 • ──╮\n  ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ ᴍᴀɪɴꜰʀᴀᴍᴇ \n╰── • 🥀 • ──╯\n\n⚘ ᴜꜱᴇʀ : @${n.split('@')[0]}\n⚘ ɢʀᴏᴜᴘ : ${metadata.subject}\n⚘ ᴍᴇᴍʙᴇʀꜱ : ${metadata.participants.length}\n\n*ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ*:\n${metadata.desc || 'No description.'}`;
                await sock.sendMessage(id, { image: { url: groupLogo }, caption: txt, mentions: [n], contextInfo: forwardedContext });
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        await handleAutomations(sock, m, db);
    });

    // ALWAYS ONLINE & BIO
    setInterval(async () => {
        if (sock.user) {
            await sock.sendPresenceUpdate('available');
            const uptime = `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`;
            await sock.updateProfileStatus(`WRONG TURN 6 | ONLINE | UPTIME: ${uptime}`).catch(() => {});
        }
    }, 30000);
}

// PAIRING API (STABLE)
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    if (!num) return res.status(400).send({ error: "No number" });
    try {
        const { useFirebaseAuthState } = require('./lib/firestoreAuth');
        const auth = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
        await auth.clearSession();
        const pSock = makeWASocket({ auth: auth.state, logger: pino({level:'silent'}), browser: ["Ubuntu", "Chrome", "110.0.5481.177"] });
        await delay(5000);
        let code = await pSock.requestPairingCode(num);
        res.send({ code });
        pSock.ev.on('creds.update', auth.saveCreds);
        pSock.ev.on('connection.update', (u) => { if (u.connection === 'open') startUserBot(num); });
    } catch (e) { res.status(500).send({ error: "System Busy" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Armed: ${PORT}`); });
