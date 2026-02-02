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

// --- FONTS ZA KISHUWA HELPER ---
const kishuwa = (text) => {
    const fonts = {
        'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 's', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ'
    };
    return text.toLowerCase().split('').map(char => fonts[char] || char).join('');
};

const newsletterContext = {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: NEWSLETTER_JID,
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀'
    }
};

// --- 1. DYNAMIC COMMAND LOADER (SUBFOLDERS) ---
const loadCommands = () => {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) fs.mkdirSync(commandsPath);
    
    commands.clear();
    const categories = fs.readdirSync(commandsPath);
    
    categories.forEach(category => {
        const categoryPath = path.join(commandsPath, category);
        if (fs.lstatSync(categoryPath).isDirectory()) {
            const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
            commandFiles.forEach(file => {
                try {
                    const cmd = require(path.join(categoryPath, file));
                    cmd.category = category; // Auto-assign category based on folder name
                    commands.set(cmd.name.toLowerCase(), cmd);
                } catch (e) { console.error(`Error loading ${file}:`, e); }
            });
        }
    });
};

// --- 2. DYNAMIC MENU GENERATOR ---
const generateMenu = (sock, m, selectedCategory = 'all', prefix = '.') => {
    const uptimeSeconds = process.uptime();
    const uptime = `${Math.floor(uptimeSeconds / 3600)}ʜ ${Math.floor((uptimeSeconds % 3600) / 60)}ᴍ`;
    
    let menuText = `╭─── • 🥀 • ───╮\n  ᴡ ʀ ᴏ ɴ ɢ  ᴛ ᴜ ʀ ɴ  𝟼 \n╰─── • 🥀 • ───╯\n\n`;
    menuText += `┌  🥀  *ꜱʏꜱᴛᴇᴍ  ɪɴꜰᴏ*\n`;
    menuText += `│  ᴜꜱᴇʀ: ${m.pushName || 'Subscriber'}\n`;
    menuText += `│  ᴍᴏᴅᴇ: PUBLIC\n`;
    menuText += `│  ᴘʀᴇꜰɪx: [ ${prefix} ]\n`;
    menuText += `│  ᴛᴏᴛᴀʟ: ${commands.size} ᴄᴍᴅꜱ\n`;
    menuText += `│  ᴜᴘᴛɪᴍᴇ: ${uptime}\n`;
    menuText += `│  ᴅᴇᴠ: ${DEVELOPER}\n`;
    menuText += `└──────────────\n\n`;

    // Group commands by category
    const categorized = {};
    commands.forEach(cmd => {
        if (!categorized[cmd.category]) categorized[cmd.category] = [];
        categorized[cmd.category].push(cmd.name);
    });

    // Display Categories
    Object.keys(categorized).sort().forEach(cat => {
        if (selectedCategory !== 'all' && selectedCategory.toLowerCase() !== cat.toLowerCase()) return;
        
        menuText += `╭── • *${cat.toUpperCase()}* •\n`;
        categorized[cat].sort().forEach(name => {
            menuText += `│ ◦ ${prefix}${name}\n`;
        });
        menuText += `╰──────────────\n\n`;
    });

    menuText += `_©️ 𝟮𝟬𝟮𝟲 ꜱᴛᴀɴʏᴛᴢ ɪɴᴅᴜꜱᴛʀɪᴇs_`;
    return kishuwa(menuText);
};

// --- 3. AUTO BIO LOGIC ---
const startAutoBio = (sock) => {
    setInterval(async () => {
        if (!sock.user) return;
        const uptime = `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`;
        const bios = [
            `Wrong Turn 6 | Security: Armed 🛡️`,
            `Uptime: ${uptime} | Dev: StanyTz 🥀`,
            `The Ultimate Supreme Bot Engine 🧿`,
            `Always Online & Protected ✔️`
        ];
        const bio = kishuwa(bios[Math.floor(Math.random() * bios.length)]);
        await sock.updateProfileStatus(bio).catch(() => {});
    }, 60000 * 5);
};

