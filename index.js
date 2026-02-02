require('dotenv').config();
const { 
    default: makeWASocket, DisconnectReason, Browsers, delay, getContentType, 
    makeCacheableSignalKeyStore, jidDecode, proto 
} = require('xmd-baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, query, where } = require('firebase/firestore');
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

// --- PREMIUM FONTS (KISHUWA) ---
const kishuwa = (text) => {
    const fonts = {'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ꜰ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'s','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ'};
    return text.toLowerCase().split('').map(char => fonts[char] || char).join('');
};

const newsletterContext = {
    forwardingScore: 999, isForwarded: true,
    forwardedNewsletterMessageInfo: { newsletterJid: NEWSLETTER_JID, serverMessageId: 1, newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀' }
};

// --- DYNAMIC COMMAND LOADER (SUBFOLDERS) ---
const loadCommands = () => {
    const cmdPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    commands.clear();
    fs.readdirSync(cmdPath).forEach(cat => {
        const catPath = path.join(cmdPath, cat);
        if (fs.lstatSync(catPath).isDirectory()) {
            fs.readdirSync(catPath).forEach(file => {
                if (file.endsWith('.js')) {
                    const cmd = require(path.join(catPath, file));
                    cmd.category = cat;
                    commands.set(cmd.name.toLowerCase(), cmd);
                }
            });
        }
    });
};

// --- DYNAMIC MENU GENERATOR ---
const getMenu = (m, prefix, catSelected = 'all') => {
    const uptimeSeconds = process.uptime();
    const uptime = `${Math.floor(uptimeSeconds / 3600)}ʜ ${Math.floor((uptimeSeconds % 3600) / 60)}ᴍ`;
    let menu = `╭─── • 🥀 • ───╮\n  ᴡ ʀ ᴏ ɴ ɢ  ᴛ ᴜ ʀ ɴ  𝟼 \n╰─── • 🥀 • ───╯\n\n`;
    menu += `┌  🥀  *sʏsᴛᴇᴍ  ɪɴꜰᴏ*\n│  ᴜsᴇʀ: ${m.pushName || 'Subscriber'}\n│  ᴍᴏᴅᴇ: PUBLIC\n│  ᴘʀᴇꜰɪx: [ ${prefix} ]\n│  ᴛᴏᴛᴀʟ: ${commands.size} ᴄᴍᴅs\n│  ᴜᴘᴛɪᴍᴇ: ${uptime}\n│  ᴅᴇᴠ: ${DEVELOPER}\n└──────────────\n\n`;

    const cats = {};
    commands.forEach(c => { if (!cats[c.category]) cats[c.category] = []; cats[c.category].push(c.name); });
    
    Object.keys(cats).sort().forEach(cat => {
        if (catSelected !== 'all' && catSelected.toLowerCase() !== cat.toLowerCase()) return;
        menu += `╭── • *${cat.toUpperCase()}* •\n`;
        cats[cat].sort().forEach(cmd => menu += `│ ◦ ${prefix}${cmd}\n`);
        menu += `╰──────────────\n\n`;
    });
    return kishuwa(menu + `_©️ 2026 stanytz industries_`);
};

// --- SECURITY & AUTOMATION (THE CORE) ---
async function supremeAutomation(sock, m, db) {
    try {
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const type = getContentType(m.message);
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();
        const ownerId = sock.user.id.split(':')[0];
        const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

        const sSnap = await getDoc(doc(db, "SETTINGS", ownerId));
        const s = sSnap.exists() ? sSnap.data() : { 
            antiDelete: true, antiViewOnce: true, antiScam: true, antiPorn: true, 
            antiLink: true, antiMedia: false, antiTag: true, autoStatus: true,
            autoAI: true, action: 'remove', scamWords: ['bundle', 'fixed match', 'investment'] 
        };

        // 1. AUTO STATUS (View, Like, AI Deep Thinking Reply)
        if (from === 'status@broadcast' && s.autoStatus) {
            await sock.readMessages([m.key]);
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
            const aiRes = await axios.get(`https://text.pollinations.ai/Natural deep thinking reaction to this status: ${body || 'visual status'}`);
            await sock.sendMessage(from, { text: kishuwa(aiRes.data) }, { quoted: m });
        }

        // 2. INBOX RECOVERY (Anti-Delete / ViewOnce)
        if (m.message.protocolMessage?.type === 0 && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: kishuwa(`🛡️ ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ ꜰʀᴏᴍ @${sender.split('@')[0]}`), mentions:[sender], contextInfo: newsletterContext });
                await sock.copyNForward(sock.user.id, cached, false);
            }
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.sendMessage(sock.user.id, { text: kishuwa(`🛡️ ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ ꜰʀᴏᴍ @${sender.split('@')[0]}`), mentions:[sender], contextInfo: newsletterContext });
            await sock.copyNForward(sock.user.id, m, false);
        }

        // 3. GROUP SECURITY (Scam, Link, Porn, Media, Tag Status)
        if (from.endsWith('@g.us') && !isOwner) {
            const isScam = s.scamWords.some(w => body.toLowerCase().includes(w));
            const isLink = /chat.whatsapp.com|http:\/\/|https:\/\//gi.test(body);
            const isPorn = /porn|xxx|sex|🔞|ngono/gi.test(body);
            const isTagStatus = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes('status@broadcast');
            const isMedia = (type === 'audioMessage' || type === 'imageMessage' || type === 'stickerMessage') && s.antiMedia;

            if (isScam || isLink || isPorn || (isTagStatus && s.antiTag) || isMedia) {
                await sock.sendMessage(from, { delete: m.key });
                if (s.action === 'remove') await sock.groupParticipantsUpdate(from, [sender], "remove");
                await sock.sendMessage(from, { text: kishuwa(`‼️ @${sender.split('@')[0]} sᴇᴄᴜʀɪᴛʏ ᴠɪᴏʟᴀᴛɪᴏɴ. ᴀᴄᴛɪᴏɴ ᴛᴀᴋᴇɴ.`) });
                return false;
            }
            // Active Member Tracking
            await setDoc(doc(db, `ACTIVITY_${from}`, sender), { lastSeen: Date.now(), name: m.pushName || 'User' }, { merge: true });
        }

        // 4. FORCE FOLLOW CHANNEL & GROUP
        if (from.endsWith('@g.us') && !isOwner) {
            const groupMeta = await sock.groupMetadata(OFFICIAL_GROUP).catch(() => null);
            if (groupMeta && !groupMeta.participants.find(p => p.id === sender)) {
                await sock.sendMessage(from, { text: kishuwa("❌ ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ. ᴊᴏɪɴ ᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴀɴᴅ ɢʀᴏᴜᴘ ꜰɪʀsᴛ!") });
                return false;
            }
        }

        return true;
    } catch (e) { return true; }
}

