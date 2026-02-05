require('dotenv').config();
const { 
    default: makeWASocket, useMultiFileAuthState, DisconnectReason, 
    makeCacheableSignalKeyStore, getContentType, Browsers, 
    downloadContentFromMessage, jidDecode 
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, updateDoc, collection, onSnapshot } = require('firebase/firestore');
const express = require('express');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// 🔥 FIREBASE SETUP
const firebaseConfig = {
    apiKey: "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
    authDomain: "stanybots.firebaseapp.com",
    projectId: "stanybots",
    storageBucket: "stanybots.firebasestorage.app",
    messagingSenderId: "381983533939",
    appId: "1:381983533939:web:e6cc9445137c74b99df306"
};
const fApp = initializeApp(firebaseConfig);
const db = getFirestore(fApp);

// 🥀 THEME & CONTEXT
const newsletterJid = '120363404317544295@newsletter';
const groupJid = '120363406549688641@g.us';
const fContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: { newsletterJid, newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀', serverMessageId: 1 }
};

const app = express();
const msgCache = new Map();

// 🌐 WEB PAIRING UI
app.get('/', (req, res) => {
    res.send(`
    <html><head><title>WT6 PAIRING</title>
    <style>
        body { background: #000; color: #ff0000; font-family: 'Courier New', monospace; text-align: center; padding: 50px; }
        .card { border: 2px solid #f00; display: inline-block; padding: 30px; border-radius: 20px; background: #0a0a0a; box-shadow: 0 0 30px #f00; }
        input { background: #000; color: #fff; border: 1px solid #f00; padding: 15px; width: 300px; font-size: 18px; border-radius: 10px; }
        button { background: #f00; color: #000; border: none; padding: 15px 30px; cursor: pointer; font-weight: bold; border-radius: 10px; margin-top: 20px; }
        #code { font-size: 30px; margin-top: 30px; color: #fff; font-weight: bold; letter-spacing: 5px; }
    </style></head>
    <body>
        <div class="card">
            <h1>🥀 WRONG TURN 6</h1>
            <p>ENTER NUMBER WITH COUNTRY CODE</p>
            <input type="text" id="num" placeholder="255XXXXXXXXX"><br>
            <button onclick="pair()">GET PAIRING CODE</button>
            <div id="code"></div>
        </div>
        <script>
            async function pair() {
                const n = document.getElementById('num').value;
                if(!n) return alert('Weka namba mkuu!');
                document.getElementById('code').innerText = 'GENERATING...';
                const r = await fetch('/api/pair?num=' + n);
                const d = await r.json();
                document.getElementById('code').innerText = d.code || 'ERROR';
            }
        </script>
    </body></html>`);
});

app.get('/api/pair', async (req, res) => {
    const num = req.query.num.replace(/[^0-9]/g, '');
    const { state, saveCreds } = await useMultiFileAuthState('./auth/' + num);
    const sock = makeWASocket({ auth: state, logger: pino({level:'silent'}), browser: ["Ubuntu", "Chrome", "20.0.04"] });
    if (!state.creds.registered) {
        const code = await sock.requestPairingCode(num);
        res.json({ code });
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', (u) => { if(u.connection === 'open') startBot(num); });
    }
});

