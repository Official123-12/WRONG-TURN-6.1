require('dotenv').config();
const { 
    default: makeWASocket, DisconnectReason, Browsers, delay, fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, initAuthCreds, BufferJSON, getContentType 
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, initializeFirestore, doc, getDoc, setDoc, deleteDoc, collection, query, getDocs, where } = require('firebase/firestore');
const express = require('express');
const pino = require('pino');
const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');

// 🟢 GLOBAL STABILITY HANDLERS
process.on('unhandledRejection', e => console.log('🛡️ Rejection Shield:', e));
process.on('uncaughtException', e => console.log('🛡️ Exception Shield:', e));

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

// 💎 PREMIUM FORWARDING MASK (Newsletter)
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
 * 🔐 ARMED SECURITY SCANNER (Anti-Scam, Porn, Media, Tag, Bot)
 */
async function armedScanner(sock, m, s, isOwner) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").toLowerCase();
    const type = getContentType(m.message);

    if (!from.endsWith('@g.us') || isOwner) return false;

    // 1. Anti-Bot
    if (m.key.id.startsWith('BAE5') && s.antiBot) { await sock.sendMessage(from, { delete: m.key }); return true; }
    
    // 2. Anti-Tag Status/Mass Mentions
    const mentions = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (s.antiTag && (mentions.includes('status@broadcast') || mentions.length > 8)) {
        await sock.sendMessage(from, { delete: m.key });
        await sock.sendMessage(from, { text: `⚠️ *ᴀɴᴛɪ-ᴛᴀɢ:* Tagging is prohibited @${sender.split('@')[0]}`, mentions: [sender], contextInfo: forwardedContext });
        return true;
    }

    // 3. Anti-Scam (Tag-All Alert & Remove)
    const scams = ["bundle", "fixed match", "earn money", "investment", "free data", "gift card"];
    if (s.antiScam && scams.some(w => body.includes(w))) {
        const metadata = await sock.groupMetadata(from);
        const allMem = metadata.participants.map(v => v.id);
        await sock.sendMessage(from, { text: `‼️ *ꜱᴄᴀᴍ ᴅᴇᴛᴇᴄᴛᴇᴅ* ‼️\n@${sender.split('@')[0]} is spreading fraud! Warning to all members.`, mentions: allMem, contextInfo: forwardedContext });
        await sock.sendMessage(from, { delete: m.key });
        await sock.groupParticipantsUpdate(from, [sender], "remove");
        return true;
    }

    // 4. Anti-Link / Anti-Porn
    const isPorn = /(porn|xxx|sex|ngono|vixen|🔞)/gi.test(body);
    if ((s.antiLink && body.includes('http')) || (s.antiPorn && isPorn)) {
        await sock.sendMessage(from, { delete: m.key });
        if (isPorn) await sock.groupParticipantsUpdate(from, [sender], "remove");
        return true;
    }

    // 5. Anti-Media (Photos/Voice/Video)
    const isMedia = (type === 'imageMessage' || type === 'videoMessage' || type === 'audioMessage' || type === 'stickerMessage');
    if (s.antiMedia && isMedia) {
        await sock.sendMessage(from, { delete: m.key });
        return true;
    }

    return false;
}

/**
 * 🦾 USER-SPECIFIC BOT ENGINE
 */
