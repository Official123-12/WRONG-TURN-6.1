const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const { saveSession, getSession, db } = require("./config");

const app = express();
global.commands = new Map();

// 1. DYNAMIC COMMAND LOADER (With Safety)
const loadCommands = () => {
    try {
        const cmdPath = path.join(__dirname, 'commands');
        if (!fs.existsSync(cmdPath)) {
            console.log("❌ Folder la 'commands' halipo! Nitatengeneza sasa...");
            fs.mkdirSync(cmdPath);
            return;
        }

        const categories = fs.readdirSync(cmdPath);
        categories.forEach(cat => {
            const catPath = path.join(cmdPath, cat);
            if (fs.lstatSync(catPath).isDirectory()) {
                const files = fs.readdirSync(catPath).filter(f => f.endsWith('.js'));
                files.forEach(file => {
                    try {
                        const cmd = require(path.join(catPath, file));
                        cmd.category = cat;
                        global.commands.set(cmd.name, cmd);
                    } catch (e) {
                        console.error(`❌ Error loading command ${file}:`, e.message);
                    }
                });
            }
        });
        console.log(`✅ ${global.commands.size} Commands Loaded Successfully!`);
    } catch (err) {
        console.error("CRITICAL ERROR IN COMMAND LOADER:", err);
    }
};

// 2. MAIN ENGINE
async function startBot(sessionId) {
    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(`temp_${sessionId}`);
        
        const stored = await getSession(sessionId);
        if (stored) state.creds = stored;

        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.creds, pino({ level: 'fatal' })),
            },
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ["WRONG TURN 6", "Safari", "3.0.0"],
            version
        });

        sock.ev.on("creds.update", async () => {
            await saveCreds();
            await saveSession(sessionId, state.creds);
        });

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "open") {
                console.log(`🚀 WRONG TURN 6 CONNECTED: ${sessionId}`);
                sock.sendPresenceUpdate('available');
            }
            if (connection === "close") {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    console.log("♻️ Reconnecting...");
                    startBot(sessionId);
                }
            }
        });

        sock.ev.on("messages.upsert", async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe) return;

                const from = msg.key.remoteJid;
                const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

                // Auto Status View
                if (from === 'status@broadcast') {
                    await sock.readMessages([msg.key]);
                    await sock.sendMessage(from, { react: { text: '🥀', key: msg.key } }, { statusJidList: [msg.key.participant] });
                }

                // Command Handler
                const prefix = ".";
                if (body.startsWith(prefix)) {
                    const [cmdName, ...args] = body.slice(1).trim().split(" ");
                    const cmd = global.commands.get(cmdName);
                    if (cmd) await cmd.execute(sock, msg, args);
                }
            } catch (err) {
                console.error("Error in message upsert:", err);
            }
        });

    } catch (err) {
        console.error("FATAL ERROR IN STARTBOT:", err);
    }
}

// 3. EXPRESS & PAIRING
app.use(express.static('public'));

app.get('/pair', async (req, res) => {
    try {
        const phone = req.query.number;
        if (!phone) return res.status(400).send({ error: "Missing number" });
        const sid = `USER_${phone.replace(/\D/g, '')}`;
        const sock = await startBot(sid);
        
        // Timeout kutoa code
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phone);
                res.send({ code });
            } catch (e) {
                res.status(500).send({ error: "Pairing service busy" });
            }
        }, 6000);
    } catch (err) {
        res.status(500).send({ error: "Internal Server Error" });
    }
});

// Auto-restore
const restore = async () => {
    try {
        const snap = await db.collection('sessions').get();
        snap.forEach(doc => startBot(doc.id));
    } catch (e) {
        console.log("No previous sessions found.");
    }
};

// Catch Uncaught Exceptions so the bot doesn't crash silently
process.on('uncaughtException', (err) => {
    console.error('SERVER CRASHED! Reason:', err);
});

app.listen(3000, () => {
    loadCommands();
    restore();
    console.log("✅ WRONG TURN 6 Server running on Port 3000");
});
