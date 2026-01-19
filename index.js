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
    prepareWAMessageMedia,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc, updateDoc, increment } = require('firebase/firestore');
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

// --- CONSTANTS ---
const CHANNEL_JID = "120363404317544295@newsletter";
const GROUP_JID = "120363406549688641@g.us";
const CHANNEL_LINK = "https://whatsapp.com/channel/0029VaN608X90x2zS2lXpP3Y";

const firebaseApp = initializeApp(firebaseConfig);
const db = initializeFirestore(firebaseApp, { experimentalForceLongPolling: true, useFetchStreams: false });

const app = express();
const commands = new Map();
const msgStore = {}; // Memory for Anti-Delete
let sock = null;

// --- DYNAMIC AI ENGINE (Swahili & English) ---
async function chatAI(text) {
    try {
        // Free AI API endpoint that handles multilingual conversations
        const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(text)}&lc=sw`);
        return res.data.success || null;
    } catch (e) { return null; }
}

// --- FORWARDED MESSAGE WRAPPER ---
async function sendForwarded(jid, text, quoted = null) {
    return await sock.sendMessage(jid, {
        text: text,
        contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: CHANNEL_JID,
                newsletterName: "WRONG TURN 6 🥀",
                serverMessageId: -1
            }
        }
    }, { quoted });
}

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
        state: { creds, keys: { get: async (type, ids) => { const data = {}; await Promise.all(ids.map(async id => { let value = await readData(`${type}-${id}`); if (type === 'app-state-sync-key' && value) value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value); data[id] = value; })); return data; }, set: async (data) => { for (const type in data) { for (const id in data[type]) { const value = data[type][id]; value ? await writeData(value, `${type}-${id}`) : await removeData(`${type}-${id}`); } } } } },
        saveCreds: () => writeData(creds, 'creds'),
        clearSession: () => removeData('creds')
    };
}

async function startBot() {
    loadCmds();
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        syncFullHistory: false,
        getMessage: async (key) => msgStore[key.id]?.message || undefined
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WRONG TURN 6: CONNECTED");
            // Fancy Font Welcome (No Borders)
            const fancyWelcome = `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 ᴀʀᴍᴇᴅ\n\nꜱʏꜱᴛᴇᴍ ɪꜱ ɴᴏᴡ ᴏɴʟɪɴᴇ ᴀɴᴅ ʟɪɴᴋᴇᴅ ᴛᴏ ᴄʜᴀɴɴᴇʟ\n\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ ɪɴᴅᴜꜱᴛʀɪᴇꜱ\nᴇɴɢɪɴᴇ: ᴠ6.6.0\nꜱᴛᴀᴛᴜꜱ: ᴘʀᴏᴛᴇᴄᴛᴇᴅ 🛡️`;
            await sendForwarded(sock.user.id, fancyWelcome);
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
        const isGroup = from.endsWith('@g.us');

        // Store message for Anti-Delete
        msgStore[m.key.id] = m;

        // --- 1. AUTO STATUS ENGINE ---
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]); // Auto View
            const emojis = ['🔥', '✨', '❤️', '🙌', '👑', '🥂'];
            await sock.sendMessage(from, { react: { text: emojis[Math.floor(Math.random() * emojis.length)], key: m.key } }, { statusJidList: [sender] });
            
            // AI Deep Thought Comment on Status
            const aiComment = await chatAI(`Comment on this status briefly: ${body || 'cool photo'}`);
            if (aiComment) await sock.sendMessage(sender, { text: aiComment }, { quoted: m });
            return;
        }

        // --- 2. MEMBERSHIP ENFORCEMENT ---
        if (body.startsWith('.')) {
            try {
                const groupMeta = await sock.groupMetadata(GROUP_JID);
                const isMember = groupMeta.participants.some(p => p.id === sender);
                if (!isMember) return sendForwarded(from, `⚠️ *ACCESS DENIED*\n\nYou must join our official group and channel to use this bot.\n\nGroup: ${GROUP_JID}\nChannel: ${CHANNEL_LINK}`);
            } catch (e) {}
        }

        // --- 3. ANTI-DELETE & ANTI-VIEWONCE ---
        if (m.message.viewOnceMessageV2 || m.message.viewOnceMessage) {
            await sendForwarded(sock.user.id, `🛡️ *Anti-ViewOnce Captured* from @${sender.split('@')[0]}`);
            await sock.copyNForward(sock.user.id, m, false);
        }

        if (m.message.protocolMessage?.type === 0) { // Delete detected
            const deletedMsg = msgStore[m.message.protocolMessage.key.id];
            if (deletedMsg) {
                await sendForwarded(from, `🛡️ *Anti-Delete Detected*`);
                await sock.copyNForward(from, deletedMsg, false);
            }
        }

        // --- 4. ANTI-PORN / ANTI-LINK / ANTI-SCAM ---
        const scamKeywords = ['fixed match', 'bundle', 'investment', 'free data', 'login to get'];
        const isScam = scamKeywords.some(word => body.toLowerCase().includes(word));
        if ((isScam || body.match(/chat.whatsapp.com/gi)) && isGroup) {
            await sock.sendMessage(from, { delete: m.key });
            // Optional: await sock.groupParticipantsUpdate(from, [sender], 'remove');
            return;
        }

        // --- 5. AUTO TYPING & AI AUTO-REPLY ---
        await sock.sendPresenceUpdate('composing', from);
        
        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args);
        } else {
            // Automatic AI Reply (English/Swahili)
            if (body.length > 2 && !isGroup) {
                const aiResponse = await chatAI(body);
                if (aiResponse) {
                    await delay(1500);
                    await sendForwarded(from, aiResponse, m);
                }
            }
        }

        // Tracking Activity
        if (isGroup) {
            await setDoc(doc(db, "ACTIVITY", `${from}_${sender}`), { count: increment(1), lastSeen: Date.now() }, { merge: true });
        }
    });

    // --- 6. WELCOME & GOODBYE ---
    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu;
        const meta = await sock.groupMetadata(id);
        for (let jid of participants) {
            const pp = await sock.profilePictureUrl(jid, 'image').catch(() => 'https://i.ibb.co/Ds0pP9Y/avatar.png');
            if (action === 'add') {
                const welcomeQuote = `✨ "Success is not final; failure is not fatal: It is the courage to continue that counts."`;
                await sock.sendMessage(id, { image: { url: pp }, caption: `Welcome @${jid.split('@')[0]} to *${meta.subject}*\n\n${welcomeQuote}\n\n*Desc:* ${meta.desc || 'No Description'}`, mentions: [jid] });
            } else if (action === 'remove') {
                await sendForwarded(id, `👋 Goodbye @${jid.split('@')[0]}. We hope you find what you were looking for.`);
            }
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
}

// --- PAIRING ROUTE ---
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Missing Number" });
    try {
        const auth = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");
        await auth.clearSession();
        sock = makeWASocket({ auth: auth.state, logger: pino({ level: 'silent' }), browser: Browsers.macOS("Safari") });
        await delay(5000); 
        let code = await sock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) { res.status(500).send({ error: "Refresh and try again." }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server Online: ${PORT}`); startBot(); });