async function startUserBot(num) {
    if (activeSessions.has(num)) return;
    const { state, saveCreds } = await useFirebaseAuthState(num);
    const sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    activeSessions.set(num, sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            await setDoc(doc(db, "ACTIVE_USERS", num), { active: true });
            const welcome = `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ`;
            await sock.sendMessage(sock.user.id, { text: welcome, contextInfo: forwardedContext });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            activeSessions.delete(num);
            startUserBot(num);
        }
    });

    // 🫂 ADVANCED WELCOME/GOODBYE
    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu;
        if (action === 'add') {
            const metadata = await sock.groupMetadata(id);
            const groupLogo = await sock.profilePictureUrl(id, 'image').catch(() => 'https://files.catbox.moe/59ays3.jpg');
            const activitySnap = await getDoc(doc(db, "ACTIVITY", id));
            const activeCount = activitySnap.exists() ? Object.keys(activitySnap.data()).length : 0;
            for (let n of participants) {
                let welcome = `╭─── • 🥀 • ───╮\n  ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ ᴍᴀɪɴꜰʀᴀᴍᴇ \n╰─── • 🥀 • ───╯\n\n⚘ ᴜꜱᴇʀ : @${n.split('@')[0]}\n⚘ ɢʀᴏᴜᴘ : ${metadata.subject}\n⚘ ᴍᴇᴍʙᴇʀꜱ : ${metadata.participants.length}\n⚘ ᴀᴄᴛɪᴠᴇ : ${activeCount}\n\n*ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ*:\n${metadata.desc || 'No description.'}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
                await sock.sendMessage(id, { image: { url: groupLogo }, caption: welcome, mentions: [n], contextInfo: forwardedContext });
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
        const isOwner = sender.startsWith(num) || m.key.fromMe;

        // FETCH PREFERENCES
        const setSnap = await getDoc(doc(db, "SETTINGS", num));
        const s = setSnap.exists() ? setSnap.data() : { prefix: ".", mode: "public", autoAI: true, forceJoin: true, autoStatus: true, antiDelete: true, antiViewOnce: true, antiLink: true, antiScam: true, antiTag: true, antiBot: true, autoReact: true, antiMedia: false };

        if (s.mode === "private" && !isOwner) return;

        // 1. AUTO PRESENCE & REACT
        if (s.autoReact && !m.key.fromMe) await sock.sendMessage(from, { react: { text: '🥀', key: m.key } });
        await sock.sendPresenceUpdate('composing', from);

        // 2. SECURITY SCANNER
        if (await armedScanner(sock, m, s, isOwner)) return;

        // 3. ANTI-DELETE & VIEWONCE (Forward to Owner DM)
        if (m.message.protocolMessage?.type === 0 && s.antiDelete && !m.key.fromMe) {
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

        // 4. FORCE JOIN & FOLLOW (Link: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y)
        const isCmd = body.startsWith(s.prefix) || commands.has(body.split(' ')[0].toLowerCase());
        if (isCmd && !isOwner && s.forceJoin) {
            const groupMetadata = await sock.groupMetadata('120363406549688641@g.us');
            if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
            }
        }

        // 5. AUTO STATUS Engine (AI Human Persona)
        if (from === 'status@broadcast' && s.autoStatus) {
            await sock.readMessages([m.key]);
            const moodRes = await axios.get(`https://text.pollinations.ai/React as a natural cool friend briefly in English to this status: "${body}". No quotes.`);
            await sock.sendMessage(from, { text: moodRes.data, contextInfo: forwardedContext }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
        }

        // 6. UNIVERSAL AI CHAT (Natural Human - All languages)
        if (!isCmd && !m.key.fromMe && s.autoAI && body.length > 2 && !from.endsWith('@g.us')) {
            try {
                const aiPrompt = `Your name is WRONG TURN 6 by STANYTZ. Chat naturally, briefly, and helpfully in the same language as the user: ${body}`;
                const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // 7. REPLY-BY-NUMBER (Universal)
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = (quoted?.conversation || quoted?.extendedTextMessage?.text || "").toLowerCase();
        if (quoted && !isNaN(body) && body.length > 0) {
            for (let [name, obj] of commands) {
                if (quotedText.includes(name)) {
                    await obj.execute(m, sock, Array.from(commands.values()), [body.trim()], db, forwardedContext);
                    return;
                }
            }
        }

        // 8. COMMAND EXECUTION (Support Prefix & No-Prefix)
        let cmdName = body.startsWith(s.prefix) ? body.slice(s.prefix.length).trim().split(/ +/)[0].toLowerCase() : body.split(' ')[0].toLowerCase();
        let args = body.startsWith(s.prefix) ? body.slice(s.prefix.length).trim().split(/ +/).slice(1) : body.split(' ').slice(1);
        const cmd = commands.get(cmdName);
        if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        if (from.endsWith('@g.us')) await setDoc(doc(db, "ACTIVITY", from), { [sender]: Date.now() }, { merge: true });
    });
}

/**
 * 📦 FIREBASE AUTH STATE (SERIALIZED)
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

// 🔥 PAIRING ROUTE (ZERO ERRORS)
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    try {
        const { state, saveCreds, wipeSession } = await useFirebaseAuthState(num);
        await wipeSession();
        const pSock = makeWASocket({
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
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
                startUserBot(num);
            }
        });
    } catch (e) { res.status(500).send({ error: "System Busy" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    // Command Loader Initialization
    const cmdPath = path.resolve(__dirname, 'commands');
    if (fs.existsSync(cmdPath)) {
        fs.readdirSync(cmdPath).forEach(folder => {
            const folderPath = path.join(cmdPath, folder);
            if (fs.lstatSync(folderPath).isDirectory()) {
                fs.readdirSync(folderPath).filter(f => f.endsWith('.js')).forEach(file => {
                    const cmd = require(path.join(folderPath, file));
                    if (cmd && cmd.name) { cmd.category = folder; commands.set(cmd.name.toLowerCase(), cmd); }
                });
            }
        });
    }
    console.log("Mainframe Armed.");
    // Auto-Restore logic
    getDocs(collection(db, "ACTIVE_USERS")).then(snap => snap.forEach(d => d.data().active && !activeSessions.has(d.id) && startUserBot(d.id)));
});

// Always Online Heartbeat
setInterval(async () => {
    for (let s of activeSessions.values()) {
        if (s.user) {
            const uptime = `${Math.floor(process.uptime() / 3600)}h`;
            await s.updateProfileStatus(`WRONG TURN 6 | ONLINE | ${uptime}`).catch(() => {});
            await s.sendPresenceUpdate('available');
        }
    }
}, 30000);
