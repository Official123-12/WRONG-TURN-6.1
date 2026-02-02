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

// --- IDENTITY & FIREBASE ---
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

// --- PREMIUM FONTS ---
const kishuwa = (text) => {
    const fonts = {'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ꜰ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'s','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ'};
    return text.toString().toLowerCase().split('').map(char => fonts[char] || char).join('');
};

const newsContext = {
    forwardingScore: 999, isForwarded: true,
    forwardedNewsletterMessageInfo: { newsletterJid: NEWSLETTER_JID, serverMessageId: 1, newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀' }
};

// --- DYNAMIC COMMAND LOADER ---
const loadCommands = () => {
    try {
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
        console.log(`[LOADER] ${commands.size} Commands Armed.`);
    } catch (e) { console.error("Loader Error:", e.message); }
};

// --- SUPREME AUTOMATION ENGINE ---
async function handleSupreme(sock, m, db) {
    try {
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const type = getContentType(m.message);
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();
        const ownerId = sock.user.id.split(':')[0];
        const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

        const sSnap = await getDoc(doc(db, "SETTINGS", ownerId));
        const s = sSnap.exists() ? sSnap.data() : { 
            antiDelete: true, antiViewOnce: true, antiScam: true, autoStatus: true, prefix: '.', emojiMenu: '🥀' 
        };

        // 1. AUTO STATUS (View, React, AI Deep Reply)
        if (from === 'status@broadcast' && s.autoStatus) {
            await sock.readMessages([m.key]);
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
            const aiRes = await axios.get(`https://text.pollinations.ai/Deep react to: ${body || 'visual'}`).catch(()=>({data:'🥀'}));
            await sock.sendMessage(from, { text: kishuwa(aiRes.data) }, { quoted: m });
        }

        // 2. INBOX RECOVERY
        if (m.message.protocolMessage?.type === 0 && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: kishuwa(`🛡️ ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ ꜰʀᴏᴍ @${sender.split('@')[0]}`), mentions: [sender], contextInfo: newsContext });
                await sock.copyNForward(sock.user.id, cached, false);
            }
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.sendMessage(sock.user.id, { text: kishuwa(`🛡️ ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ ꜰʀᴏᴍ @${sender.split('@')[0]}`), mentions: [sender], contextInfo: newsContext });
            await sock.copyNForward(sock.user.id, m, false);
        }

        // 3. GROUP SECURITY
        if (from.endsWith('@g.us') && !isOwner) {
            if (body.includes('http') || /bundle|match|fixed|invest/gi.test(body)) {
                await sock.sendMessage(from, { delete: m.key });
                return false; 
            }
        }
        return true;
    } catch (e) { return true; }
}

// --- START BOT SESSION ---
async function startUserBot(num) {
    if (sessions.has(num)) try { sessions.get(num).terminate(); } catch(e){}
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", num);

    const sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        markOnlineOnConnect: true
    });

    sessions.set(num, sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (up) => {
        const { connection, lastDisconnect } = up;
        if (connection === 'open') {
            await sock.sendMessage(`${num}@s.whatsapp.net`, { text: kishuwa(`🥀 ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 sᴜᴘʀᴇᴍᴇ ᴀᴄᴛɪᴠᴀᴛᴇᴅ`), contextInfo: newsContext });
            // Auto-Bio
            setInterval(async () => {
                const uptime = `${Math.floor(process.uptime()/3600)}h ${Math.floor((process.uptime()%3600)/60)}m`;
                await sock.updateProfileStatus(kishuwa(`Wrong Turn 6 | Online | Uptime: ${uptime}`)).catch(()=>{});
            }, 60000 * 5);
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startUserBot(num);
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]; if (!m.message) return;
        const from = m.key.remoteJid;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();
        const ownerId = sock.user.id.split(':')[0];
        const sSnap = await getDoc(doc(db, "SETTINGS", ownerId));
        const s = sSnap.exists() ? sSnap.data() : { prefix: '.', emojiMenu: '🥀' };

        await sock.sendPresenceUpdate('composing', from);
        if (!(await handleSupreme(sock, m, db))) return;
        msgCache.set(m.key.id, m);

        // MENU LOGIC
        if (body === s.emojiMenu || body.toLowerCase() === 'menu' || body === s.prefix + 'menu') {
            let menu = `╭─── • 🥀 • ───╮\n  ᴡ ʀ ᴏ ɴ ɢ  ᴛ ᴜ ʀ ɴ  𝟼 \n╰─── • 🥀 • ───╯\n\n`;
            const cats = {};
            commands.forEach(c => { if(!cats[c.category]) cats[c.category] = []; cats[c.category].push(c.name); });
            Object.keys(cats).sort().forEach(cat => {
                menu += `╭── • *${cat.toUpperCase()}* •\n`;
                cats[cat].forEach(name => menu += `│ ◦ ${s.prefix}${name}\n`);
                menu += `╰──────────────\n\n`;
            });
            return await sock.sendMessage(from, { text: kishuwa(menu + `© 2026 stanytz industries`), contextInfo: newsContext });
        }

        // CATEGORY MENU
        const possibleCat = body.startsWith(s.prefix) ? body.slice(s.prefix.length).toLowerCase() : body.toLowerCase();
        if ([...new Set(Array.from(commands.values()).map(c => c.category.toLowerCase()))].includes(possibleCat)) {
            let catMenu = `╭── • *${possibleCat.toUpperCase()}* •\n`;
            commands.forEach(c => { if(c.category.toLowerCase() === possibleCat) catMenu += `│ ◦ ${s.prefix}${c.name}\n`; });
            return await sock.sendMessage(from, { text: kishuwa(catMenu + `╰──────────────`), contextInfo: newsContext });
        }

        // EXECUTE COMMAND
        let cmdName = body.startsWith(s.prefix) ? body.slice(s.prefix.length).split(' ')[0] : body.split(' ')[0];
        const cmd = commands.get(cmdName.toLowerCase());
        if (cmd) await cmd.execute(sock, m, body.split(' ').slice(1), db, newsContext);
    });
}

// --- API & STARTUP ---
app.use(express.static('public'));
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    try {
        const { useFirebaseAuthState } = require('./lib/firestoreAuth');
        const auth = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
        if (auth.clearSession) await auth.clearSession();
        const pSock = makeWASocket({ auth: { creds: auth.state.creds, keys: makeCacheableSignalKeyStore(auth.state.keys, pino({ level: 'silent' })) }, logger: pino({ level: 'silent' }), browser: Browsers.ubuntu("Chrome") });
        if (!pSock.authState.creds.registered) {
            await delay(3000); let code = await pSock.requestPairingCode(num); res.send({ code });
        }
        pSock.ev.on('creds.update', auth.saveCreds);
        pSock.ev.on('connection.update', (u) => { if (u.connection === 'open') startUserBot(num); });
    } catch (e) { res.status(500).send({ error: "System Busy" }); }
});

async function resume() {
    try {
        loadCommands();
        const snap = await getDocs(collection(db, "WT6_SESSIONS"));
        snap.forEach(doc => startUserBot(doc.id));
    } catch (e) { console.log("Resume Error:", e.message); }
}

app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log("Supreme System Live.");
    resume().catch(e => console.log(e));
});

process.on('SIGTERM', () => { sessions.forEach(s => s.terminate()); process.exit(0); });
