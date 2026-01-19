require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, 
    initAuthCreds,
    BufferJSON
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc, updateDoc, increment } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
    authDomain: "stanybots.firebaseapp.com",
    projectId: "stanybots",
    storageBucket: "stanybots.firebasestorage.app",
    messagingSenderId: "381983533939",
    appId: "1:381983533939:web:e6cc9445137c74b99df306"
};

const CHANNEL_JID = "120363404317544295@newsletter";
const GROUP_JID = "120363406549688641@g.us";
const DEV_NAME = "ꜱᴛᴀɴʏᴛᴢ";
const BOT_NAME = "ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼";

const firebaseApp = initializeApp(firebaseConfig);
const db = initializeFirestore(firebaseApp, { experimentalForceLongPolling: true, useFetchStreams: false });

const app = express();
const commands = new Map();
const msgStore = {}; 
let sock = null;

// --- 1. THE BRANDING & FORWARDING ENGINE ---
async function sendBranded(jid, text, quoted = null) {
    // Automatically appends Dev and Bot name to everything
    const branding = `\n\n🥀 *ᴅᴇᴠ:* ${DEV_NAME}\n🛡️ *ʙᴏᴛ:* ${BOT_NAME}`;
    const finalMsg = text + branding;

    return await sock.sendMessage(jid, {
        text: finalMsg,
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

// --- 2. AI AUTO-REPLY ENGINE (English & Swahili) ---
async function getAIResponse(text) {
    try {
        const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(text)}&lc=sw`);
        return res.data.success;
    } catch (e) { return null; }
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
        getMessage: async (key) => msgStore[key.id]?.message || undefined
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WRONG TURN 6: CONNECTED");
            const welcome = `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 ᴀʀᴍᴇᴅ ᴀɴᴅ ʀᴇᴀᴅʏ\n\nꜱʏꜱᴛᴇᴍ ᴄᴏɴɴᴇᴄᴛᴇᴅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ.\nᴀʟʟ ᴀᴜᴛᴏ-ᴍᴏᴅᴇʀᴀᴛɪᴏɴ ᴀᴄᴛɪᴠᴇ.`;
            await sendBranded(sock.user.id, welcome);
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
        const isGroup = from.endsWith('@g.us');

        msgStore[m.key.id] = m;

        // 1. AUTO STATUS (View, Like, AI Reply)
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]);
            await sock.sendMessage(from, { react: { text: '🔥', key: m.key } }, { statusJidList: [sender] });
            const aiComm = await getAIResponse(`Comment on this status: ${body}`);
            if (aiComm) await sock.sendMessage(sender, { text: aiComm }, { quoted: m });
            return;
        }

        // 2. ANTI-DELETE & VIEWONCE
        if (m.message.viewOnceMessageV2) {
            await sendBranded(sock.user.id, `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ ᴅᴇᴛᴇᴄᴛᴇᴅ* ꜰʀᴏᴍ @${sender.split('@')[0]}`);
            await sock.copyNForward(sock.user.id, m, false);
        }

        if (m.message.protocolMessage?.type === 0) {
            const deleted = msgStore[m.message.protocolMessage.key.id];
            if (deleted) {
                await sendBranded(from, `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ ᴀᴄᴛɪᴠᴇ*`);
                await sock.copyNForward(from, deleted, false);
            }
        }

        // 3. AUTO TYPING & AI REPLY
        await sock.sendPresenceUpdate('composing', from);

        if (body.startsWith('.')) {
            // Enforcement Check
            const groupMetadata = await sock.groupMetadata(GROUP_JID).catch(() => null);
            const isMember = groupMetadata?.participants.some(p => p.id === sender);
            if (!isMember) return sendBranded(from, `❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ ᴏᴜʀ ɢʀᴏᴜᴘ/ᴄʜᴀɴɴᴇʟ ᴛᴏ ᴜꜱᴇ ʙᴏᴛ.`);

            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            
            if (cmd) {
                // We wrap the original execute but intercept the reply to add branding
                const originalReply = m.reply;
                m.reply = (text) => sendBranded(from, text, m); 
                await cmd.execute(m, sock, Array.from(commands.values()), args);
            }
        } else if (!isGroup && body.length > 2) {
            // AUTO AI REPLY (No command needed)
            const aiRes = await getAIResponse(body);
            if (aiRes) {
                await delay(1500);
                await sendBranded(from, aiRes, m);
            }
        }
    });

    // 4. WELCOME & GOODBYE
    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu;
        for (let jid of participants) {
            const pp = await sock.profilePictureUrl(jid, 'image').catch(() => 'https://i.ibb.co/Ds0pP9Y/avatar.png');
            if (action === 'add') {
                await sock.sendMessage(id, { image: { url: pp }, caption: `ᴡᴇʟᴄᴏᴍᴇ @${jid.split('@')[0]}\n\nᴇɴᴊᴏʏ ʏᴏᴜʀ ꜱᴛᴀʏ ɪɴ ᴏᴜʀ ɢʀᴏᴜᴘ!`, mentions: [jid] });
            } else if (action === 'remove') {
                await sendBranded(id, `ɢᴏᴏᴅʙʏᴇ @${jid.split('@')[0]}`);
            }
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
}

// 5. PAIRING
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
    } catch (e) { res.status(500).send({ error: "Precondition Failed" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server Online: ${PORT}`); startBot(); });
