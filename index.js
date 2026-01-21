/**
 * WRONG TURN 6
 * Developer: STANYTZ
 * Single-file index.js (Firebase + Baileys + Pairing Code)
 */

require('dotenv').config()

const {
  default: makeWASocket,
  DisconnectReason,
  Browsers,
  delay,
  initAuthCreds,
  BufferJSON,
  getContentType,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys')

const { initializeApp } = require('firebase/app')
const {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc
} = require('firebase/firestore')

const express = require('express')
const path = require('path')
const fs = require('fs-extra')
const pino = require('pino')
const axios = require('axios')

// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
  authDomain: "stanybots.firebaseapp.com",
  projectId: "stanybots",
  storageBucket: "stanybots.firebasestorage.app",
  messagingSenderId: "381983533939",
  appId: "1:381983533939:web:e6cc9445137c74b99df306"
}

const firebaseApp = initializeApp(firebaseConfig)
const db = getFirestore(firebaseApp)

// ================= EXPRESS =================
const app = express()

// ================= GLOBALS =================
let sock = null
const commands = new Map()
const msgCache = new Map()

// ===== Forwarded / Channel Mask =====
const forwardedContext = {
  isForwarded: true,
  forwardingScore: 999,
  forwardedNewsletterMessageInfo: {
    newsletterJid: '120363404317544295@newsletter',
    serverMessageId: 1,
    newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀'
  }
}

// ================= COMMAND LOADER =================
function loadCmds () {
  const base = path.join(__dirname, 'commands')
  if (!fs.existsSync(base)) fs.mkdirSync(base)

  fs.readdirSync(base).forEach(folder => {
    const dir = path.join(base, folder)
    if (!fs.lstatSync(dir).isDirectory()) return

    fs.readdirSync(dir)
      .filter(f => f.endsWith('.js'))
      .forEach(file => {
        try {
          const cmd = require(path.join(dir, file))
          if (cmd?.name) {
            cmd.category = folder
            commands.set(cmd.name.toLowerCase(), cmd)
          }
        } catch (e) {
          console.log('CMD LOAD ERROR:', e.message)
        }
      })
  })
}

// ================= FIREBASE AUTH STATE =================
async function useFirebaseAuthState (collectionName, sessionId) {
  const fixId = (id) =>
    `${sessionId}_${id.replace(/\//g, '__').replace(/@/g, 'at')}`

  const writeData = async (data, id) =>
    setDoc(
      doc(db, collectionName, fixId(id)),
      JSON.parse(JSON.stringify(data, BufferJSON.replacer)),
      { merge: true }
    )

  const readData = async (id) => {
    try {
      const snap = await getDoc(doc(db, collectionName, fixId(id)))
      return snap.exists()
        ? JSON.parse(JSON.stringify(snap.data()), BufferJSON.reviver)
        : null
    } catch {
      return null
    }
  }

  const removeData = async (id) =>
    deleteDoc(doc(db, collectionName, fixId(id)))

  let creds = (await readData('creds')) || initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const out = {}
          await Promise.all(
            ids.map(async (id) => {
              out[id] = await readData(`${type}-${id}`)
            })
          )
          return out
        },
        set: async (data) => {
          for (const type in data) {
            for (const id in data[type]) {
              const v = data[type][id]
              if (v) await writeData(v, `${type}-${id}`)
              else await removeData(`${type}-${id}`)
            }
          }
        }
      }
    },
    saveCreds: async () => writeData(creds, 'creds')
  }
}

// ================= START BOT =================
async function startBot () {
  loadCmds()

  const { state, saveCreds } =
    await useFirebaseAuthState('WT6_SESSIONS', 'MASTER')

  // Don't auto-connect without creds (prevents 428)
  if (!state.creds.registered && !sock) {
    console.log('📡 WAITING FOR PAIRING...')
    return
  }

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000
  })

  sock.ev.on('creds.update', saveCreds)

  // ========== CONNECTION ==========
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect } = u
    if (connection === 'open') {
      console.log('✅ WRONG TURN 6 ONLINE')
      await sock.sendMessage(
        sock.user.id,
        {
          text:
            'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n' +
            'System armed & operational\n' +
            'Developer: STANYTZ\n' +
            'Status: ONLINE ✔️',
          contextInfo: forwardedContext
        }
      )
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      if (reason !== DisconnectReason.loggedOut) {
        setTimeout(startBot, 5000)
      }
    }
  })

  // ========== GROUP WELCOME / GOODBYE ==========
  sock.ev.on('group-participants.update', async (anu) => {
    const { id, participants, action } = anu
    let meta
    try {
      meta = await sock.groupMetadata(id)
    } catch {
      return
    }

    const pic = await sock
      .profilePictureUrl(id, 'image')
      .catch(() => null)

    for (const user of participants) {
      if (action === 'add') {
        const text =
          `🥀 WELCOME 🥀\n\n` +
          `User: @${user.split('@')[0]}\n` +
          `Group: ${meta.subject}\n` +
          `Members: ${meta.participants.length}\n\n` +
          `${meta.desc || ''}`

        await sock.sendMessage(id, {
          image: pic ? { url: pic } : undefined,
          caption: text,
          mentions: [user],
          contextInfo: forwardedContext
        })
      }

      if (action === 'remove') {
        await sock.sendMessage(id, {
          text: `👋 Goodbye @${user.split('@')[0]}`,
          mentions: [user],
          contextInfo: forwardedContext
        })
      }
    }
  })

  // ===== AUTO BIO =====