// --- START USER BOT ---
async function startUserBot(num) {
    if (sessions.has(num)) { try { sessions.get(num).terminate(); } catch(e){} }
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
            await sock.sendMessage(`${num}@s.whatsapp.net`, { text: kishuwa(`🥀 ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 ᴀᴄᴛɪᴠᴀᴛᴇᴅ\nsʏsᴛᴇᴍ: sᴜᴘʀᴇᴍᴇ`), contextInfo: newsletterContext });
            // AUTO BIO ENGINE
            setInterval(async () => {
                const uptime = `${Math.floor(process.uptime()/3600)}h ${Math.floor((process.uptime()%3600)/60)}m`;
                await sock.updateProfileStatus(kishuwa(`Wrong Turn 6 | Online | Uptime: ${uptime} | Dev: StanyTz`)).catch(()=>{});
            }, 60000 * 5);
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startUserBot(num);
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]; if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();

        // Auto Typing/Recording
        await sock.sendPresenceUpdate(Math.random() > 0.5 ? 'composing' : 'recording', from);

        if (!(await supremeAutomation(sock, m, db))) return;
        msgCache.set(m.key.id, m);

        const ownerId = sock.user.id.split(':')[0];
        const sSnap = await getDoc(doc(db, "SETTINGS", ownerId));
        const s = sSnap.exists() ? sSnap.data() : { prefix: '.', emojiMenu: '🥀', autoAI: true };

        // REPLY BY NUMBER LOGIC
        if (!isNaN(body) && replyState.has(sender)) {
            const { category, list } = replyState.get(sender);
            const selected = list[parseInt(body) - 1];
            if (selected) {
                const cmd = commands.get(selected.toLowerCase());
                if (cmd) return cmd.execute(sock, m, [], db, newsletterContext);
            }
        }

        // MENU & COMMAND LOGIC
        let cmdName = ""; let args = [];
        if (body === s.emojiMenu || body.toLowerCase() === 'menu') {
            return sock.sendMessage(from, { text: getMenu(m, s.prefix, 'all'), contextInfo: newsletterContext });
        } else if (body.startsWith(s.prefix)) {
            args = body.slice(s.prefix.length).trim().split(/ +/);
            cmdName = args.shift().toLowerCase();
        } else {
            args = body.split(/ +/);
            cmdName = args.shift().toLowerCase();
        }

        // Check Category Call (e.g .wealth)
        const cats = [...new Set(Array.from(commands.values()).map(c => c.category.toLowerCase()))];
        if (cats.includes(cmdName)) {
            return sock.sendMessage(from, { text: getMenu(m, s.prefix, cmdName), contextInfo: newsletterContext });
        }

        const cmd = commands.get(cmdName);
        if (cmd) {
            await cmd.execute(sock, m, args, db, newsletterContext);
        } else if (!from.endsWith('@g.us') && s.autoAI && body.length > 2) {
            const ai = await axios.get(`https://text.pollinations.ai/Your name is WT6. Chat naturally: ${body}`);
            await sock.sendMessage(from, { text: kishuwa(ai.data), contextInfo: newsletterContext });
        }
    });

    // WELCOME & GOODBYE (Quotes + Image + Desc)
    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu;
        const metadata = await sock.groupMetadata(id);
        const pp = await sock.profilePictureUrl(id, 'image').catch(() => 'https://files.catbox.moe/59ays3.jpg');
        const quote = (await axios.get('https://api.quotable.io/random')).data.content;
        if (action === 'add') {
            let txt = `⚘ ${kishuwa("ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ")} ${metadata.subject}\n👤 @${participants[0].split('@')[0]}\n📜 ${kishuwa(quote)}\n\n📝 ${metadata.desc || 'ɴᴏ ᴅᴇsᴄ'}`;
            await sock.sendMessage(id, { image: { url: pp }, caption: txt, mentions: participants, contextInfo: newsletterContext });
        }
    });
}

// --- WEB & API ---
app.use(express.static('public'));
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const auth = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
    if (auth.clearSession) await auth.clearSession();
    const pSock = makeWASocket({ auth: { creds: auth.state.creds, keys: makeCacheableSignalKeyStore(auth.state.keys, pino({ level: 'silent' })) }, logger: pino({ level: 'silent' }), browser: Browsers.ubuntu("Chrome") });
    if (!pSock.authState.creds.registered) {
        await delay(3000); let code = await pSock.requestPairingCode(num); res.send({ code });
    }
    pSock.ev.on('creds.update', auth.saveCreds);
    pSock.ev.on('connection.update', (u) => { if (u.connection === 'open') startUserBot(num); });
});

async function resume() { loadCommands(); const snap = await getDocs(collection(db, "WT6_SESSIONS")); snap.forEach(doc => startUserBot(doc.id)); }
app.listen(process.env.PORT || 3000, () => { console.log("Supreme System Live"); resume(); });
process.on('SIGTERM', () => { sessions.forEach(s => s.terminate()); process.exit(0); });
