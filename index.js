require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    initAuthCreds,
    BufferJSON,
    makeCacheableSignalKeyStore,
    getContentType
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, updateDoc, collection, query, getDocs } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');

// 1. FIREBASE WEB SDK CONFIG
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

// PREMIUM FORWARDING MASK
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

/**
 * ATOMIC MULTI-USER AUTH
 */
async function useFirebaseAuthState(num) {
    const fixId = (id) => `session_${num}_${id.replace(/\//g, '__').replace(/\@/g, 'at')}`;
    const writeData = async (data, id) => setDoc(doc(db, "SESSIONS", fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        const snapshot = await getDoc(doc(db, "SESSIONS", fixId(id)));
        return snapshot.exists() ? JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver) : null;
    };
    const removeData = async (id) => deleteDoc(doc(db, "SESSIONS", fixId(id)));
    let creds = await readData('creds') || initAuthCreds();
    return {
        state: { creds, keys: {
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
                        value ? await writeData(value, `${type}-${id}`) : null;
                    }
                }
            }
        }},
        saveCreds: () => writeData(creds, 'creds'),
        clearAll: () => removeData('creds')
    };
}

/**
 * SUPREME ENGINE LOGIC
 */
async function startUserBot(num) {
    loadCmds();
    const { state, saveCreds } = await useFirebaseAuthState(num);
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"],
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    sessions.set(num, sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            await sock.sendMessage(sock.user.id, { text: "ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ", contextInfo: forwardedContext });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startUserBot(num);
    });

    // ADVANCED GROUP EVENTS
    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu;
        const metadata = await sock.groupMetadata(id);
        const groupLogo = await sock.profilePictureUrl(id, 'image').catch(() => 'https://files.catbox.moe/59ays3.jpg');
        for (let num of participants) {
            if (action === 'add') {
                const activitySnap = await getDoc(doc(db, "ACTIVITY", id));
                const activeCount = activitySnap.exists() ? Object.keys(activitySnap.data()).length : 0;
                let welcome = `╭─── • 🥀 • ───╮\n  ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ ᴍᴀɪɴꜰʀᴀᴍᴇ \n╰─── • 🥀 • ───╯\n\n⚘ ᴜꜱᴇʀ : @${num.split('@')[0]}\n⚘ ɢʀᴏᴜᴘ : ${metadata.subject}\n⚘ ᴍᴇᴍʙᴇʀꜱ : ${metadata.participants.length}\n⚘ ᴀᴄᴛɪᴠᴇ : ${activeCount}\n\n*ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ*:\n${metadata.desc || 'No description.'}\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
                await sock.sendMessage(id, { image: { url: groupLogo }, caption: welcome, mentions: [num], contextInfo: forwardedContext });
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

        msgCache.set(m.key.id, m);
        const ownerId = sock.user.id.split(':')[0];
        const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

        // FETCH SETTINGS
        const setSnap = await getDoc(doc(db, "SETTINGS", ownerId));
        const s = setSnap.exists() ? setSnap.data() : { prefix: ".", autoAI: true, forceJoin: true, autoStatus: true, antiDelete: true };

        // 1. AUTO PRESENCE
        await sock.sendPresenceUpdate('composing', from);

        // 2. REPLY-BY-NUMBER
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = (quoted?.conversation || quoted?.extendedTextMessage?.text || "").toLowerCase();
        if (quoted && !isNaN(body) && body.length > 0) {
            for (let [cmdName, cmdObj] of commands) {
                if (quotedText.includes(cmdName)) {
                    await cmdObj.execute(m, sock, Array.from(commands.values()), [body.trim()], db, forwardedContext);
                    break;
                }
            }
        }

        // 3. ANTI-DELETE & VIEWONCE (Owner DM)
        if (m.message.protocolMessage?.type === 0 && !m.key.fromMe && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ* @${sender.split('@')[0]}`, mentions: [sender] });
                await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
            }
        }
        if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ*` });
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // 4. FORCE JOIN (https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y)
        if (body.startsWith(s.prefix) && !isOwner && s.forceJoin) {
            try {
                const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
                if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    const deny = `❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ ɢʀᴏᴜᴘ ᴛᴏ ᴜꜱᴇ ʙᴏᴛ:\nhttps://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y\n\n🥀 *ᴅᴇᴠ:* ꜱᴛᴀɴʏᴛᴢ\n🛡️ *ʙᴏᴛ:* ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ`;
                    return sock.sendMessage(from, { text: deny, contextInfo: forwardedContext });
                }
            } catch (e) {}
        }

        // 5. AUTO STATUS ENGINE (AI HUMAN PERSONA)
        if (from === 'status@broadcast' && s.autoStatus) {
            await sock.readMessages([m.key]);
            const moodPrompt = `As a natural human friend, give a very brief English reaction to this status: "${body}". No quotes.`;
            const aiMood = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(moodPrompt)}`);
            await sock.sendMessage(from, { text: aiMood.data, contextInfo: forwardedContext }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
        }

        // 6. UNIVERSAL AUTO-AI CHAT (Group & Private)
        if (!body.startsWith(s.prefix) && !m.key.fromMe && s.autoAI && body.length > 2) {
            try {
                const aiPrompt = `Your name is WRONG TURN 6, a human assistant by STANYTZ. Chat naturally and briefly in the user's language. User says: ${body}`;
                const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // 7. PROTECTION (SCAM TAG-ALL & PORNO)
        if (from.endsWith('@g.us') && !isOwner) {
            const isScam = /(bundle|fixed match|earn money|invest)/gi.test(body);
            const isPorn = /(porn|xxx|nude|sex|vixen|ngono)/gi.test(body);
            if (isScam) {
                const metadata = await sock.groupMetadata(from);
                const allMem = metadata.participants.map(v => v.id);
                await sock.sendMessage(from, { text: `‼️ *ꜱᴄᴀᴍ ᴀʟᴇʀᴛ* ‼️\n@${sender.split('@')[0]} is spreading fraud. Precaution for all members!`, mentions: allMem });
                await sock.sendMessage(from, { delete: m.key });
                await sock.groupParticipantsUpdate(from, [sender], "remove");
            }
            if (isPorn || body.includes('http')) await sock.sendMessage(from, { delete: m.key });
            await setDoc(doc(db, "ACTIVITY", from), { [sender]: Date.now() }, { merge: true });
        }

        // 8. COMMAND EXECUTION
        if (body.startsWith(s.prefix)) {
            const args = body.slice(s.prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
    
    setInterval(async () => {
        if (sock?.user) {
            const up = Math.floor(process.uptime() / 3600);
            await sock.updateProfileStatus(`WRONG TURN 6 | ONLINE | UPTIME: ${up}h`).catch(() => {});
            await sock.sendPresenceUpdate('available');
        }
    }, 30000);
}

/**
 * THE NUCLEAR PAIRING FIX (ZERO 428 ERROR)
 */
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    if (!num) return res.status(400).send({ error: "Missing Number" });
    try {
        const auth = await useFirebaseAuthState(num);
        await auth.clearAll(); 
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
app.listen(PORT, () => console.log(`Mainframe Armed: ${PORT}`));
