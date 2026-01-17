const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeCacheableSignalKeyStore,
    BufferJSON
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const { saveSession, getSession, db } = require("./config");

const app = express();
global.commands = new Map();

// 1. DYNAMIC COMMAND LOADER
const loadCommands = () => {
    const cmdPath = path.join(__dirname, 'commands');
    fs.readdirSync(cmdPath).forEach(cat => {
        const catPath = path.join(cmdPath, cat);
        if (fs.lstatSync(catPath).isDirectory()) {
            fs.readdirSync(catPath).forEach(file => {
                if (file.endsWith('.js')) {
                    const cmd = require(path.join(catPath, file));
                    cmd.category = cat;
                    global.commands.set(cmd.name, cmd);
                }
            });
        }
    });
    console.log(`✅ Loaded ${global.commands.size} Commands`);
};

// 2. MAIN BOT ENGINE
async function startBot(sessionId) {
    const { state, saveCreds } = await useMultiFileAuthState(`temp_${sessionId}`);
    
    // Vuta data kutoka Firebase kama ipo
    const storedCreds = await getSession(sessionId);
    if (storedCreds) state.creds = storedCreds;

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.creds, pino({ level: 'fatal' })),
        },
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["WRONG TURN 6", "Safari", "1.0.0"]
    });

    // Save to Firebase on update
    sock.ev.on("creds.update", async () => {
        await saveCreds();
        await saveSession(sessionId, state.creds);
    });

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log(`✅ Connected: ${sessionId}`);
            sock.sendMessage(sock.user.id, { text: "WRONG TURN 6 ONLINE ✔️\nDeveloper: STANYTZ" });
        }
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot(sessionId);
        }
    });

    // BOT FEATURES (Auto-Status, Commands, Security)
    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // Auto Status View/Like
        if (from === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            await sock.sendMessage(from, { react: { text: '🔥', key: msg.key } }, { statusJidList: [msg.key.participant] });
        }

        // Anti-Link
        if (body.includes("chat.whatsapp.com") && from.endsWith('@g.us')) {
            await sock.sendMessage(from, { delete: msg.key });
        }

        // Command Handler
        const prefix = ".";
        if (body.startsWith(prefix)) {
            const [cmdName, ...args] = body.slice(1).trim().split(" ");
            const cmd = global.commands.get(cmdName.toLowerCase());
            if (cmd) await cmd.execute(sock, msg, args);
        }
    });

    // Anti-Call Security
    sock.ev.on("call", async (call) => {
        await sock.updateBlockStatus(call[0].from, "block");
    });

    return sock;
}

// 3. EXPRESS SERVER & PAIRING
app.use(express.static('public'));

app.get('/pair', async (req, res) => {
    const phone = req.query.number;
    if (!phone) return res.send({ error: "No number" });
    const sessionId = `USER_${phone.replace(/\D/g, '')}`;
    const sock = await startBot(sessionId);
    
    setTimeout(async () => {
        try {
            const code = await sock.requestPairingCode(phone);
            res.send({ code });
        } catch (e) {
            res.send({ error: "Failed to fetch code" });
        }
    }, 5000);
});

// AUTO-RESTORE ALL SESSIONS ON START
const restore = async () => {
    const snapshot = await db.collection('sessions').get();
    snapshot.forEach(doc => startBot(doc.id));
};

app.listen(3000, () => {
    loadCommands();
    restore();
    console.log("WRONG TURN 6 Server started on Port 3000");
});
