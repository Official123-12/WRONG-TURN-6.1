const { default: makeWASocket, DisconnectReason, Browsers, delay } = require('@whiskeysockets/baileys');
const admin = require("firebase-admin");
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');

/** 
 * WRONG TURN 6 - FIXED FIREBASE BASE64 
 * BY STANYTZ
 */

// Hii hapa ni private_key yako ikiwa imefungwa kwenye Base64 kuzuia DER/ASN.1 Error
const base64Key = "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2UUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktjd2dnU2pBZ0VBQW9JQkFRRGNweTZTOGEwZkpiUlQKN21jREJlSmdoMVE0aTBNMjk2U2lJL2ZxNllrUDVhZE9oOXpRZDcwS201dEx0dHQ5SWFqSEoxTmRTalpMU25HVAozTlNUc3ZVeEIyUG9XUFNa0XFzTDBBeURMbW9KeDNQRUdlbDVFQnBQcEQzTldmdTlrYVRkRjlPTUt1dTJXWlVqCnhXNFM5SFgwTTlLQXVTQ2RURlJWQ1dGZ3pFcWYyZSs3T2JoajhiRklVYlVJQ2pxTFNoOVN0S3R4ZEd4Sjl3cTAKNEJ0dGZlbU0yL0doc2VDdVJmdTcvMGJtaVlqYnFBd0dURXV3M3V1S1c2K3I2c1FWNiswNjhFM3lqQUlnWWozQgo4MnY3Wnd0OFh5dEpmR2E2Q1YrS2oxZXNHeXRRUEpKNCt4NWZwd1cwYjBtTXE2eTZUcDc3K3dpcVhuUXdsZTV6Qgo2ckk1Q3p4bkFnTUJBQUVDZ2dFQUZJZ3B0OGdQS2JYRWhaRjhWbExMOUNDOElsWTY2cjJENzBOdkhtQ3BBQWZrCkFRdnIrQjJKZXRneGlyaWdzZmZPRThCQm9XbVk1QUxMdmRPbWxve jBqTFVwTWNvN2NZV2c0MDBVV1ZxQzFMTkkKcTZYWDZBL2EvcE1TT3pYeU5kS1ZYTjA3ekw2RlBCVXY1OEhXQkZnRUg1WkQyeUVwSmtYMTFDc3drUGwyUW9zUgovenFlUll1WWpXUmljYS96dGFpek5rK05DNGN5N2gwdXFpTHpBMEJZSm4vWlRrT3lwVGtZdlV hZm9RRUt4dHNwCnaVckVStkNHAvMndMWUY5U25XdjIxOFk5YjVmczZKRVN6YVVRYm5hek56d2NOYVNGRlltaVkyZFRtNXBsZU9VClBmRmNZbThlUXVWVnhjTjRLT1JXYzdCbVV4YXhCR0hXKzFtQlN5WDNRUUtCZ1FEODRLUklNT0RoVDVzUDNiZWwKREZP dktPZzNpNlBoVU1pZ2tYclhKSlVzSFBpYmQ2M3BuVkVlWHI4NTBmVnVScFZFUlhkakJsQythTW9BOTBUegp6YVNMSUxQWTVXSW5pZVBMSDZicm41VDN3QzlpWVUwd08zWmt3SnFXMWpaNDdDZmpueHJtdjcwVHB1UFAva0tjCk1uTUR5eE1wYjR6Q0h6R zZZUkVWSVhZZVJRS0JnUURmYUsxWHR1VmdheE1mK2tqVjJqcC9VM3Q1NHVvYlBIM0QKNjVwRHJuc2xMWmZlNmVOSit3b0hseEtnVGdGcUpOTWpMR2ZmMVR1MWU3dDk5Q2JpZVJmRXBsbUN5TnR0ekhkbQpLWHlDenIrRytsbGdrTnB2ZklaSFM2WkVrc2F5NDFvVGNOTzBKSlNwVENDeHMyb3NPU0lDTTZ5aGk5cW5ZdnJlCkUvN1FPdmlndXdLQmdRRGJKMkNZdyt1UXVLbmM1VDBMeUJRRDJCRHdXbyt rYkpTRE83Rm5GTnBwTWE1dkpoaE4KdHk0ZkVPUE9HMTh3RnRQRnRud0FENTRZZHI1aWVlbURGWHg5cXRuU3AzRWFiUkZDNzJweDA0R0pUK1hsaFlNCkwreGFRdVYyeGEwdHZSUTBRZWxSZzJnOHlNejBiQm1VUHRSWXYvMGFVdmQ5SVFXNnpmYTlCbVBVdFFLQmdDNDIKRylaOWhCMlZsQ0pRTXREMmtENWttQzdoZVFYeElBM1A1QnJUY1I4enY2ZnVHR2I4VU8rQTZB d1RveTJ6OQpaTWZqbnlTZVlsMWVReVViRkJXMHJGUG9KYTBEMmJnZTRRbFdxRHpPVWVzdUdKQUNxOTU1TVA2Q3R1U1BNRFZSCmFWaFBWTVFCNGNtaGFsZVh3amRlWlZQT1NuL1NkNis1TnovdzB6cjlBb0dBTzdqN2hjOVNSYWNvVFVVMk1KT1QKNit5OHExaEZVdU9iK3RiM0x3SHprdVE1a3lIeU5zUFRQSGJiOTRqQW9uN09jZmw4Ykw2SUx0TkRNQmlLVlhmCmtnM0IwbFBrUlNXL2NEQVVB RU5hc0NIM09yUXJsWVZjZVlubXUvWWMySzNuT3ZvSlMyQkxpR2EvY0pqQ1BIRTIKTVZoSytZYmI3T3BNRHQyZnlXSWt5RVk9Ci0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0=";

const serviceAccount = {
    projectId: "stanybots",
    clientEmail: "firebase-adminsdk-fbsvc@stanybots.iam.gserviceaccount.com",
    privateKey: Buffer.from(base64Key, 'base64').toString('ascii')
};

// INITIALIZE FIREBASE
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
const commands = new Map();
const sockCache = new Map();

// COMMAND LOADER
const loadCmds = () => {
    const cmdPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    fs.readdirSync(cmdPath).forEach(folder => {
        const folderPath = path.join(cmdPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            fs.readdirSync(folderPath).forEach(file => {
                if (file.endsWith('.js')) {
                    const cmd = require(path.join(folderPath, file));
                    cmd.category = folder;
                    commands.set(cmd.name, cmd);
                }
            });
        }
    });
};

const app = express();
app.use(express.static('public'));

async function startBot() {
    loadCmds();
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    // Tumia collection "WT6_SESSIONS"
    const { state, saveCreds } = await useFirebaseAuthState(db.collection("WT6_SESSIONS"));
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        printQRInTerminal: false
    });

    sockCache.set("sock", sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log("✅ WRONG TURN 6 ONLINE");
        if (u.connection === 'close') startBot();
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || "";

        if (from === 'status@broadcast') return sock.readMessages([m.key]);
        if (body.match(/chat.whatsapp.com/gi)) return sock.sendMessage(from, { delete: m.key });

        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args);
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
    setInterval(() => sock.sendPresenceUpdate('available'), 20000);
}

// PAIRING CODE ROUTE
app.get('/code', async (req, res) => {
    let s = sockCache.get("sock");
    if (!s || !req.query.number) return res.status(400).send({ error: "System Not Ready" });
    try {
        let code = await s.requestPairingCode(req.query.number.replace(/\D/g, ''));
        res.send({ code });
    } catch (e) { res.status(500).send({ error: e.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 WRONG TURN 6: Running on Port ${PORT}`);
    startBot();
});
