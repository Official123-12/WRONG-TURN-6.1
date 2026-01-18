require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion,
    BufferJSON 
} = require('@whiskeysockets/baileys');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');

// HATA HAPA - Ondoa Firebase kabisa kwa sasa kujaribu
// Weka data kwenye local file kwanza

const app = express();
const commands = new Map();
let sock = null;
let welcomeTracker = new Set();

// 1. COMMAND LOADER
const loadCmds = () => {
    const cmdPath = path.resolve(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    const categories = fs.readdirSync(cmdPath);
    for (const category of categories) {
        const categoryPath = path.join(cmdPath, category);
        if (fs.lstatSync(categoryPath).isDirectory()) {
            const files = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
            for (const file of files) {
                try {
                    const cmd = require(path.join(categoryPath, file));
                    cmd.category = category;
                    commands.set(cmd.name.toLowerCase(), cmd);
                } catch (e) { console.error(`Error loading ${file}`); }
            }
        }
    }
    console.log(`📡 WRONG TURN 6: ${commands.size} COMMANDS ARMED`);
};

// 2. SIMPLE LOCAL FILE AUTH STATE (Temporary fix)
async function useLocalAuthState() {
    const authFolder = path.join(__dirname, 'auth_info');
    if (!fs.existsSync(authFolder)) {
        fs.mkdirSync(authFolder, { recursive: true });
    }

    const credsPath = path.join(authFolder, 'creds.json');
    const keysPath = path.join(authFolder, 'keys.json');

    let creds = {};
    let keys = {};

    // Read existing data
    if (fs.existsSync(credsPath)) {
        try {
            creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
        } catch (e) {
            console.log('No existing credentials found');
        }
    }

    if (fs.existsSync(keysPath)) {
        try {
            keys = JSON.parse(fs.readFileSync(keysPath, 'utf-8'));
        } catch (e) {
            console.log('No existing keys found');
        }
    }

    return {
        state: {
            creds: creds || require('@whiskeysockets/baileys').initAuthCreds(),
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        const key = `${type}-${id}`;
                        if (keys[key]) {
                            data[id] = keys[key];
                        }
                    }
                    return data;
                },
                set: async (data) => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            const key = `${type}-${id}`;
                            const value = data[type][id];
                            if (value) {
                                keys[key] = value;
                            } else {
                                delete keys[key];
                            }
                        }
                    }
                    fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2));
                }
            }
        },
        saveCreds: () => {
            fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));
        }
    };
}

