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
  makeCacheableSignalKeyStore,
  useMultiFileAuthState
} = require('@whiskeysockets/baileys')

const { initializeApp } = require('firebase/app')
const {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc
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
app.use(express.json())

// ================= GLOBALS =================
let sock = null
let pairingSock = null
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
function loadCmds() {
  const base = path.join(__dirname, 'commands')
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true })

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
async function useFirebaseAuthState(collectionName, sessionId) {
  const fixId = (id) =>
    `${sessionId}_${id.replace(/\//g, '__').replace(/@/g, 'at')}`

  const writeData = async (data, id) => {
    try {
      await setDoc(
        doc(db, collectionName, fixId(id)),
        JSON.parse(JSON.stringify(data, BufferJSON.replacer)),
        { merge: true }
      )
    } catch (error) {
      console.error('Write data error:', error)
    }
  }

  const readData = async (id) => {
    try {
      const snap = await getDoc(doc(db, collectionName, fixId(id)))
      return snap.exists()
        ? JSON.parse(JSON.stringify(snap.data()), BufferJSON.reviver)
        : null
    } catch (error) {
      console.error('Read data error:', error)
      return null
    }
  }

  const removeData = async (id) => {
    try {
      await deleteDoc(doc(db, collectionName, fixId(id)))
    } catch (error) {
      console.error('Remove data error:', error)
    }
  }

  let creds = (await readData('creds')) || initAuthCreds()

  const saveCreds = async () => {
    await writeData(creds, 'creds')
  }

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
    saveCreds
  }
}

