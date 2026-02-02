require('dotenv').config();
const { 
    default: makeWASocket, DisconnectReason, Browsers, delay, getContentType, 
    makeCacheableSignalKeyStore, jidDecode, proto 
} = require('xmd-baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, updateDoc, collection, query, getDocs, deleteDoc, where } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');

// --- IDENTITY & CONFIG ---
const DEVELOPER = "StanyTz";
const NEWSLETTER_JID = '120363404317544295@newsletter';
const OFFICIAL_GROUP = '120363406549688641@g.us';

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
const sessions = new Map();
const msgCache = new Map();
const replyState = new Map();

// --- PREMIUM UI HELPERS ---
const kishuwa = (text) => {
    const fonts = {'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 's', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ'};
    return text.toLowerCase().split('').map(char => fonts[char] || char).join('');
};

const premiumBox = (title, items) => {
    let box = `╭── • 🥀 • ──╮\n`;
    box += `  ${kishuwa(title)}\n`;
    box += `╰── • 🥀 • ──╯\n\n`;
    items.forEach(item => { box += `│ ◦ ${kishuwa(item)}\n`; });
    box += `└──────────────\n\n`;
    box += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ${DEVELOPER}_`;
    return box;
};

const newsletterContext = {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: { newsletterJid: NEWSLETTER_JID, serverMessageId: 1, newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀' }
};

// --- COMMAND LOADER (SUBFOLDERS) ---
const loadCommands = () => {
    const cmdPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    const categories = fs.readdirSync(cmdPath);
    for (let cat of categories) {
        const catPath = path.join(cmdPath, cat);
        if (fs.lstatSync(catPath).isDirectory()) {
            const files = fs.readdirSync(catPath).filter(f => f.endsWith('.js'));
            for (let file of files) {
                const cmd = require(path.join(catPath, file));
                commands.set(cmd.name.toLowerCase(), cmd);
            }
        }
    }
};

/**
 * 🛡️ SUPREME SECURITY ENGINE (ANTI-EVERYTHING)
 */
async function handleSecurity(sock, m, db) {
    try {
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const type = getContentType(m.message);
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
        const isGroup = from.endsWith('@g.us');
        const ownerId = sock.user.id.split(':')[0];
        const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

        // FETCH USER SETTINGS
        const sSnap = await getDoc(doc(db, "SETTINGS", ownerId));
        const s = sSnap.exists() ? sSnap.data() : { 
            antiDelete: true, antiViewOnce: true, antiLink: true, antiScam: true, 
            antiPorn: true, antiMedia: true, action: 'remove', emojiMenu: "🥀", prefix: "."
        };

        // 1. FORCE MEMBERSHIP
        if (isGroup && !isOwner) {
            const gMeta = await sock.groupMetadata(OFFICIAL_GROUP).catch(() => null);
            if (gMeta && !gMeta.participants.find(p => p.id === sender)) {
                await sock.sendMessage(from, { text: kishuwa("❌ ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ. ᴊᴏɪɴ ᴏᴜʀ ᴄʜᴀɴɴᴇʟ & ᴏꜰꜰɪᴄɪᴀʟ ɢʀᴏᴜᴘ!") });
                return false;
            }
        }

        // 2. INBOX RECOVERY (Anti-Delete / Anti-ViewOnce)
        if (m.message.protocolMessage?.type === 0 && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: kishuwa(`🛡️ ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ ꜰʀᴏᴍ @${sender.split('@')[0]}`), mentions: [sender], contextInfo: newsletterContext });
                await sock.copyNForward(sock.user.id, cached, false);
            }
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.sendMessage(sock.user.id, { text: kishuwa(`🛡️ ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ ꜰʀᴏᴍ @${sender.split('@')[0]}`), mentions: [sender], contextInfo: newsletterContext });
            await sock.copyNForward(sock.user.id, m, false);
        }

        // 3. ANTI-VIOLATION (Link, Porn, Scam, TagAll, Media)
        const isScam = /bundle|fixed match|investment|earn money/gi.test(body) || (s.customScam && body.includes(s.customScam));
        const isPorn = /porn|xxx|sex|🔞|ngono/gi.test(body);
        const isLink = /chat.whatsapp.com|http:\/\/|https:\/\//gi.test(body);
        const isTagStatus = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes('status@broadcast');
        const isMedia = (type === 'audioMessage' || type === 'imageMessage' || type === 'stickerMessage') && s.antiMedia;

        if (isGroup && !isOwner && (isScam || isPorn || isLink || isTagStatus || isMedia)) {
            await sock.sendMessage(from, { delete: m.key });
            if (s.action === 'remove') await sock.groupParticipantsUpdate(from, [sender], "remove");
            await sock.sendMessage(from, { text: kishuwa(`‼️ @${sender.split('@')[0]} sᴇᴄᴜʀɪᴛʏ ᴠɪᴏʟᴀᴛɪᴏɴ. ᴀᴄᴛɪᴏɴ ᴛᴀᴋᴇɴ.`), mentions: [sender] });
            return false;
        }

        // 4. ACTIVITY TRACKER
        if (isGroup) {
            await setDoc(doc(db, `ACTIVITY_${from}`, sender), { lastSeen: Date.now(), name: m.pushName || 'User' }, { merge: true });
        }

        return true;
    } catch (e) { return true; }
}

/**
 * 🤖 MAIN START LOGIC (MULTI-USER)
 */
async function startUserBot(num) {
    if (sessions.has(num)) {
        try { sessions.get(num).terminate(); } catch (e) {}
    }

    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", num);

    const sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Safari"),
        markOnlineOnConnect: true,
        printQRInTerminal: false
    });

    sessions.set(num, sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (up) => {
        const { connection, lastDisconnect } = up;
        if (connection === 'open') {
            const welcome = premiumBox("sʏsᴛᴇᴍ ᴄᴏɴɴᴇᴄᴛᴇᴅ", ["sᴛᴀᴛᴜs: ᴏɴʟɪɴᴇ", "ᴏᴡɴᴇʀ: " + num, "sᴇᴄᴜʀɪᴛʏ: ᴍᴀx"]);
            await sock.sendMessage(`${num}@s.whatsapp.net`, { text: welcome, contextInfo: newsletterContext });
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startUserBot(num);
            else sessions.delete(num);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();

        // 1. AUTO STATUS (View, Like, AI Deep Thinking)
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]);
            const emojis = ['🥀', '❤️', '🔥', '⚡', '🙌'];
            await sock.sendMessage(from, { react: { text: emojis[Math.floor(Math.random()*5)], key: m.key } }, { statusJidList: [sender] });
            const aiStatus = await axios.get(`https://text.pollinations.ai/Natural deep react to status: ${body || 'Visual'}`);
            await sock.sendMessage(from, { text: kishuwa(aiStatus.data) }, { quoted: m });
            return;
        }

        // 2. AUTO PRESENCE (Human Behavior)
        await sock.sendPresenceUpdate(Math.random() > 0.5 ? 'composing' : 'recording', from);

        // 3. SECURITY & COMMANDS
        const allowed = await handleSecurity(sock, m, db);
        if (!allowed) return;
        msgCache.set(m.key.id, m);

        // 4. COMMAND LOGIC (Emoji Prefix, Reply by Number, No Prefix)
        const ownerId = sock.user.id.split(':')[0];
        const sSnap = await getDoc(doc(db, "SETTINGS", ownerId));
        const s = sSnap.exists() ? sSnap.data() : { prefix: ".", emojiMenu: "🥀", autoAI: true };

        let cmdName = "";
        let args = [];

        if (body === s.emojiMenu) {
            cmdName = "menu";
        } else if (!isNaN(body) && replyState.has(sender)) {
            // Logic ya Reply by number ingekaa hapa...
        } else if (body.startsWith(s.prefix)) {
            args = body.slice(s.prefix.length).trim().split(/ +/);
            cmdName = args.shift().toLowerCase();
        } else {
            args = body.split(/ +/);
            cmdName = args.shift().toLowerCase();
        }

        const cmd = commands.get(cmdName);
        if (cmd) {
            await cmd.execute(sock, m, args, db, newsletterContext);
        } else if (!from.endsWith('@g.us') && s.autoAI && body.length > 3) {
            const aiRes = await axios.get(`https://text.pollinations.ai/Your name is Wrong Turn 6. Chat naturally: ${body}`);
            await sock.sendMessage(from, { text: kishuwa(aiRes.data), contextInfo: newsletterContext }, { quoted: m });
        }
    });

    // 5. WELCOME & GOODBYE
    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu;
        const metadata = await sock.groupMetadata(id);
        const name = participants[0];
        if (action === 'add') {
            const welcome = premiumBox("ᴡᴇʟᴄᴏᴍᴇ", [`ᴜsᴇʀ: @${name.split('@')[0]}`, `ɢʀᴏᴜᴘ: ${metadata.subject}`, `ᴅᴇsᴄ: ${metadata.desc || 'ɴᴏɴᴇ'}`]);
            await sock.sendMessage(id, { image: { url: await sock.profilePictureUrl(id, 'image').catch(() => 'https://files.catbox.moe/59ays3.jpg') }, caption: welcome, mentions: [name], contextInfo: newsletterContext });
        }
    });
}

// --- EXPRESS & PAIRING ---
app.use(express.static('public'));
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    try {
        const { useFirebaseAuthState } = require('./lib/firestoreAuth');
        const auth = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
        if (auth.clearSession) await auth.clearSession();
        const pSock = makeWASocket({ auth: { creds: auth.state.creds, keys: makeCacheableSignalKeyStore(auth.state.keys, pino({ level: 'silent' })) }, logger: pino({ level: 'silent' }), browser: Browsers.ubuntu("Chrome") });
        if (!pSock.authState.creds.registered) {
            await delay(3000);
            let code = await pSock.requestPairingCode(num);
            res.send({ code });
        }
        pSock.ev.on('creds.update', auth.saveCreds);
        pSock.ev.on('connection.update', (u) => { if (u.connection === 'open') startUserBot(num); });
    } catch (e) { res.status(500).send({ error: "System Busy" }); }
});

async function resumeAll() {
    loadCommands();
    const snap = await getDocs(collection(db, "WT6_SESSIONS"));
    snap.forEach(doc => { if (!sessions.has(doc.id)) startUserBot(doc.id); });
}

process.on('SIGTERM', () => {
    sessions.forEach(s => s.terminate());
    process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Armed: ${PORT}`); resumeAll(); });
