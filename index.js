require('dotenv').config();
const { 
    default: makeWASocket, DisconnectReason, Browsers, delay, getContentType, 
    makeCacheableSignalKeyStore, jidDecode 
} = require('xmd-baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');
const { kishuwa, newsContext } = require('./lib/supremeUI');

// --- FIREBASE ---
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
const OFFICIAL_GROUP = '120363406549688641@g.us';

// --- COMMAND LOADER ---
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
        console.log(`[LOADER] ${commands.size} Commands Loaded.`);
    } catch (e) { console.error("Loader Error:", e.message); }
};

// --- SECURITY & AUTOMATIONS ---
async function handleAutomations(sock, m, db) {
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

        // AUTO STATUS (View/Like/AI Deep Reply)
        if (from === 'status@broadcast' && s.autoStatus) {
            await sock.readMessages([m.key]);
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
            const aiRes = await axios.get(`https://text.pollinations.ai/Natural deep react to: ${body || 'visual'}`).catch(()=>({data:'🥀'}));
            await sock.sendMessage(from, { text: kishuwa(aiRes.data) }, { quoted: m });
        }

        // INBOX RECOVERY (Anti-Delete/ViewOnce)
        if (m.message.protocolMessage?.type === 0 && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: kishuwa(`🛡️ ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ ꜰʀᴏᴍ @${sender.split('@')[0]}`), mentions: [sender], contextInfo: newsContext() });
                await sock.copyNForward(sock.user.id, cached, false);
            }
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.sendMessage(sock.user.id, { text: kishuwa(`🛡️ ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ ꜰʀᴏᴍ @${sender.split('@')[0]}`), mentions: [sender], contextInfo: newsContext() });
            await sock.copyNForward(sock.user.id, m, false);
        }

        // GROUP SECURITY (Scam/Link/Membership)
        if (from.endsWith('@g.us') && !isOwner) {
            const gMeta = await sock.groupMetadata(OFFICIAL_GROUP).catch(()=>null);
            if (gMeta && !gMeta.participants.find(p => p.id === sender)) {
                await sock.sendMessage(from, { text: kishuwa("❌ ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ. ᴊᴏɪɴ ᴏᴜʀ ᴄʜᴀɴɴᴇʟ ᴀɴᴅ ɢʀᴏᴜᴘ!") });
                return false;
            }
            if (body.includes('http') || /bundle|match|invest/gi.test(body)) {
                await sock.sendMessage(from, { delete: m.key });
                await sock.groupParticipantsUpdate(from, [sender], "remove").catch(()=>{});
                return false;
            }
        }
        return true;
    } catch (e) { return true; }
}

// --- START SESSION ---
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
        if (up.connection === 'open') {
            await sock.sendMessage(`${num}@s.whatsapp.net`, { text: kishuwa(`🥀 ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 ᴀᴄᴛɪᴠᴀᴛᴇᴅ`), contextInfo: newsContext() });
            // Auto Bio
            setInterval(async () => {
                const uptime = `${Math.floor(process.uptime()/3600)}h ${Math.floor((process.uptime()%3600)/60)}m`;
                await sock.updateProfileStatus(kishuwa(`Wrong Turn 6 | Online | Uptime: ${uptime}`)).catch(()=>{});
            }, 60000 * 5);
        }
        if (up.connection === 'close' && up.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startUserBot(num);
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]; if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();
        const ownerId = sock.user.id.split(':')[0];
        
        const sSnap = await getDoc(doc(db, "SETTINGS", ownerId));
        const s = sSnap.exists() ? sSnap.data() : { prefix: '.', emojiMenu: '🥀' };

        await sock.sendPresenceUpdate(Math.random() > 0.5 ? 'composing' : 'recording', from);
        if (!(await handleAutomations(sock, m, db))) return;
        msgCache.set(m.key.id, m);

        // TRIGGER MENU OR COMMAND
        let cmdName = ""; let args = [];
        if (body === s.emojiMenu || body.toLowerCase() === 'menu') {
            cmdName = "menu"; args = [s.prefix];
        } else if (body.startsWith(s.prefix)) {
            args = body.slice(s.prefix.length).trim().split(/ +/);
            cmdName = args.shift().toLowerCase();
        } else {
            args = body.split(/ +/);
            cmdName = args.shift().toLowerCase();
        }

        const cmd = commands.get(cmdName);
        if (cmd) {
            await cmd.execute(sock, m, args, db, newsContext, commands);
        } else if (!from.endsWith('@g.us') && body.length > 2) {
            const ai = await axios.get(`https://text.pollinations.ai/Chat naturally: ${body}`).catch(()=>({data:''}));
            if(ai.data) await sock.sendMessage(from, { text: kishuwa(ai.data), contextInfo: newsContext() });
        }
    });
}

// --- API ---
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
    loadCommands();
    const snap = await getDocs(collection(db, "WT6_SESSIONS"));
    snap.forEach(doc => startUserBot(doc.id).catch(()=>{}));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => { resume(); });
process.on('SIGTERM', () => { sessions.forEach(s => s.terminate()); process.exit(0); });
