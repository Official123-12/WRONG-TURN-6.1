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

// 🟢 GLOBAL STABILITY & ERROR SHIELD
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

const newsletterJid = '120363404317544295@newsletter';
const groupJid = '120363406549688641@g.us';

// 💎 PREMIUM FORWARDING MASK
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: newsletterJid,
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
    }
};

/**
 * 🔐 ARMED SECURITY WITH EXPLANATIONS
 */
async function armedSecurity(sock, m, s, isOwner) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || from;
    const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase();
    const type = getContentType(m.message);

    if (!from.endsWith('@g.us') || isOwner) return false;

    const explain = async (reason) => {
        await sock.sendMessage(from, { delete: m.key });
        const text = `❌ *ꜱᴇᴄᴜʀɪᴛʏ ᴀᴄᴛɪᴏɴ*\n\nᴜꜱᴇʀ: @${sender.split('@')[0]}\nᴀᴄᴛɪᴏɴ: ᴍᴇꜱꜱᴀɢᴇ ᴅᴇʟᴇᴛᴇᴅ\nʀᴇᴀꜱᴏɴ: ${reason}\n\n_ꜱʏꜱᴛᴇᴍ: ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼_`;
        await sock.sendMessage(from, { text, mentions: [sender], contextInfo: forwardedContext });
    };

    if (s.antiLink && body.match(/https?:\/\/[^\s]+/gi)) { await explain("External link sharing is prohibited."); return true; }
    if (s.antiBot && m.key.id.startsWith('BAE5')) { await explain("Bot-generated traffic detected."); return true; }
    
    const scams = ["bundle", "fixed match", "earn money", "investment"];
    if (s.antiScam && scams.some(w => body.includes(w))) {
        const metadata = await sock.groupMetadata(from);
        await sock.sendMessage(from, { text: `‼️ *ꜱᴄᴀᴍ ᴀʟᴇʀᴛ* ‼️\n@${sender.split('@')[0]} is spreading fraud! Precaution for all members.`, mentions: metadata.participants.map(v => v.id), contextInfo: forwardedContext });
        await sock.sendMessage(from, { delete: m.key });
        await sock.groupParticipantsUpdate(from, [sender], "remove");
        return true;
    }

    const isPorn = /(porn|xxx|sex|ngono|vixen|🔞)/gi.test(body);
    if (s.antiPorn && isPorn) { await explain("Pornographic content prohibited."); await sock.groupParticipantsUpdate(from, [sender], "remove"); return true; }

    if (s.antiMedia && (type === 'imageMessage' || type === 'videoMessage' || type === 'audioMessage' || type === 'stickerMessage')) {
        await explain("Media sharing is currently disabled.");
        return true;
    }

    return false;
}

/**
 * 🦾 SUPREME INJECTED ENGINE
 */