// --- 4. SUPREME AUTOMATIONS (SECURITY & AUTO-STATUS) ---
async function handleAutomations(sock, m, db) {
    try {
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const type = getContentType(m.message);
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();
        const ownerId = sock.user.id.split(':')[0];
        const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

        // FETCH SETTINGS
        const sSnap = await getDoc(doc(db, "SETTINGS", ownerId));
        const s = sSnap.exists() ? sSnap.data() : { antiDelete: true, antiViewOnce: true, antiScam: true, scamWords: ['bundle', 'fixed match'], action: 'remove', autoStatus: true, autoAI: true, prefix: '.', emojiMenu: '🥀' };

        // 1. AUTO STATUS (VIEW, REACT, AI REPLY)
        if (from === 'status@broadcast' && s.autoStatus) {
            await sock.readMessages([m.key]);
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
            const aiRes = await axios.get(`https://text.pollinations.ai/Natural deep react to status: ${body || 'Visual content'}`);
            await sock.sendMessage(from, { text: kishuwa(aiRes.data) }, { quoted: m });
        }

        // 2. INBOX RECOVERY (ANTI-DELETE/VIEWONCE)
        if (m.message.protocolMessage?.type === 0 && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: kishuwa(`🛡️ ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ: @${sender.split('@')[0]} ꜰᴜᴛᴀ ᴍᴇssᴀɢᴇ`), mentions: [sender], contextInfo: newsletterContext });
                await sock.copyNForward(sock.user.id, cached, false);
            }
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.sendMessage(sock.user.id, { text: kishuwa(`🛡️ ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ ᴄᴀᴘᴛᴜʀᴇᴅ ꜰʀᴏᴍ @${sender.split('@')[0]}`), mentions: [sender], contextInfo: newsletterContext });
            await sock.copyNForward(sock.user.id, m, false);
        }

        // 3. SECURITY (LINK, SCAM, PORN, BOT, TAG STATUS)
        const isGroup = from.endsWith('@g.us');
        const isScam = s.scamWords.some(w => body.toLowerCase().includes(w));
        const isLink = /chat.whatsapp.com|http:\/\/|https:\/\//gi.test(body);
        const isTagStatus = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes('status@broadcast');

        if (isGroup && !isOwner && (isScam || isLink || isTagStatus)) {
            await sock.sendMessage(from, { delete: m.key });
            if (s.action === 'remove') await sock.groupParticipantsUpdate(from, [sender], "remove");
            return false;
        }

        return true;
    } catch (e) { return true; }
}

// --- 5. START USER BOT ---
async function startUserBot(num) {
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", num);

    const sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Safari"),
        markOnlineOnConnect: true
    });

    sessions.set(num, sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (up) => {
        const { connection, lastDisconnect } = up;
        if (connection === 'open') {
            const welcomeMsg = kishuwa(`🥀 ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 ᴀᴄᴛɪᴠᴀᴛᴇᴅ\n\nsʏsᴛᴇᴍ: sᴇᴄᴜʀᴇ\nᴅᴇᴠ: sᴛᴀɴʏᴛᴢ`);
            await sock.sendMessage(`${num}@s.whatsapp.net`, { text: welcomeMsg, contextInfo: newsletterContext });
            startAutoBio(sock);
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startUserBot(num);
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();

        // Auto Typing/Recording
        await sock.sendPresenceUpdate(Math.random() > 0.5 ? 'composing' : 'recording', from);

        // Security Check
        const allowed = await handleAutomations(sock, m, db);
        if (!allowed) return;
        msgCache.set(m.key.id, m);

        // COMMAND HANDLING
        const ownerId = sock.user.id.split(':')[0];
        const sSnap = await getDoc(doc(db, "SETTINGS", ownerId));
        const s = sSnap.exists() ? sSnap.data() : { prefix: '.', emojiMenu: '🥀' };

        // Logic: Menu, Category, or All
        if (body === s.emojiMenu || body.toLowerCase() === 'menu' || body === s.prefix + 'menu') {
            const menu = generateMenu(sock, m, 'all', s.prefix);
            return await sock.sendMessage(from, { text: menu, contextInfo: newsletterContext });
        }

        // Logic: Category Specific Menu (e.g., .wealth)
        const possibleCat = body.startsWith(s.prefix) ? body.slice(s.prefix.length).toLowerCase() : body.toLowerCase();
        const cats = [...new Set(Array.from(commands.values()).map(c => c.category.toLowerCase()))];
        if (cats.includes(possibleCat)) {
            const catMenu = generateMenu(sock, m, possibleCat, s.prefix);
            return await sock.sendMessage(from, { text: catMenu, contextInfo: newsletterContext });
        }

        // Command Execute (Prefix or No Prefix)
        let cmdName = "";
        let args = [];
        if (body.startsWith(s.prefix)) {
            args = body.slice(s.prefix.length).trim().split(/ +/);
            cmdName = args.shift().toLowerCase();
        } else {
            args = body.split(/ +/);
            cmdName = args.shift().toLowerCase();
        }

        const cmd = commands.get(cmdName);
        if (cmd) {
            await cmd.execute(sock, m, args, db, newsletterContext);
        }
    });
}

// --- 6. API & DEPLOYMENT ---
app.use(express.static('public'));
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const auth = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
    if (auth.clearSession) await auth.clearSession();
    const pSock = makeWASocket({ auth: { creds: auth.state.creds, keys: makeCacheableSignalKeyStore(auth.state.keys, pino({ level: 'silent' })) }, logger: pino({ level: 'silent' }), browser: Browsers.ubuntu("Chrome") });
    if (!pSock.authState.creds.registered) {
        await delay(2000);
        let code = await pSock.requestPairingCode(num);
        res.send({ code });
    }
    pSock.ev.on('creds.update', auth.saveCreds);
    pSock.ev.on('connection.update', (u) => { if (u.connection === 'open') startUserBot(num); });
});

async function resumeAll() {
    loadCommands();
    const snap = await getDocs(collection(db, "WT6_SESSIONS"));
    snap.forEach(doc => { if (!sessions.has(doc.id)) startUserBot(doc.id); });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Armed on ${PORT}`); resumeAll(); });
