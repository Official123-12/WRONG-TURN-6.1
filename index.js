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
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc } = require('firebase/firestore');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const axios = require('axios');

// 1. FIREBASE CONFIG
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
let sock = null;
let isPairing = false;

// PREMIUM FORWARDING WRAPPER
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
 * DYNAMIC COMMAND LOADER
 */
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
 * ATOMIC FIREBASE AUTH HANDLER
 */
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
                        value ? await writeData(value, `${type}-${id}`) : await removeData(`${type}-${id}`);
                    }
                }
            }
        }},
        saveCreds: () => writeData(creds, 'creds'),
        clearSession: () => removeData('creds')
    };
}

/**
 * MAIN ENGINE BOOT
 */
async function startBot() {
    if (isPairing) return; // Prevent loop during pairing
    loadCmds();
    const auth = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");
    
    if (!auth.state.creds.me) {
        console.log("📡 STANDBY: WAITING FOR PAIRING...");
        return;
    }

    sock = makeWASocket({
        auth: auth.state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"), 
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    sock.ev.on('creds.update', auth.saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WRONG TURN 6: ARMED");
            await sock.sendMessage(sock.user.id, { 
                text: "ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ",
                contextInfo: forwardedContext 
            });
            isPairing = false;
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            setTimeout(startBot, 5000);
        }
    });

    // --- INJECTED: AUTOMATION ENGINE ---
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
        const type = getContentType(m.message);

        msgCache.set(m.key.id, m);
        const isOwner = sender.startsWith(sock.user.id.split(':')[0]) || m.key.fromMe;

        // 1. AUTO PRESENCE
        await sock.sendPresenceUpdate('composing', from);
        if (Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);

        // 2. REPLY-BY-NUMBER (UNIVERSAL)
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

        // 3. ANTI-DELETE & VIEWONCE (Auto Forward to Owner)
        if (m.message.protocolMessage?.type === 0 && !m.key.fromMe) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ* Recovered from @${sender.split('@')[0]}`, mentions: [sender] });
                await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
            }
        }
        if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ* Captured` });
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // 4. FORCE JOIN (Group JID: 120363406549688641@g.us)
        if (body.startsWith('.') && !isOwner) {
            try {
                const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
                if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    const deny = `❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y`;
                    return sock.sendMessage(from, { text: deny, contextInfo: forwardedContext });
                }
            } catch (e) {}
        }

        // 5. AUTO STATUS ENGINE (AI HUMAN)
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]);
            const moodRes = await axios.get(`https://text.pollinations.ai/React%20briefly%20in%20natural%20English%20to%20this%20status:%20${encodeURIComponent(body)}`);
            await sock.sendMessage(from, { text: moodRes.data, contextInfo: forwardedContext }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
        }

        // 6. UNIVERSAL AUTO-AI CHAT (Group & Private)
        if (!body.startsWith('.') && !m.key.fromMe && body.length > 2 && !from.endsWith('@g.us')) {
            try {
                const aiRes = await axios.get(`https://text.pollinations.ai/Your%20name%20is%20WRONG%20TURN%206%20by%20STANYTZ.Reply%20briefly%20in%20user%20language:%20${encodeURIComponent(body)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // 7. PROTECTION (LINK/PORN/SCAM/MEDIA)
        if (from.endsWith('@g.us') && !isOwner) {
            const isDemon = /(porn|xxx|sex|ngono|bundle|invest)/gi.test(body);
            if (isDemon || body.includes('http') || (type.includes('Message') && Math.random() > 0.8)) {
                await sock.sendMessage(from, { delete: m.key });
            }
            await setDoc(doc(db, "ACTIVITY", from), { [sender]: Date.now() }, { merge: true });
        }

        // 8. COMMAND EXECUTION
        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
}

/**
 * 2. PAIRING ROUTE (FIXED: NO DUPLICATION)
 */
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "No number" });
    
    isPairing = true;
    if (sock) { try { sock.ws.close(); } catch(e){} sock = null; }

    try {
        const auth = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");
        await auth.clearSession(); // Atomic wipe
        
        sock = makeWASocket({
            auth: auth.state,
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu("Chrome")
        });

        await delay(5000); 
        let code = await sock.requestPairingCode(num.replace(/\D/g, ''));
        res.send({ code });

        sock.ev.on('creds.update', auth.saveCreds);
        sock.ev.on('connection.update', (u) => {
            if (u.connection === 'open') {
                isPairing = false;
                startBot(); 
            }
        });
    } catch (e) { isPairing = false; res.status(500).send({ error: "System Busy" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server Online: ${PORT}`); startBot(); });

// AUTO BIO & ALWAYS ONLINE
setInterval(async () => {
    if (sock?.user) {
        const uptime = `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`;
        await sock.updateProfileStatus(`WRONG TURN 6 | ONLINE | UPTIME: ${uptime}`).catch(() => {});
        await sock.sendPresenceUpdate('available');
    }
}, 30000);