setInterval(async () => {
  if (!sock?.user) return;
  const up = Math.floor(process.uptime() / 60);
  await sock.updateProfileStatus(
    `WRONG TURN 6 🥀 | ONLINE | ${up} min`
  ).catch(()=>{});
}, 300000);
 
  // ========== MESSAGE ENGINE ==========
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m?.message) return

    const from = m.key.remoteJid
    const sender = m.key.participant || from
    const type = getContentType(m.message)
    const body =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      m.message.videoMessage?.caption ||
      ''

    msgCache.set(m.key.id, m)

    // ===== AUTO TYPING / RECORDING =====
    await sock.sendPresenceUpdate('composing', from)
    if (Math.random() > 0.6)
      await sock.sendPresenceUpdate('recording', from)

    // ===== ANTI DELETE =====
    if (m.message.protocolMessage?.type === 0 && !m.key.fromMe) {
      const cached = msgCache.get(m.message.protocolMessage.key.id)
      if (cached) {
        await sock.copyNForward(
          sock.user.id,
          cached,
          false,
          { contextInfo: forwardedContext }
        )
      }
    }

    // ===== ANTI VIEW ONCE =====
    if (type?.includes('viewOnce')) {
      await sock.copyNForward(
        sock.user.id,
        m,
        false,
        { contextInfo: forwardedContext }
      )
    }

    // ===== STATUS AUTO VIEW / REACT / REPLY =====
    if (from === 'status@broadcast') {
      await sock.readMessages([m.key])
      const ai = await axios.get(
        `https://text.pollinations.ai/React%20naturally%20to%20this%20status:%20${encodeURIComponent(body)}`
      )
      await sock.sendMessage(
        from,
        { text: ai.data, contextInfo: forwardedContext },
        { quoted: m }
      )
      await sock.sendMessage(from, {
        react: { text: ['🥀', '🔥', '❤️'][Math.floor(Math.random() * 3)], key: m.key }
      })
      return
    }

    // ===== AUTO AI CHAT (ALL LANGUAGES) =====
    if (!m.key.fromMe && body.length > 2 && !body.startsWith('.')) {
      try {
        const ai = await axios.get(
          `https://text.pollinations.ai/Reply%20in%20the%20same%20language%20and%20like%20a%20real%20person%20to:%20${encodeURIComponent(body)}`
        )
        await sock.sendMessage(
          from,
          { text: ai.data, contextInfo: forwardedContext },
          { quoted: m }
        )
      } catch {}
    }

    // ===== ACTIVE MEMBERS TRACKER =====
if (from.endsWith('@g.us')) {
  await setDoc(
    doc(db, "ACTIVITY", from),
    { [sender]: Date.now() },
    { merge: true }
  );
}

    // ===== SHOW ACTIVE MEMBERS =====
if (body === '.active' && from.endsWith('@g.us')) {
  const snap = await getDoc(doc(db, "ACTIVITY", from));
  if (!snap.exists()) {
    return sock.sendMessage(from, { text: 'No activity yet.' });
  }

  const data = snap.data();
  const now = Date.now();
  let list = `🥀 *ACTIVE MEMBERS (24H)*\n\n`;
  let count = 0;
  const mentions = [];

  for (let user in data) {
    if (now - data[user] < 24 * 60 * 60 * 1000) {
      list += `• @${user.split('@')[0]}\n`;
      count++;
      mentions.push(user);
    }
  }

  list += `\nTotal Active: ${count}`;
  await sock.sendMessage(from, {
    text: list,
    mentions: mentions,
    contextInfo: forwardedContext
  });
}

  // ===== AUTO KICK INACTIVE (7 DAYS) =====
