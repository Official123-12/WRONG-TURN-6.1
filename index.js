const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const { saveSession, getSession, db } = require("./config");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const sessions = new Map(); // Inatunza bot zote zilizo active

// --- COMMAND LOADER ---
global.commands = new Map();
const loadCommands = () => {
    const categories = fs.readdirSync('./commands');
    categories.forEach(cat => {
        const files = fs.readdirSync(`./commands/${cat}`).filter(f => f.endsWith('.js'));
        files.forEach(file => {
            const cmd = require(`./commands/${cat}/${file}`);
            cmd.category = cat;
            global.commands.set(cmd.name, cmd);
        });
    });
};

async function startBot(sessionId = "MASTER") {
    const { version } = await fetchLatestBaileysVersion();
    const storedData = await getSession(sessionId);
    
    // Auth Logic
    let { state, saveCreds } = await useMultiFileAuthState(`auth_${sessionId}`);
    if (storedData) state.creds = storedData;

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.creds, pino({ level: 'fatal' })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["WRONG TURN 6", "MacOS", "3.0.0"]
    });

    sessions.set(sessionId, sock);

    sock.ev.on("creds.update", async () => {
        await saveCreds();
        await saveSession(sessionId, state.creds);
    });

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log(`✅ ${sessionId} CONNECTED!`);
            sock.sendMessage(sock.user.id, { text: "WRONG TURN 6 IS NOW ONLINE ✔️\nDev: STANYTZ" });
        }
        if (connection === "close") {
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) startBot(sessionId);
        }
    });

    // SECURITY & AUTO FEATURES
    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const from = msg.key.remoteJid;

        // 1. Auto Status View & Like
        if (from === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            await sock.sendMessage(from, { react: { text: '🥀', key: msg.key } }, { statusJidList: [msg.key.participant] });
        }

        // 2. Anti-Link (Group Only)
        if (body.match(/(https:\/\/chat.whatsapp.com)/gi) && from.endsWith('@g.us')) {
            await sock.sendMessage(from, { delete: msg.key });
            await sock.groupParticipantsUpdate(from, [msg.key.participant], "remove");
        }

        // 3. Command Handler
        const prefix = ".";
        if (body.startsWith(prefix)) {
            const [cmdName, ...args] = body.slice(1).trim().split(" ");
            const cmd = global.commands.get(cmdName.toLowerCase());
            if (cmd) await cmd.execute(sock, msg, args);
        }
    });

    // Anti-Call
    sock.ev.on("call", async (call) => {
        await sock.sendMessage(call[0].from, { text: "📵 *Security Alert:* Calls are disabled. Blocking..." });
        await sock.updateBlockStatus(call[0].from, "block");
    });

    return sock;
}

// RESTORE ALL SESSIONS FROM FIREBASE ON STARTUP
const restoreSessions = async () => {
    const snapshot = await db.collection('sessions').get();
    snapshot.forEach(doc => {
        console.log(`Restoring session: ${doc.id}`);
        startBot(doc.id);
    });
};

// Express Pairing UI Logic
app.get('/pair', async (req, res) => {
    const phone = req.query.number;
    const sessionId = `USER_${phone}`;
    const sock = await startBot(sessionId);
    setTimeout(async () => {
        try {
            const code = await sock.requestPairingCode(phone);
            res.send({ code });
        } catch {
            res.send({ error: "Failed to get code" });
        }
    }, 3000);
});

app.listen(PORT, () => {
    loadCommands();
    restoreSessions();
    console.log(`Server running on port ${PORT}`);
});
