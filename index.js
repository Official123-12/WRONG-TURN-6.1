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
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, updateDoc, collection } = require('firebase/firestore');
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
const msgCache = new Map(); // For Anti-Delete
let sock = null;

// PREMIUM FORWARDING MASK (Using your Newsletter JID)
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
 * MOOD ANALYSIS LOGIC (English)
 */
const getMoodReply = (text) => {
    const t = text.toLowerCase();
    if (/(sad|cry|hurt|pain|😭|💔|😔)/.test(t)) return "Wrong Turn 6 detected sadness. Stay strong, better days ahead. 🥀";
    if (/(happy|blessed|success|win|🔥|🚀|💰)/.test(t)) return "Pure greatness! WRONG TURN 6 celebrates this win with you! 🥂";
    if (/(love|❤️|💍|honey|date)/.test(t)) return "Love is the ultimate logic. Enjoy every moment. ✨";
    return "Observed by Wrong Turn 6. 🥀";
};

// 1. DYNAMIC COMMAND LOADER
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

// 2. FIREBASE AUTH HANDLER
async function useFirebaseAuthState(db, collectionName, sessionId) {
    const fixId = (id) => `${sessionId}_${id.replace(/\//g, '__').replace(/\@/g, 'at')}`;
    const writeData = async (data, id) => setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
        } catch (e) { return null; }
    };
    const removeData = async (id) => deleteDoc(doc(db, collectionName, fixId(id)));

    let creds = await readData('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
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
                            value ? await writeData(value, `${type}-${id}`) : await removeData(`${type}-${id}`);
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds'),
        clearSession: () => removeData('creds')
    };
}

// 3. MAIN BOT ENGINE
async function startBot() {
    loadCmds();
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WRONG TURN 6: CONNECTED");
            const welcome = `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ\n\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ`;
            await sock.sendMessage(sock.user.id, { text: welcome, contextInfo: forwardedContext });
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    // GROUP PARTICIPANTS (WELCOME/GOODBYE)
    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu;
        const metadata = await sock.groupMetadata(id);
        for (let num of participants) {
            const groupLogo = await sock.profilePictureUrl(id, 'image').catch(() => 'https://files.catbox.moe/59ays3.jpg');
            if (action === 'add') {
                const welcome = `*ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ* ${metadata.subject}\n\nᴜꜱᴇʀ: @${num.split('@')[0]}\n\n"ᴋɴᴏᴡʟᴇᴅɢᴇ ɪꜱ ᴛʜᴇ ᴏɴʟʏ ᴡᴀʏ ᴏᴜᴛ."\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
                await sock.sendMessage(id, { image: { url: groupLogo }, caption: welcome, mentions: [num], contextInfo: forwardedContext });
            }
            if (action === 'remove') {
                const bye = `@${num.split('@')[0]} has left the mainframe. 🥀`;
                await sock.sendMessage(id, { text: bye, mentions: [num], contextInfo: forwardedContext });
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
        const type = getContentType(m.message);

        // CACHE FOR ANTI-DELETE
        msgCache.set(m.key.id, m);

        // FETCH SETTINGS
        const setSnap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const s = setSnap.exists() ? setSnap.data() : { prefix: ".", mode: "public", autoAI: true, autoType: true, antiDelete: true, antiViewOnce: true, forceJoin: true, autoStatus: true };

        const ownerId = sock.user.id.split(':')[0];
        const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

        // MODE CHECK
        if (s.mode === "private" && !isOwner) return;

        // AUTO PRESENCE
        if (s.autoType) await sock.sendPresenceUpdate('composing', from);
        if (Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);

        // FORCE JOIN (Group JID: 120363406549688641@g.us)
        if (body.startsWith(s.prefix) && !isOwner && s.forceJoin) {
            try {
                const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
                if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    const deny = `❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ ᴏᴜʀ ɢʀᴏᴜᴘ/ᴄʜᴀɴɴᴇʟ ᴛᴏ ᴜꜱᴇ ʙᴏᴛ:\nhttps://chat.whatsapp.com/invite_link\n\n🥀 *ᴅᴇᴠ:* ꜱᴛᴀɴʏᴛᴢ\n🛡️ *ʙᴏᴛ:* ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ`;
                    return sock.sendMessage(from, { text: deny, contextInfo: forwardedContext });
                }
            } catch (e) {}
        }

        // ANTI-DELETE & ANTI-VIEWONCE (Auto-Forward to Owner)
        if (m.message.protocolMessage?.type === 0 && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ:* Recovered from @${sender.split('@')[0]}`, mentions: [sender] });
                await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
            }
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ* Captured` });
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // ANTI-PORN / LINK / SCAM / MEDIA
        if (from.endsWith('@g.us') && !isOwner) {
            const isPorn = /(porn|xxx|nude|sex|vixen|ngono)/gi.test(body);
            const isScam = /(bundle|fixed match|earn money|invest|free data)/gi.test(body);
            const isLink = body.includes('http');
            const isMedia = (type === 'audioMessage' || type === 'imageMessage' || type === 'videoMessage');
            if (isPorn || isScam || isLink || isMedia) {
                await sock.sendMessage(from, { delete: m.key });
            }
        }

        // AUTO STATUS (VIEW + LIKE + ENGLISH MOOD REPLY)
        if (from === 'status@broadcast' && s.autoStatus) {
            await sock.readMessages([m.key]);
            const moodRes = getMoodReply(body);
            await sock.sendMessage(from, { text: moodRes }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
        }

        // UNIVERSAL AUTO AI CHAT (No command required)
        if (!body.startsWith(s.prefix) && !m.key.fromMe && s.autoAI && body.length > 2 && !from.endsWith('@g.us')) {
            try {
                const aiPrompt = `You are WRONG TURN 6 AI by STANYTZ. Respond naturally and helpfully to the following in its original language: ${body}`;
                const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // COMMAND HANDLER
        if (body.startsWith(s.prefix)) {
            const args = body.slice(s.prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
    setInterval(() => { if (sock?.user) sock.sendPresenceUpdate('available'); }, 15000);
}

// 4. THE ULTIMATE PAIRING ROUTE (STABLE)
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Missing Number" });

    try {
        const auth = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");
        await auth.clearSession();
        sock = makeWASocket({
            auth: auth.state,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Safari")
        });

        await delay(5000); 
        let code = await sock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });

        sock.ev.on('creds.update', auth.saveCreds);
        sock.ev.on('connection.update', (u) => {
            if (u.connection === 'open') console.log("Link Confirmed!");
        });

    } catch (e) {
        console.error(e);
        res.status(500).send({ error: "Precondition Failed. Refresh and try again." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server Online: ${PORT}`); startBot(); });