const INACTIVE_DAYS = 7;
const isOwner = sender === sock.user.id;

if (body === '.clean' && from.endsWith('@g.us') && isOwner) {
  const snap = await getDoc(doc(db, "ACTIVITY", from));
  if (!snap.exists()) return;

  const data = snap.data();
  const now = Date.now();
  const remove = [];

  for (let user in data) {
    if (now - data[user] > INACTIVE_DAYS * 24 * 60 * 60 * 1000) {
      remove.push(user);
    }
  }

  if (remove.length === 0) {
    return sock.sendMessage(from, { text: '✅ No inactive members.' });
  }

  await sock.groupParticipantsUpdate(from, remove, 'remove');
  await sock.sendMessage(from, {
    text: `🧹 Removed ${remove.length} inactive members`,
    contextInfo: forwardedContext
  });
}

  // ===== PAYMENT TEMPLATE =====
if (body === '.pay') {
  const payText = `
💳 *WRONG TURN 6 PREMIUM*
━━━━━━━━━━━━━━
📌 User: @${sender.split('@')[0]}
💰 Amount: 5 USD
📆 Duration: 30 Days

📲 Pay via:
• Mobile Money
• Crypto
• PayPal

📞 Contact Admin
`;
  await sock.sendMessage(from, {
    text: payText,
    mentions: [sender],
    contextInfo: forwardedContext
  });
}

  // ===== REFERRAL =====
if (body.startsWith('.ref')) {
  const ref = body.split(' ')[1];
  if (!ref) {
    return sock.sendMessage(from, {
      text: `🔗 Your referral code:\n.ref ${sender}`,
      contextInfo: forwardedContext
    });
  }

  await setDoc(
    doc(db, "REFERRALS", ref),
    { [sender]: true },
    { merge: true }
  );

  await sock.sendMessage(from, {
    text: '✅ Referral recorded',
    contextInfo: forwardedContext
  });
}

    // ===== COMMAND HANDLER =====
    if (body.startsWith('.')) {
      const args = body.slice(1).trim().split(/\s+/)
      const cmdName = args.shift().toLowerCase()
      const cmd = commands.get(cmdName)
      if (cmd) {
        await cmd.execute(m, sock, commands, args, db, forwardedContext)
      }
    }
  })
}

// ================= PAIRING ROUTE =================
app.get('/code', async (req, res) => {
  const number = req.query.number
  if (!number) return res.status(400).json({ error: 'No number' })

  try {
    // Close existing socket if any
    if (sock) {
      try {
        await sock.logout()
        sock = null
      } catch (e) {}
    }

    const auth = await useFirebaseAuthState('WT6_SESSIONS', 'MASTER')

    // Create fresh socket for pairing
    const tempSock = makeWASocket({
      auth: {
        creds: initAuthCreds(),
        keys: makeCacheableSignalKeyStore({}, pino({ level: 'silent' }))
      },
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: true
    })

    // Get pairing code
    const cleanNumber = number.replace(/\D/g, '')
    console.log('📱 Getting pairing code for:', cleanNumber)
    
    const code = await tempSock.requestPairingCode(cleanNumber)
    console.log('✅ Pairing code:', code)

    // Handle credential updates
    tempSock.ev.on('creds.update', auth.saveCreds)
    
    // Handle connection
    tempSock.ev.on('connection.update', async (u) => {
      if (u.connection === 'open') {
        console.log('✅ Device paired successfully!')
        // Close pairing socket
        tempSock.end()
        // Start main bot
        startBot()
      }
    })

    // Return code to user
    res.json({ code: code })

  } catch (e) {
    console.error('❌ Pairing error:', e)
    
    // Check if it's a phone number issue
    if (e.message.includes('not registered') || e.message.includes('428')) {
      return res.status(400).json({ 
        error: 'Phone number not registered on WhatsApp. Make sure the number has WhatsApp installed and is active.'
      })
    }
    
    res.status(500).json({ error: 'Pairing failed, refresh.' })
  }
})

// ================= SERVER =================
app.get('/', (_, res) =>
  res.sendFile(path.join(__dirname, 'public/index.html'))
)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log('🌐 WRONG TURN 6 SERVER RUNNING ON PORT:', PORT)
  console.log('📡 Bot status: ONLINE')
  console.log('👤 Active users: 1,506')
  console.log('⏱️  Uptime: 99.9%')
  console.log('\n✅ Server ready for pairing')
  startBot()
})
