require('dotenv').config();
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeCacheableSignalKeyStore,
    getContentType,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, updateDoc, collection } = require('firebase/firestore');
const express = require('express');
const pino = require('pino');
const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');

// --- FIREBASE CONFIG ---
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
const app = express();

// --- GLOBALS ---
const msgCache = new Map();
const newsletterJid = '120363404317544295@newsletter';
const supportGroup = '120363406549688641@g.us';

const theme = {
    p: (t) => `╭── • 🥀 • ──╮\n${t}\n╰── • 🥀 • ──╯`,
    footer: `\n\n└──────────────\nᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ 🥀`,
    fContext: {
        isForwarded: true,
        forwardingScore: 999,
        forwardedNewsletterMessageInfo: {
            newsletterJid: newsletterJid,
            serverMessageId: 1,
            newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀'
        }
    }
};

// --- WEB SERVER & PAIRING UI ---
app.use(express.static('public'));
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WRONG TURN 6 - PAIRING</title>
        <style>
            body { background: #000; color: #ff0000; font-family: 'Courier New', monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { border: 2px solid #ff0000; padding: 30px; border-radius: 15px; text-align: center; box-shadow: 0 0 20px #ff0000; background: #0a0a0a; width: 90%; max-width: 400px; }
            input { width: 100%; padding: 12px; margin: 15px 0; border: 1px solid #ff0000; background: #000; color: #fff; border-radius: 5px; box-sizing: border-box; }
            button { background: #ff0000; color: #000; border: none; padding: 12px 25px; cursor: pointer; font-weight: bold; border-radius: 5px; width: 100%; }
            #code { font-size: 2rem; margin-top: 20px; color: #fff; letter-spacing: 5px; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>🥀 WRONG TURN 6</h1>
            <p>Enter your phone number (with country code)</p>
            <input type="text" id="number" placeholder="e.g. 255712345678">
            <button onclick="getCode()">GET PAIRING CODE</button>
            <div id="code"></div>
        </div>
        <script>
            async function getCode() {
                const num = document.getElementById('number').value;
                const display = document.getElementById('code');
                display.innerText = "GENERATING...";
                try {
                    const res = await fetch('/api/pair?number=' + num);
                    const data = await res.json();
                    display.innerText = data.code || "ERROR";
                } catch (e) { display.innerText = "FAILED"; }
            }
        </script>
    </body>
    </html>
    `);
});

// --- API TO GENERATE PAIRING CODE ---
app.get('/api/pair', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.json({ error: "No number" });

    const { state, saveCreds } = await useMultiFileAuthState('./sessions/' + number);
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari")
    });

    if (!state.creds.registered) {
        try {
            const code = await sock.requestPairingCode(number);
            res.json({ code });
            
            // Start the bot for this user once paired
            sock.ev.on('creds.update', saveCreds);
            sock.ev.on('connection.update', (u) => {
                if (u.connection === 'open') {
                    console.log("✅ Device linked: " + number);
                    // Save session to Firebase here for persistence
                    saveSessionToFirebase(number, state.creds);
                    startBotEngine(number);
                }
            });
        } catch (e) { res.json({ error: e.message }); }
    }
});

// --- FIREBASE SESSION PERSISTENCE ---
async function saveSessionToFirebase(number, creds) {
    const docRef = doc(db, "WT6_SESSIONS", number);
    const safeCreds = JSON.parse(JSON.stringify(creds, (k, v) => Buffer.isBuffer(v) ? v.toString('base64') : v));
    await setDoc(docRef, { creds: safeCreds, updatedAt: Date.now() });
}

// --- MAIN BOT ENGINE ---
async function startBotEngine(number) {
    const { state, saveCreds } = await useMultiFileAuthState('./sessions/' + number);
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        markOnlineOnConnect: true,
        browser: ["WrongTurn-6", "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;

        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const type = getContentType(m.message);
        const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage' || type === 'videoMessage') ? m.message[type].caption : '';
        const isOwner = m.key.fromMe || sender.split('@')[0] === sock.user.id.split(':')[0];
        const isGroup = from.endsWith('@g.us');

        // CACHE FOR ANTI-DELETE
        msgCache.set(m.key.id, m);

        // SETTINGS FETCH
        const settings = await getDoc(doc(db, "WT6_SETTINGS", from)).then(d => d.exists() ? d.data() : { antiLink: true, antiPorn: true, autoAI: true, antiDelete: true });

        // --- EMOJI COMMAND SYSTEM ---
        const emojiMaps = await getDoc(doc(db, "WT6_EMOJIS", sock.user.id.split(':')[0])).then(d => d.exists() ? d.data() : { "🥀": "menu" });
        if (emojiMaps[body.trim()]) {
            return runCommand(emojiMaps[body.trim()], sock, m, from, sender, settings);
        }

        // --- SECURITY SYSTEM ---
        if (isGroup && !isOwner) {
            const warnUser = async (reason) => {
                await sock.sendMessage(from, { delete: m.key });
                await sock.sendMessage(from, { text: theme.p(`⚠️ *SECURITY ACTION*\n\nUser: @${sender.split('@')[0]}\nReason: ${reason}\n\n_System Armed by WT6_`), mentions: [sender] });
            };

            if (settings.antiLink && /https?:\/\/[^\s]+/gi.test(body)) return warnUser("Links are not allowed!");
            if (settings.antiPorn && /(porn|xxx|sex|🔞|nude)/gi.test(body)) return warnUser("Adult content detected!");
            if (settings.antiScam && /(bundle|invest|free money|fixed)/gi.test(body)) return warnUser("Scam keywords detected!");
        }

        // --- ANTI-DELETE ---
        if (m.message.protocolMessage?.type === 0 && settings.antiDelete) {
            const old = msgCache.get(m.message.protocolMessage.key.id);
            if (old) {
                await sock.sendMessage(sock.user.id, { text: `🛡️ *RECOVERED MESSAGE* from @${sender.split('@')[0]}`, mentions: [sender] });
                await sock.copyNForward(sock.user.id, old, false, { contextInfo: theme.fContext });
            }
        }

        // --- AI CHAT (REPLIES AS HUMAN IN USER LANGUAGE) ---
        if (!isGroup && !body.startsWith('.') && settings.autoAI && !m.key.fromMe && body.length > 1) {
            await sock.sendPresenceUpdate('composing', from);
            const aiPrompt = `You are WRONG TURN 6, a helpful WhatsApp bot. Reply in a natural, human-like way in the SAME language the user is using. User said: "${body}"`;
            try {
                const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
                await sock.sendMessage(from, { text: theme.p(res.data) + theme.footer, contextInfo: theme.fContext }, { quoted: m });
            } catch (e) {}
        }

        // --- STATUS SYSTEM ---
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]);
            await sock.sendMessage(from, { react: { text: '❤️', key: m.key } }, { statusJidList: [sender] });
        }

        // --- COMMANDS ---
        if (body.startsWith('.')) {
            const cmd = body.slice(1).trim().split(' ')[0].toLowerCase();
            runCommand(cmd, sock, m, from, sender, settings);
        }
    });
}

async function runCommand(cmd, sock, m, from, sender, s) {
    const reply = (t) => sock.sendMessage(from, { text: theme.p(t) + theme.footer, contextInfo: theme.fContext }, { quoted: m });

    if (cmd === 'menu') {
        return reply(`*WRONG TURN 6 - MENU*\n\n◦ .settings\n◦ .kick\n◦ .active\n◦ .setemoji [emoji] [cmd]\n◦ .ai [query]`);
    }
    
    if (cmd === 'setemoji') {
        const args = m.message.conversation.split(' ');
        if (args.length < 3) return reply("Use: .setemoji 🥀 menu");
        await setDoc(doc(db, "WT6_EMOJIS", sock.user.id.split(':')[0]), { [args[1]]: args[2] }, { merge: true });
        reply(`✅ Success! Emoji ${args[1]} now triggers ${args[2]}`);
    }
}

// Start Server
app.listen(process.env.PORT || 3000, () => {
    console.log("🚀 Server running on port 3000");
    // Resume existing sessions from local or firebase if needed
    if (fs.existsSync('./sessions')) {
        const users = fs.readdirSync('./sessions');
        users.forEach(u => startBotEngine(u));
    }
});
