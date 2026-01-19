require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    delay, 
    fetchLatestBaileysVersion, 
    initAuthCreds,
    BufferJSON,
    makeCacheableSignalKeyStore,
    getContentType,
    generateForwardMessageContent,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, updateDoc, collection } = require('firebase/firestore');
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
const db = getFirestore(firebaseApp);

const app = express();
const commands = new Map();
const msgCache = new Map(); 
let sock = null;

// PREMIUM FORWARDING CONTEXT (Newsletter ID Masking)
const forwardedContext = {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363404317544295@newsletter',
        serverMessageId: 1,
        newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
    }
};

// 2. ENHANCED HUMAN-LIKE MOOD ENGINE WITH AI RESPONSES (ENGLISH)
const getMoodResponse = async (text) => {
    try {
        // Try AI response first for more natural replies
        const aiPrompt = `You are WRONG TURN 6 AI by STANYTZ. You just saw a WhatsApp status update. Generate a short, human-like, friendly response (1-2 sentences max) that sounds natural and empathetic. Status text: "${text}"`;
        const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`, { timeout: 5000 });
        
        if (aiRes.data && aiRes.data.trim().length > 10) {
            const aiText = aiRes.data.trim();
            // Add emoji based on sentiment
            const isHappy = /(happy|good|great|awesome|amazing|congrat|win|success)/i.test(text);
            const isSad = /(sad|bad|hard|tough|difficult|struggle|pain|hurt)/i.test(text);
            const emoji = isHappy ? '🥂' : isSad ? '🥀' : '✨';
            
            return `${emoji} ${aiText}`;
        }
    } catch (e) {
        console.log('AI mood response failed, using fallback');
    }
    
    // Fallback to enhanced English responses
    const t = text.toLowerCase();
    
    // Sad/Difficult status
    if (/(sad|upset|crying|tears|pain|hurt|lonely|depress|down|hard time|struggle|missing you)/.test(t)) {
        const sadResponses = [
            "I see you're going through something. Remember, even the darkest nights end with sunrise 🌅",
            "Sending you strength today. Whatever you're facing, you're stronger than you think 💪",
            "I noticed your status. Just a reminder: you matter, and this too shall pass ❤️",
            "Sometimes the hardest battles give us the greatest strength. Keep going warrior 🛡️",
            "Your feelings are valid. Take all the time you need, but don't give up on yourself 🌱"
        ];
        return sadResponses[Math.floor(Math.random() * sadResponses.length)];
    }
    
    // Happy/Excited status
    if (/(happy|excited|celebrat|winner|success|achievement|proud|blessed|grateful|thankful|joy|smile)/.test(t)) {
        const happyResponses = [
            "So happy to see you winning! This energy is everything! 🎉",
            "Celebrating with you from here! Keep shining bright ✨",
            "Your happiness is contagious! Thanks for sharing the good vibes 😊",
            "Winning looks good on you! Keep up the amazing work 🏆",
            "This is the energy we need more of! So proud of your progress! 🚀"
        ];
        return happyResponses[Math.floor(Math.random() * happyResponses.length)];
    }
    
    // Love/Romance status
    if (/(love|heart|romance|crush|relationship|together|soulmate|💘|❤️|😍)/.test(t)) {
        const loveResponses = [
            "Love is in the air! So happy for you two! 💕",
            "This is beautiful. Wishing you nothing but happiness together! 💘",
            "Seeing your love story unfold is inspiring! Keep nurturing that connection 🌹",
            "Love looks good on you! Cherish these special moments 💑",
            "This kind of love is rare and precious. Hold onto it tightly! ❤️"
        ];
        return loveResponses[Math.floor(Math.random() * loveResponses.length)];
    }
    
    // Money/Business/Hustle status
    if (/(money|cash|business|hustle|grind|work|entrepreneur|invest|financial|💸|💰|💵)/.test(t)) {
        const moneyResponses = [
            "The hustle never stops! Keep stacking those wins! 💰",
            "Financial freedom loading... I see you putting in the work! 📈",
            "Money moves only! Your dedication is inspiring 🔥",
            "The bag is secured! Keep making those smart moves 🏦",
            "From one hustler to another - keep going! The results are coming 🚀"
        ];
        return moneyResponses[Math.floor(Math.random() * moneyResponses.length)];
    }
    
    // Travel/Adventure status
    if (/(travel|trip|vacation|holiday|adventure|explore|beach|mountains|flight|✈️|🌴|🗺️)/.test(t)) {
        const travelResponses = [
            "Living your best life! Safe travels and amazing adventures! ✈️",
            "New places, new memories! Enjoy every moment of your journey 🌍",
            "Wanderlust achieved! So jealous of those views! 🏞️",
            "Traveling feeds the soul. Hope you're having an incredible time! 🧳",
            "Adventure is out there! Make unforgettable memories 🌟"
        ];
        return travelResponses[Math.floor(Math.random() * travelResponses.length)];
    }
    
    // Work/Career/Study status
    if (/(work|job|career|study|exam|project|deadline|promotion|office|📚|💼|🎓)/.test(t)) {
        const workResponses = [
            "Hard work pays off! You've got this! 💪",
            "Success is on the way! Keep pushing forward 📈",
            "Professional growth in progress! So proud of your dedication 🎯",
            "Knowledge is power! Keep learning and growing 🧠",
            "The grind looks good on you! Future you will thank present you 🔥"
        ];
        return workResponses[Math.floor(Math.random() * workResponses.length)];
    }
    
    // Health/Fitness status
    if (/(gym|workout|fitness|healthy|exercise|run|yoga|meditation|🏋️|🧘|💪)/.test(t)) {
        const fitnessResponses = [
            "Health is wealth! Keep taking care of your temple 🏋️‍♂️",
            "Those gains don't come easy! Respect the discipline 💪",
            "Mind and body connection is everything! Keep grinding 🧘‍♀️",
            "Fitness journey looking strong! Consistency is key 🔑",
            "Self-care is not selfish. Proud of your commitment! 🌿"
        ];
        return fitnessResponses[Math.floor(Math.random() * fitnessResponses.length)];
    }
    
    // Music/Entertainment status
    if (/(music|song|concert|festival|party|dance|movie|🎵|🎶|🎬|🎤)/.test(t)) {
        const musicResponses = [
            "Music is life! What are you listening to? 🎧",
            "Good vibes only! That track is fire 🔥",
            "Festival mode activated! Have the best time! 🎉",
            "Music heals the soul. Keep those good vibrations going 🎶",
            "Party responsibly! But make sure to have fun! 💃"
        ];
        return musicResponses[Math.floor(Math.random() * musicResponses.length)];
    }
    
    // Food/Cooking status
    if (/(food|eat|cooking|recipe|restaurant|chef|🍕|🍔|🍜|🍣)/.test(t)) {
        const foodResponses = [
            "Food is life! That looks absolutely delicious! 🍴",
            "Chef mode activated! Hope it tastes as good as it looks 👨‍🍳",
            "Good food, good mood! Enjoy every bite 😋",
            "Sharing is caring... wish I could taste that through the screen! 🍲",
            "Culinary adventures are the best adventures! Bon appétit! 🍽️"
        ];
        return foodResponses[Math.floor(Math.random() * foodResponses.length)];
    }
    
    // Default responses for anything else
    const defaultResponses = [
        "Thanks for sharing! Hope you're having a great day 😊",
        "Sending positive vibes your way! ✨",
        "Always good to see what you're up to! Stay blessed 🙏",
        "Keeping you in my thoughts today! You're awesome 🌟",
        "Appreciate you sharing your journey with us! 🥀",
        "Life is a beautiful adventure. Thanks for letting us be part of yours 🌈",
        "Every status update is a glimpse into your world. Thanks for sharing 🌍",
        "Digital connection, real emotions. Love seeing your updates 📱❤️"
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
};

// 3. COMMAND LOADER
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

// 4. MAIN ENGINE START
async function startBot() {
    loadCmds();
    const { useFirebaseAuthState } = require('./lib/firestoreAuth');
    const { state, saveCreds } = await useFirebaseAuthState(db, "WT6_SESSIONS", "MASTER");

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Safari"),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
    });

    sock.ev.on('creds.update', saveCreds);

    // CONNECTION & ONE-TIME WELCOME
    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("✅ WRONG TURN BOT: ARMED");
            await sock.sendMessage(sock.user.id, { 
                text: "ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\nᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ\nꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ",
                contextInfo: forwardedContext
            });
        }
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        }
    });

    // GROUP UPDATES (WELCOME/GOODBYE)
    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu;
        const setSnap = await getDoc(doc(db, "SETTINGS", id));
        const s = setSnap.exists() ? setSnap.data() : { welcome: true };

        for (let num of participants) {
            if (action === 'add' && s.welcome) {
                const groupLogo = await sock.profilePictureUrl(id, 'image').catch(() => 'https://files.catbox.moe/59ays3.jpg');
                const welcome = `ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ ᴍᴀɪɴꜰʀᴀᴍᴇ 🥀\n\nᴜꜱᴇʀ: @${num.split('@')[0]}\n"ᴋɴᴏᴡʟᴇᴅɢᴇ ɪꜱ ᴛʜᴇ ᴏɴʟʏ ᴡᴀʏ ᴏᴜᴛ."\n\nᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ`;
                await sock.sendMessage(id, { image: { url: groupLogo }, caption: welcome, mentions: [num], contextInfo: forwardedContext });
            }
        }
    });

    // MESSAGE PROCESSING
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
        const type = getContentType(m.message);

        msgCache.set(m.key.id, m);

        // FETCH SETTINGS
        const setSnap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const s = setSnap.exists() ? setSnap.data() : { autoType: true, autoRecord: true, autoAI: true, antiDelete: true, antiViewOnce: true, forceJoin: true, autoStatus: true };

        const ownerId = sock.user.id.split(':')[0];
        const isOwner = sender.startsWith(ownerId) || m.key.fromMe;

        // A. AUTO PRESENCE
        if (s.autoType) await sock.sendPresenceUpdate('composing', from);
        if (s.autoRecord && Math.random() > 0.5) await sock.sendPresenceUpdate('recording', from);

        // B. FORCE JOIN CHECK (Normalized ID)
        if (body.startsWith('.') && !isOwner && s.forceJoin) {
            const groupJid = '120363406549688641@g.us';
            try {
                const groupMetadata = await sock.groupMetadata(groupJid);
                if (!groupMetadata.participants.find(p => p.id === (sender.split(':')[0] + '@s.whatsapp.net'))) {
                    return sock.sendMessage(from, { text: "❌ *ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ*\nᴊᴏɪɴ ᴏᴜʀ ɢʀᴏᴜᴘ ᴛᴏ ᴜꜱᴇ ʙᴏᴛ:\nhttps://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y", contextInfo: forwardedContext });
                }
            } catch (e) {}
        }

        // C. ANTI-DELETE & ANTI-VIEWONCE (Auto-DM Forward)
        if (m.message.protocolMessage?.type === 0 && s.antiDelete) {
            const cached = msgCache.get(m.message.protocolMessage.key.id);
            if (cached) {
                await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ* @${sender.split('@')[0]}`, mentions: [sender] });
                await sock.copyNForward(sock.user.id, cached, false, { contextInfo: forwardedContext });
            }
        }
        if ((type === 'viewOnceMessage' || type === 'viewOnceMessageV2') && s.antiViewOnce) {
            await sock.sendMessage(sock.user.id, { text: `🛡️ *ᴀɴᴛɪ-ᴠɪᴇᴡᴏɴᴄᴇ* @${sender.split('@')[0]}`, mentions: [sender] });
            await sock.copyNForward(sock.user.id, m, false, { contextInfo: forwardedContext });
        }

        // D. ANTI-LINK / PORN / SCAM
        if (from.endsWith('@g.us') && !isOwner) {
            const isPorn = /(porn|xxx|nude|sex|vixen|ngono)/gi.test(body);
            const isScam = /(bundle|fixed match|earn money|invest|free data)/gi.test(body);
            if (isPorn || isScam || body.includes('http')) {
                await sock.sendMessage(from, { delete: m.key });
            }
        }

        // E. ENHANCED AUTO STATUS ENGINE WITH AI RESPONSES
        if (from === 'status@broadcast' && s.autoStatus) {
            await sock.readMessages([m.key]);
            try {
                const mood = await getMoodResponse(body);
                await sock.sendMessage(from, { text: mood }, { quoted: m });
                await sock.sendMessage(from, { react: { text: '🥀', key: m.key } }, { statusJidList: [sender] });
            } catch (error) {
                console.log('Error in status reply:', error);
            }
        }

        // F. UNIVERSAL AUTO AI CHAT (Global natural response in all languages)
        if (!body.startsWith('.') && !m.key.fromMe && s.autoAI && body.length > 2 && !from.endsWith('@g.us')) {
            try {
                const aiPrompt = `You are WRONG TURN 6 AI by STANYTZ. Respond naturally and helpfully to the following in its original language: ${body}`;
                const aiRes = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(aiPrompt)}`);
                await sock.sendMessage(from, { text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n${aiRes.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) {}
        }

        // G. COMMAND HANDLER
        const prefix = s.prefix || ".";
        if (body.startsWith(prefix)) {
            const args = body.slice(prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) await cmd.execute(m, sock, Array.from(commands.values()), args, db, forwardedContext);
        }
    });

    sock.ev.on('call', async (c) => sock.rejectCall(c[0].id, c[0].from));
    setInterval(() => { if (sock?.user) sock.sendPresenceUpdate('available'); }, 15000);
}

// 5. STABLE PAIRING API
app.get('/code', async (req, res) => {
    let num = req.query.number;
    const pSock = makeWASocket({ auth: { creds: initAuthCreds(), keys: makeCacheableSignalKeyStore({}, pino({level:'silent'})) }, logger: pino({level:'silent'}), browser: Browsers.macOS("Safari") });
    await delay(3000);
    let code = await pSock.requestPairingCode(num.replace(/\D/g, ''));
    res.send({ code });
    pSock.ev.on('creds.update', async (creds) => { await setDoc(doc(db, "WT6_SESSIONS", "MASTER_creds"), JSON.parse(JSON.stringify(creds, BufferJSON.replacer))); });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(process.env.PORT || 3000, startBot);