async function startUserBot(num) {
    if (activeSessions.has(num)) return;
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
    
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        version,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Desktop"), // FIX: Desktop mode ni stable zaidi kwa kulingi
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    activeSessions.set(num, sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            await setDoc(doc(db, "ACTIVE_USERS", num), { active: true });
            console.log(`✅ WRONG TURN 6: ARMED [${num}]`);
            const welcome = `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ`;
            await sock.sendMessage(sock.user.id, { text: welcome, contextInfo: forwardedContext });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            activeSessions.delete(num);
            startUserBot(num);
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
        const isOwner = sender.startsWith(num) || m.key.fromMe;

        const setSnap = await getDoc(doc(db, "SETTINGS", num));
        const s = setSnap.exists() ? setSnap.data() : { prefix: ".", mode: "public", autoAI: true, forceJoin: true, autoStatus: true, antiDelete: true, antiViewOnce: true, antiLink: true, antiTag: true, antiScam: true, autoReact: true };

        if (s.mode === "private" && !isOwner) return;

        if (s.autoReact && !m.key.fromMe) await sock.sendMessage(from, { react: { text: '🥀', key: m.key } });
        await sock.sendPresenceUpdate('composing', from);

        if (await armedSecurity(sock, m, s, isOwner)) return;

        if (m.message?.protocolMessage?.type === 0 && s.antiDelete && !m.key.fromMe) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ* Recovered from @${sender.split('@')[0]}`, mentions: [sender] });
                await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
            }
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ*` });
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        const isCmd = body.startsWith(s.prefix) || commands.has(body.split(' ')[0].toLowerCase());
        if (isCmd && !isOwner && s.forceJoin) {
            try {
                const groupMetadata = await sock.groupMetadata(groupJid);
                if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
                }
            } catch (e) {}
        }

        if (from === 'status@broadcast' && s.autoStatus) {
            await sock.readMessages([m.key]);
            const moodRes = await axios.get(`https://text.pollinations.ai/React to this status briefly and naturally in English as a human friend: "${body}". No quotes.`);
            await sock.sendMessage(from, { text: moodRes.data, contextInfo: forwardedContext }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
        }

        if (!isCmd && !m.key.fromMe && s.autoAI && body.length > 2 && !from.endsWith('@g.us')) {
            try {
                const aiPrompt = `Your name is WRONG TURN 6. Developer: STANYTZ. Respond naturally, briefly, and helpfully in the user's language: ${body}`;
                const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

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

        let cmdName = body.startsWith(s.prefix) ? body.slice(s.prefix.length).trim().split(/ +/)[0].toLowerCase() : body.split(' ')[0].toLowerCase();
        let args = body.startsWith(s.prefix) ? body.slice(s.prefix.length).trim().split(/ +/).slice(1) : body.split(' ').slice(1);
        const cmd = commands.get(cmdName);
        if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        if (from.endsWith('@g.us')) await setDoc(doc(db, "ACTIVITY", from), { [sender]: Date.now() }, { merge: true });
    });
}

/**
 * 🟢 THE SOVEREIGN INDEX ROUTE
 */
app.get('/', (req, res) => {
    const uptime = Math.floor(process.uptime() / 3600);
    res.status(200).send(`
        <body style="background:#000;color:#ff0000;font-family:sans-serif;text-align:center;padding-top:100px;">
            <img src="https://files.catbox.moe/59ays3.jpg" style="width:150px;border-radius:50%;border:2px solid #ff0000;">
            <h1 style="letter-spacing:10px;">W R O N G  T U R N  6</h1>
            <p style="letter-spacing:5px;">MAINFRAME STATUS: <span style="color:#00ff00">ARMED</span></p>
            <p>ACTIVE NODES: ${activeSessions.size}</p>
            <p>UPTIME: ${uptime} HOURS</p>
            <p style="color:#444">DEVELOPED BY STANYTZ</p>
            <br>
            <a href="/link" style="color:#fff;text-decoration:none;border:1px solid #ff0000;padding:15px 30px;border-radius:10px;">GOTO PAIRING PANEL</a>
        </body>
    `);
});

app.use(express.static('public'));
app.get('/link', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

// 🔥 PAIRING ROUTE (FIXED)
app.get('/code', async (req, res) => {
    let num = req.query.number.replace(/\D/g, '');
    try {
        const { useFirebaseAuthState } = require('./lib/firestoreAuth');
        const { state, saveCreds, wipeSession } = await useFirebaseAuthState(db, "WT6_SESSIONS", num);
        await wipeSession(); // FIX: Safisha data za zamani ili code ikubali mara moja
        
        const pSock = makeWASocket({
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Desktop") // FIX: Desktop mode inazuia "Couldn't link device"
        });
        
        pSock.ev.on('creds.update', saveCreds);
        await delay(7000); // Tunasubiri socket iji-organize
        let code = await pSock.requestPairingCode(num);
        res.send({ code });
        pSock.ev.on('connection.update', (u) => { if (u.connection === 'open') { pSock.end?.(); startUserBot(num); } });
    } catch (e) { res.status(500).send({ error: "System Busy" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
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
    console.log(`Armed: ${PORT}`);
    getDocs(collection(db, "ACTIVE_USERS")).then(snap => snap.forEach(d => d.data().active && !activeSessions.has(d.id) && startUserBot(d.id)));
});

// Always Online Status
setInterval(async () => {
    for (let s of activeSessions.values()) {
        if (s.user) {
            const up = Math.floor(process.uptime() / 3600);
            await s.updateProfileStatus(`WRONG TURN 6 | ONLINE | ${up}h Active`).catch(() => {});
            await s.sendPresenceUpdate('available');
        }
    }
}, 30000);