// 🚀 BOT MASTER ENGINE
async function startBot(num) {
    const { state, saveCreds } = await useMultiFileAuthState('./auth/' + num);
    const sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        markOnlineOnConnect: true,
        browser: ["Wrong Turn 6", "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds();
        const docRef = doc(db, "SESSIONS", num);
        await setDoc(docRef, JSON.parse(JSON.stringify(state.creds, (k,v) => Buffer.isBuffer(v) ? v.toString('base64') : v)));
    });

    // ⛔ ANTI-CALL
    sock.ev.on('call', async (calls) => {
        const s = await getSettings(num);
        if (s.antiCall) {
            for (let c of calls) {
                if (c.status === 'offer') {
                    await sock.rejectCall(c.id, c.from);
                    await sock.sendMessage(c.from, { text: "╭── • 🥀 • ──╮\n  *CALL REJECTED*\n\nCalls are not allowed!\n╰── • 🥀 • ──╯" });
                }
            }
        }
    });

    // 💬 MESSAGE PROCESSING
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const type = getContentType(m.message);
        const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage' || type === 'videoMessage') ? m.message[type].caption : '';
        const isOwner = m.key.fromMe || sender.split('@')[0] === sock.user.id.split(':')[0];
        const isGroup = from.endsWith('@g.us');

        msgCache.set(m.key.id, m);
        const s = await getSettings(num);

        // 👤 FORCE FOLLOW
        if (!isOwner && body.startsWith('.') && !isGroup) {
            const isFollower = await checkFollow(sock, sender);
            if (!isFollower) return sock.sendMessage(from, { text: "╭── • 🥀 • ──╮\n  *ACCESS DENIED*\n\nJoin our channel & group to use bot.\n\nChannel: https://whatsapp.com/channel/0029VaP0V\nGroup: https://chat.whatsapp.com/J19JAS\n╰── • 🥀 • ──╯" });
        }

        // 🔘 EMOJI COMMAND SYSTEM
        const emojis = await getEmojiConfig(num);
        if (emojis[body.trim()]) return executeCommand(emojis[body.trim()], sock, m, from, sender, [], s);

        // 🛡️ SECURITY SYSTEM (ANTI-LINK, PORN, SCAM, MEDIA)
        if (isGroup && !isOwner) {
            if (s.antiLink && /https?:\/\/[^\s]+/gi.test(body)) return securityAction(sock, m, from, sender, "External Link detected", s.autoKick);
            if (s.antiPorn && /(porn|xxx|🔞|sex|nude)/gi.test(body)) return securityAction(sock, m, from, sender, "Pornographic content detected", true);
            if (s.antiScam && /(bundle|fixed|invest|win money|pesa)/gi.test(body)) return securityAction(sock, m, from, sender, "Scam/Fraudulent message detected", s.autoKick);
            if (s.antiMedia && ['imageMessage', 'videoMessage', 'audioMessage'].includes(type)) return securityAction(sock, m, from, sender, "Media content prohibited", false);
        }

        // ♻️ ANTI-DELETE & VIEW ONCE
        if (m.message.protocolMessage?.type === 0 && s.antiDelete) {
            const old = msgCache.get(m.message.protocolMessage.key.id);
            if (old) {
                await sock.sendMessage(sock.user.id, { text: `╭── • 🥀 • ──╮\n  *ANTI-DELETE*\n\nRecovered from: @${sender.split('@')[0]}\n╰── • 🥀 • ──╯`, mentions: [sender] });
                await sock.copyNForward(sock.user.id, old, false, { contextInfo: fContext });
            }
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: fContext });
        }

        // 🤖 AUTO AI CHAT (Human-like)
        if (!isGroup && !body.startsWith('.') && s.autoAI && !m.key.fromMe && body.length > 1) {
            await sock.sendPresenceUpdate('composing', from);
            const res = await getAI(body);
            await sock.sendMessage(from, { text: `╭── • 🥀 • ──╮\n${res}\n╰── • 🥀 • ──╯` + `\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: fContext }, { quoted: m });
        }

        // 📊 STATUS AUTO VIEW & AI REPLY
        if (from === 'status@broadcast' && s.autoStatus) {
            await sock.readMessages([m.key]);
            await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
            const aiStatus = await getAI(`Analyze and reply naturally to this status update: "${body || 'Media Status'}"`);
            await sock.sendMessage(from, { text: aiStatus }, { quoted: m });
        }

        // ⌨️ PREFIX COMMANDS
        if (body.startsWith('.')) {
            const [cmd, ...args] = body.slice(1).trim().split(/ +/);
            executeCommand(cmd.toLowerCase(), sock, m, from, sender, args, s);
        }
    });
}

// 🛠️ HELPER FUNCTIONS
async function getSettings(id) {
    const d = await getDoc(doc(db, "WT6_SETTINGS", id));
    return d.exists() ? d.data() : { antiLink: true, antiDelete: true, autoAI: true, antiCall: true, antiPorn: true, autoKick: true, antiMedia: false, autoStatus: true, autoRead: true };
}

async function getEmojiConfig(id) {
    const d = await getDoc(doc(db, "WT6_EMOJIS", id));
    return d.exists() ? d.data() : { "🥀": "menu" };
}

async function getAI(q) {
    try {
        const r = await axios.get(`https://text.pollinations.ai/Respond helpfully as WRONG TURN 6 WhatsApp Bot in the same language as the user: ${encodeURIComponent(q)}`);
        return r.data;
    } catch { return "Nipo hapa mkuu, unahitaji nini? 🥀"; }
}

async function securityAction(sock, m, from, sender, reason, kick) {
    await sock.sendMessage(from, { delete: m.key });
    const txt = `╭── • 🥀 • ──╮\n  *SECURITY ACTION*\n\n👤 User: @${sender.split('@')[0]}\n🛡️ Reason: ${reason}\n⚡ Action: Deleted${kick ? ' + Removed' : ''}\n╰── • 🥀 • ──╯`;
    await sock.sendMessage(from, { text: txt, mentions: [sender] });
    if (kick) await sock.groupParticipantsUpdate(from, [sender], "remove");
}

async function checkFollow(sock, jid) {
    try {
        const g = await sock.groupMetadata(groupJid);
        return g.participants.some(p => p.id === jid);
    } catch { return true; }
}

async function executeCommand(cmd, sock, m, from, sender, args, s) {
    const reply = (t) => sock.sendMessage(from, { text: `╭── • 🥀 • ──╮\n${t}\n╰── • 🥀 • ──╯` + `\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: fContext }, { quoted: m });
    
    if (cmd === 'menu') {
        return reply(`*WRONG TURN 6 - MENU*\n\n◦ .settings\n◦ .active (Group Stats)\n◦ .kick @user\n◦ .promote @user\n◦ .ai [query]\n◦ .setemoji [emoji] [cmd]\n◦ .song [name]\n◦ .video [name]`);
    }

    if (cmd === 'setemoji') {
        if (!args[1]) return reply("Usage: .setemoji 🥀 menu");
        await setDoc(doc(db, "WT6_EMOJIS", sock.user.id.split(':')[0]), { [args[0]]: args[1] }, { merge: true });
        return reply(`✅ Link Success: Emoji ${args[0]} will now trigger command: ${args[1]}`);
    }

    if (cmd === 'settings') {
        return reply(`*WT6 SETTINGS*\n\nAnti-Link: ${s.antiLink}\nAnti-Delete: ${s.antiDelete}\nAuto-AI: ${s.autoAI}\nAnti-Call: ${s.antiCall}\nAnti-Porn: ${s.antiPorn}`);
    }
}

// 🛰️ START SERVER
app.listen(process.env.PORT || 3000, () => {
    console.log("🥀 WRONG TURN 6 IS ARMED & READY");
    if(fs.existsSync('./auth')) fs.readdirSync('./auth').forEach(f => startBot(f));
});

// FIX SIGTERM FOR RENDER/RAILWAY
process.on('SIGTERM', () => { console.log('⚠️ Graceful shutdown...'); process.exit(0); });