// 3. START ENGINE
async function startBot() {
    loadCmds();
    
    try {
        console.log('🚀 Starting WRONG TURN 6...');
        const { state, saveCreds } = await useLocalAuthState();
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            auth: state,
            version,
            logger: pino({ level: 'error' }),
            browser: Browsers.macOS("Safari"),
            printQRInTerminal: false,
            markOnlineOnConnect: true
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                const botId = sock.user.id.split(':')[0];
                if (!welcomeTracker.has(botId)) {
                    // Verified VCard
                    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:WRONG TURN 6 ✔️\nORG:STANYTZ;\nTEL;type=CELL;type=VOICE;waid=${botId}:${botId}\nEND:VCARD`;
                    await sock.sendMessage(sock.user.id, { contacts: { displayName: 'STANYTZ', contacts: [{ vcard }] } });

                    // Premium Vertical Welcome
                    const welcome = `┏━━━━ 『 WRONG TURN 6 』 ━━━━┓\n┃\n┃ 🥀 *SYSTEM ARMED & ACTIVE*\n┃\n┣━━━━━━━━━━━━━━━━━━━━━━━┓\n┃ 🛡️ *DEV    :* STANYTZ\n┃ ⚙️ *VERSION:* 6.6.0\n┃ 🌐 *ENGINE :* AngularSockets\n┃ 🌷 *PREFIX :* [ . ]\n┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n🥀🥂 *STANYTZ INDUSTRIES*`;
                    await sock.sendMessage(sock.user.id, { text: welcome });
                    welcomeTracker.add(botId);
                }
                console.log("✅ WRONG TURN 6 ONLINE");
            }
            
            if (connection === 'close') {
                console.log('❌ Connection closed:', lastDisconnect?.error?.message);
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    console.log('🔄 Reconnecting in 5 seconds...');
                    setTimeout(startBot, 5000);
                }
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
            
            // Auto Presence
            await sock.sendPresenceUpdate('composing', from);
            await sock.sendPresenceUpdate('recording', from);

            // Anti-Link (Delete links for non-admins)
            if (/(https?:\/\/[^\s]+)/g.test(body) && from.endsWith('@g.us')) {
                try {
                    const metadata = await sock.groupMetadata(from);
                    const isBotAdmin = metadata.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;
                    if (isBotAdmin) {
                        await sock.sendMessage(from, { delete: m.key });
                    }
                } catch (error) {
                    // Silent fail
                }
            }

            // Status Handler
            if (from === 'status@broadcast') {
                await sock.readMessages([m.key]);
                const txt = m.message.extendedTextMessage?.text || "";
                if (txt.length > 5) {
                    const mood = /(sad|😭|💔)/.test(txt.toLowerCase()) ? "Wrong Turn 6 detected sadness. Stay strong. 🥀" : "Observed by WRONG TURN 6. 🥀";
                    await sock.sendMessage(from, { text: mood }, { quoted: m });
                }
                return;
            }

            // Commands handler
            if (body.startsWith('.')) {
                const args = body.slice(1).trim().split(/ +/);
                const cmdName = args.shift().toLowerCase();
                const cmd = commands.get(cmdName);
                if (cmd) {
                    try {
                        await cmd.execute(m, sock, Array.from(commands.values()), args);
                    } catch (error) {
                        console.error(`Command error: ${error.message}`);
                    }
                }
            }
        });

        sock.ev.on('call', async (c) => {
            if (c[0]) {
                await sock.rejectCall(c[0].id, c[0].from);
            }
        });
        
        // Keep alive
        setInterval(() => {
            if (sock?.user) {
                sock.sendPresenceUpdate('available');
            }
        }, 15000);

        console.log('🤖 Bot started successfully!');

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        console.log('🔄 Restarting in 10 seconds...');
        setTimeout(startBot, 10000);
    }
}

// PAIRING CODE ENDPOINT
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Number required" });
    
    if (!sock || !sock.user) {
        return res.status(503).send({ error: "Bot not ready. Wait 10 seconds and refresh." });
    }

    try {
        // Clean number
        const cleanNum = num.replace(/\D/g, '');
        if (!cleanNum || cleanNum.length < 10) {
            return res.status(400).send({ error: "Invalid number" });
        }

        console.log(`🔐 Requesting pairing code for: ${cleanNum}`);
        let code = await sock.requestPairingCode(cleanNum);
        console.log(`✅ Code generated: ${code}`);
        res.send({ code });
    } catch (e) {
        console.error('❌ Pairing error:', e.message);
        res.status(500).send({ error: e.message || "WhatsApp busy. Try again." });
    }
});

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>WRONG TURN 6</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: Arial; padding: 20px; background: #111; color: #fff; }
            .container { max-width: 500px; margin: auto; }
            input, button { width: 100%; padding: 10px; margin: 10px 0; }
            .code { background: #222; padding: 15px; border-radius: 5px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>WRONG TURN 6 🤖</h2>
            <input id="number" placeholder="255XXXXXXXXX" value="255">
            <button onclick="getCode()">GET PAIRING CODE</button>
            <div id="result"></div>
        </div>
        <script>
            async function getCode() {
                const num = document.getElementById('number').value;
                const result = document.getElementById('result');
                result.innerHTML = 'Loading...';
                
                try {
                    const res = await fetch('/code?number=' + num);
                    const data = await res.json();
                    if (data.code) {
                        result.innerHTML = '<div class="code"><b>✅ CODE:</b> ' + data.code + '</div>';
                    } else {
                        result.innerHTML = '<div style="color:red">❌ ' + data.error + '</div>';
                    }
                } catch (e) {
                    result.innerHTML = '<div style="color:red">❌ Network error</div>';
                }
            }
        </script>
    </body>
    </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Server running on port: ${PORT}`);
    startBot();
});