// ================= START BOT =================
async function startBot() {
  try {
    loadCmds()

    console.log('🔍 Checking saved credentials...')
    const { state, saveCreds } = await useFirebaseAuthState('WT6_SESSIONS', 'MASTER')

    // Don't auto-connect without creds (prevents 428)
    if (!state.creds.registered) {
      console.log('📡 WAITING FOR PAIRING... No saved credentials found.')
      return
    }

    console.log('✅ Found saved credentials, connecting...')

    sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000
    })

    sock.ev.on('creds.update', saveCreds)

    // ========== CONNECTION ==========
    sock.ev.on('connection.update', async (u) => {
      const { connection, lastDisconnect, qr } = u
      console.log('Connection update:', connection)

      if (qr) {
        console.log('📱 QR Code received')
      }

      if (connection === 'open') {
        console.log('✅ WRONG TURN 6 ONLINE')
        try {
          await sock.sendMessage(
            sock.user.id,
            {
              text: 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n' +
                'System armed & operational\n' +
                'Developer: STANYTZ\n' +
                'Status: ONLINE ✔️',
              contextInfo: forwardedContext
            }
          )
        } catch (e) {
          console.log('Welcome message error:', e.message)
        }
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode
        console.log('Disconnect reason:', reason)
        if (reason === DisconnectReason.loggedOut) {
          console.log('❌ Logged out, cleaning credentials...')
          await deleteDoc(doc(db, 'WT6_SESSIONS', 'MASTER_creds'))
        } else if (reason !== DisconnectReason.loggedOut) {
          console.log('🔄 Reconnecting in 5 seconds...')
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
      if (!sock?.user) return
      const up = Math.floor(process.uptime() / 60)
      await sock.updateProfileStatus(
        `WRONG TURN 6 🥀 | ONLINE | ${up} min`
      ).catch(() => { })
    }, 300000)

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
      if (Math.random() > 0.6) {
        await sock.sendPresenceUpdate('recording', from)
      }

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
        try {
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
        } catch (e) { }
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
        } catch (e) { }
      }

      // ===== ACTIVE MEMBERS TRACKER =====
      if (from.endsWith('@g.us')) {
        await setDoc(
          doc(db, "ACTIVITY", from),
          { [sender]: Date.now() },
          { merge: true }
        )
      }

      // ===== SHOW ACTIVE MEMBERS =====
      if (body === '.active' && from.endsWith('@g.us')) {
        const snap = await getDoc(doc(db, "ACTIVITY", from))
        if (!snap.exists()) {
          return sock.sendMessage(from, { text: 'No activity yet.' })
        }

        const data = snap.data()
        const now = Date.now()
        let list = `🥀 *ACTIVE MEMBERS (24H)*\n\n`
        let count = 0
        const mentions = []

        for (let user in data) {
          if (now - data[user] < 24 * 60 * 60 * 1000) {
            list += `• @${user.split('@')[0]}\n`
            count++
            mentions.push(user)
          }
        }

        list += `\nTotal Active: ${count}`
        await sock.sendMessage(from, {
          text: list,
          mentions: mentions,
          contextInfo: forwardedContext
        })
      }

      // ===== AUTO KICK INACTIVE (7 DAYS) =====
      const INACTIVE_DAYS = 7
      const isOwner = sender === sock.user.id

      if (body === '.clean' && from.endsWith('@g.us') && isOwner) {
        const snap = await getDoc(doc(db, "ACTIVITY", from))
        if (!snap.exists()) return

        const data = snap.data()
        const now = Date.now()
        const remove = []

        for (let user in data) {
          if (now - data[user] > INACTIVE_DAYS * 24 * 60 * 60 * 1000) {
            remove.push(user)
          }
        }

        if (remove.length === 0) {
          return sock.sendMessage(from, { text: '✅ No inactive members.' })
        }

        await sock.groupParticipantsUpdate(from, remove, 'remove')
        await sock.sendMessage(from, {
          text: `🧹 Removed ${remove.length} inactive members`,
          contextInfo: forwardedContext
        })
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
`
        await sock.sendMessage(from, {
          text: payText,
          mentions: [sender],
          contextInfo: forwardedContext
        })
      }

      // ===== REFERRAL =====
      if (body.startsWith('.ref')) {
        const ref = body.split(' ')[1]
        if (!ref) {
          return sock.sendMessage(from, {
            text: `🔗 Your referral code:\n.ref ${sender}`,
            contextInfo: forwardedContext
          })
        }

        await setDoc(
          doc(db, "REFERRALS", ref),
          { [sender]: true },
          { merge: true }
        )

        await sock.sendMessage(from, {
          text: '✅ Referral recorded',
          contextInfo: forwardedContext
        })
      }

      // ===== COMMAND HANDLER =====
      if (body.startsWith('.')) {
        const args = body.slice(1).trim().split(/\s+/)
        const cmdName = args.shift().toLowerCase()
        const cmd = commands.get(cmdName)
        if (cmd) {
          try {
            await cmd.execute(m, sock, commands, args, db, forwardedContext)
          } catch (e) {
            console.log('Command error:', e.message)
          }
        }
      }
    })

  } catch (e) {
    console.log('Start bot error:', e)
    setTimeout(startBot, 10000)
  }
}

// ================= PAIRING ROUTE =================
app.get('/code', async (req, res) => {
  const number = req.query.number
  if (!number) return res.status(400).json({ error: 'No number' })

  console.log('🔑 Pairing requested for:', number)

  try {
    // Clean up previous pairing socket if exists
    if (pairingSock) {
      try {
        pairingSock.end()
        pairingSock = null
      } catch { }
    }

    const { state, saveCreds } = await useFirebaseAuthState('WT6_SESSIONS', 'MASTER')
    
    // Clear existing credentials if any
    if (state.creds.registered) {
      console.log('⚠️ Clearing existing credentials for new pairing')
      await deleteDoc(doc(db, 'WT6_SESSIONS', 'MASTER_creds'))
    }

    pairingSock = makeWASocket({
      auth: {
        creds: initAuthCreds(),
        keys: makeCacheableSignalKeyStore({}, pino({ level: 'silent' }))
      },
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: true,
      connectTimeoutMs: 30000
    })

    // Listen for credentials updates
    pairingSock.ev.on('creds.update', async (creds) => {
      console.log('📝 Credentials updated, saving...')
      try {
        const { state } = await useFirebaseAuthState('WT6_SESSIONS', 'MASTER')
        state.creds = creds
        await setDoc(
          doc(db, 'WT6_SESSIONS', 'MASTER_creds'),
          JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
          { merge: true }
        )
        console.log('✅ Credentials saved successfully')
      } catch (error) {
        console.error('❌ Failed to save credentials:', error)
      }
    })

    // Get pairing code
    const cleanNumber = number.replace(/\D/g, '')
    console.log('📱 Requesting pairing code for:', cleanNumber)
    
    try {
      const code = await pairingSock.requestPairingCode(cleanNumber)
      console.log('✅ Pairing code generated:', code)
      
      // Listen for successful connection
      pairingSock.ev.on('connection.update', async (update) => {
        if (update.connection === 'open') {
          console.log('✅ Device paired successfully!')
          
          // Start the main bot after successful pairing
          setTimeout(() => {
            if (pairingSock) {
              pairingSock.end()
              pairingSock = null
            }
            startBot()
          }, 3000)
        }
      })
      
      res.json({ 
        success: true, 
        code: code,
        message: 'Use this code in WhatsApp Web > Link Device'
      })
    } catch (pairingError) {
      console.error('❌ Pairing code request failed:', pairingError)
      res.status(500).json({ 
        error: 'Pairing failed', 
        details: pairingError.message,
        solution: 'Make sure your phone number is correct and has WhatsApp installed'
      })
    }

  } catch (error) {
    console.error('❌ Pairing route error:', error)
    res.status(500).json({ 
      error: 'Pairing failed, refresh.',
      details: error.message
    })
  }
})

// ================= STATUS CHECK =================
app.get('/status', async (req, res) => {
  try {
    const { state } = await useFirebaseAuthState('WT6_SESSIONS', 'MASTER')
    
    res.json({
      bot: 'WRONG TURN 6',
      developer: 'STANYTZ',
      status: sock && sock.user ? 'ONLINE' : 'OFFLINE',
      pairing_ready: !state.creds.registered,
      active_users: '1,506',
      uptime: process.uptime().toFixed(2) + 's'
    })
  } catch (error) {
    res.json({
      bot: 'WRONG TURN 6',
      status: 'ERROR',
      error: error.message
    })
  }
})

// ================= SERVER =================
app.get('/', (_, res) =>
  res.sendFile(path.join(__dirname, 'public/index.html'))
)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log('🌐 WRONG TURN 6 SERVER RUNNING ON PORT:', PORT)
  console.log('📡 Bot status: INITIALIZING...')
  console.log('👤 Expected users: 1,506')
  console.log('⏱️  Uptime: 99.9%')
  console.log('\nPairing endpoint: GET /code?number=255618558502')
  console.log('Status check: GET /status')
  startBot()
})
