require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, 
    initAuthCreds,
    BufferJSON,
    getContentType
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc, collection, query, getDocs, where } = require('firebase/firestore');
const express = require('express');
const pino = require('pino');
const axios = require('axios');
const path = require('path');

// 🟢 GLOBAL PROTECTION
process.on('unhandledRejection', e => console.log('🔥 Rejection:', e));
process.on('uncaughtException', e => console.log('🔥 Exception:', e));

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

// 💎 PREMIUM NEWSLETTER MASKING
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
 * 🦾 SUPREME ENGINE LOGIC (FEATURES INJECTION)
 */
async function handleSupremeLogic(sock, m, db) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
    const type = getContentType(m.message);

    msgCache.set(m.key.id, m);
    const ownerId = sock.user.id.split(':')[0];
    const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

    const setSnap = await getDoc(doc(db, "SETTINGS", ownerId));
    const s = setSnap.exists() ? setSnap.data() : { prefix: ".", mode: "public", autoAI: true, forceJoin: true, autoStatus: true, antiDelete: true, antiViewOnce: true, antiLink: true, antiScam: true, antiMedia: false };

    if (s.mode === "private" && !isOwner) return;

    // 1. AUTO PRESENCE
    await sock.sendPresenceUpdate('composing', from);
    if (Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);

    // 2. ANTI-DELETE & VIEWONCE (DM to Owner)
    if (m.message?.protocolMessage?.type === 0 && !m.key.fromMe && s.antiDelete) {
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

    // 3. FORCE JOIN & FOLLOW (https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y)
    const isCmd = body.startsWith(s.prefix) || commands.has(body.split(' ')[0].toLowerCase());
    if (isCmd && !isOwner && s.forceJoin) {
        const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
        if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
            return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ ᴏᴜʀ ɢʀᴏᴜᴘ ᴛᴏ ᴜꜱᴇ ʙᴏᴛ:\nhttps://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
        }
    }

    // 4. GROUP SECURITY (ANTI-LINK / PORN / CUSTOM SCAM)
    if (from.endsWith('@g.us') && !isOwner) {
        // Anti-Link
        if (s.antiLink && body.match(/https?:\/\/[^\s]+/gi)) await sock.sendMessage(from, { delete: m.key });
        
        // Anti-Scam (User Customizable via Firebase)
        const scamKeywords = s.customScams || ["bundle", "fixed match", "earn money"];
        if (s.antiScam && scamKeywords.some(w => body.toLowerCase().includes(w))) {
            const metadata = await sock.groupMetadata(from);
            const allMem = metadata.participants.map(v => v.id);
            await sock.sendMessage(from, { text: `‼️ *ꜱᴄᴀᴍ ᴅᴇᴛᴇᴄᴛᴇᴅ* ‼️\n@${sender.split('@')[0]} is spreading fraud. Do not trust!`, mentions: allMem });
            await sock.sendMessage(from, { delete: m.key });
            await sock.groupParticipantsUpdate(from, [sender], "remove");
        }
    }

    // 5. AUTO STATUS ENGINE (HUMAN PERSONA)
    if (from === 'status@broadcast' && s.autoStatus) {
        await sock.readMessages([m.key]);
        const moodPrompt = `You are a cool human friend. React naturally to this status in 1 brief English sentence: "${body}". No quotes.`;
        const aiMood = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(moodPrompt)}`);
        await sock.sendMessage(from, { text: aiMood.data, contextInfo: forwardedContext }, { quoted: m });
        await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
    }

    // 6. UNIVERSAL AUTO-AI CHAT (ALL LANGUAGES)
    if (!isCmd && !m.key.fromMe && s.autoAI && body.length > 2 && !from.endsWith('@g.us')) {
        try {
            const aiPrompt = `Your name is WRONG TURN 6. Developer: STANYTZ. Respond naturally to: ${body}`;
            const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
            await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) {}
    }

    // 7. ACTIVITY TRACKER
    if (from.endsWith('@g.us')) await setDoc(doc(db, "ACTIVITY", from), { [sender]: Date.now() }, { merge: true });

    // 8. COMMANDS EXECUTION
    let cmdName = body.startsWith(s.prefix) ? body.slice(s.prefix.length).trim().split(/ +/)[0].toLowerCase() : body.split(' ')[0].toLowerCase();
    let args = body.startsWith(s.prefix) ? body.slice(s.prefix.length).trim().split(/ +/).slice(1) : body.split(' ').slice(1);
    const cmd = commands.get(cmdName);
    if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
}

/**
 * 🦾 ENGINE BOOTSTRAP (FIXED LINKING RACE CONDITION)
 */
async function startUserBot(num) {
    if (activeSessions.has(num)) return;
    const { state, saveCreds } = await useFirebaseAuthState(num);
    
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) // 🟢 FIX: CRITICAL
        },
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"), // 🟢 FIX: Better than Safari for Handshake
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000
    });

    activeSessions.set(num, sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            await setDoc(doc(db, "ACTIVE_USERS", num), { active: true });
            const welcome = `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ ✔️`;
            await sock.sendMessage(sock.user.id, { text: welcome, contextInfo: forwardedContext });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            activeSessions.delete(num);
            startUserBot(num);
        }
    });

    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu;
        if (action === 'add') {
            const metadata = await sock.groupMetadata(id);
            const groupLogo = await sock.profilePictureUrl(id, 'image').catch(() => 'https://files.catbox.moe/59ays3.jpg');
            for (let n of participants) {
                let txt = `╭── • 🥀 • ──╮\n  ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ ᴍᴀɪɴꜰʀᴀᴍᴇ \n╰── • 🥀 • ──╯\n\n⚘ ᴜꜱᴇʀ : @${n.split('@')[0]}\n⚘ ɢʀᴏᴜᴘ : ${metadata.subject}\n\n*ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ*:\n${metadata.desc || 'No description.'}`;
                await sock.sendMessage(id, { image: { url: groupLogo }, caption: txt, mentions: [n], contextInfo: forwardedContext });
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        await handleSupremeLogic(sock, m, db);
    });
}

/**
 * 🔥 THE NUCLEAR PAIRING FIX (STABLE LINK)
 */
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    if (!num) return res.status(400).send({ error: "Missing Number" });
    try {
        const { state, saveCreds, wipeSession } = await useFirebaseAuthState(num);
        await wipeSession(); // Clean slate

        const pSock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu("Chrome")
        });

        pSock.ev.on('creds.update', saveCreds);

        await delay(5000); 
        let code = await pSock.requestPairingCode(num);
        res.send({ code });

        pSock.ev.on('connection.update', (u) => {
            if (u.connection === 'open') {
                pSock.ev.removeAllListeners();
                activeSessions.set(num, pSock);
                startUserBot(num);
            }
        });
    } catch (e) { res.status(500).send({ error: "System Busy" }); }
});

/**
 * 📦 FIREBASE AUTH STATE
 */
async function useFirebaseAuthState(num) {
    const fixId = (id) => `session_${num}_${id.replace(/\//g, '__').replace(/\@/g, 'at')}`;
    const writeData = async (data, id) => setDoc(doc(db, "SESSIONS", fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        const snapshot = await getDoc(doc(db, "SESSIONS", fixId(id)));
        return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
    };
    let creds = await readData('creds') || initAuthCreds();
    return { state: { creds, keys: {
        get: async (type, ids) => {
            const data = {};
            await Promise.all(ids.map(async id => {
                let value = await readData(`${type}-${id}`);
                if (type === 'app-state-sync-key' && value) value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
                data[id] = value;
            }));
            return data;
        },
        set: async (data) => {
            for (const type in data) {
                for (const id in data[type]) {
                    const value = data[type][id];
                    if (value) await writeData(value, `${type}-${id}`);
                    else await deleteDoc(doc(db, "SESSIONS", fixId(`${type}-${id}`)));
                }
            }
        }
    }}, saveCreds: () => writeData(creds, 'creds'), wipeSession: async () => {
        const q = query(collection(db, "SESSIONS"), where("__name__", ">=", `session_${num}`), where("__name__", "<=", `session_${num}\uf8ff`));
        const snap = await getDocs(q);
        snap.forEach(async d => await deleteDoc(d.ref));
    }};
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    // Command Loader Initialization
    const cmdPath = path.resolve(__dirname, 'commands');
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
    console.log("Mainframe Armed.");
    // Auto-Restore logic
    getDocs(collection(db, "ACTIVE_USERS")).then(snap => snap.forEach(d => {
        if (d.data().active && !activeSessions.has(d.id)) startUserBot(d.id);
    }));
});

// Always Online
setInterval(async () => {
    for (let s of activeSessions.values()) {
        if (s.user) {
            const uptime = `${Math.floor(process.uptime() / 3600)}h`;
            await s.updateProfileStatus(`WRONG TURN 6 | ONLINE | ${uptime}`).catch(() => {});
            await s.sendPresenceUpdate('available');
        }
    }
}, 30000);
