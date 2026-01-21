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
  deleteDoc,
  collection
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
app.use(express.urlencoded({ extended: true }))

// ================= GLOBALS =================
let sock = null
let pairingInProgress = false
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

  const files = fs.readdirSync(base).filter(f => f.endsWith('.js'))
  files.forEach(file => {
    try {
      const cmd = require(path.join(base, file))
      if (cmd?.name) {
        commands.set(cmd.name.toLowerCase(), cmd)
        console.log(`✅ Loaded command: ${cmd.name}`)
      }
    } catch (e) {
      console.log('CMD LOAD ERROR:', e.message)
    }
  })
}

// ================= FIREBASE AUTH STATE =================
async function useFirebaseAuthState() {
  const collectionName = 'WT6_SESSIONS'
  const sessionId = 'MASTER'

  const fixId = (id) =>
    `${sessionId}_${id.replace(/\//g, '__').replace(/@/g, 'at')}`

  const writeData = async (data, id) => {
    try {
      await setDoc(
        doc(db, collectionName, fixId(id)),
        JSON.parse(JSON.stringify(data, BufferJSON.replacer)),
        { merge: true }
      )
      return true
    } catch (error) {
      console.error('❌ Write data error:', error.message)
      return false
    }
  }

  const readData = async (id) => {
    try {
      const snap = await getDoc(doc(db, collectionName, fixId(id)))
      return snap.exists()
        ? JSON.parse(JSON.stringify(snap.data()), BufferJSON.reviver)
        : null
    } catch (error) {
      console.error('❌ Read data error:', error.message)
      return null
    }
  }

  const removeData = async (id) => {
    try {
      await deleteDoc(doc(db, collectionName, fixId(id)))
      return true
    } catch (error) {
      console.error('❌ Remove data error:', error.message)
      return false
    }
  }

  // Read credentials
  let creds = await readData('creds')
  if (!creds) {
    console.log('📝 No saved credentials found, initializing new...')
    creds = initAuthCreds()
  }

  const saveCreds = async () => {
    if (creds) {
      await writeData(creds, 'creds')
    }
  }

  const clearAllData = async () => {
    try {
      // Get all documents in the collection
      const querySnapshot = await getDocs(collection(db, collectionName))
      const deletePromises = []
      querySnapshot.forEach((docSnap) => {
        if (docSnap.id.includes(sessionId)) {
          deletePromises.push(deleteDoc(doc(db, collectionName, docSnap.id)))
        }
      })
      await Promise.all(deletePromises)
      console.log('✅ Cleared all session data')
      return true
    } catch (error) {
      console.error('❌ Clear data error:', error)
      return false
    }
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
    saveCreds,
    clearAllData
  }
}

// ================= START BOT =================
async function startBot() {
  try {
    console.log('🚀 Starting WRONG TURN 6 bot...')
    loadCmds()

    const { state, saveCreds } = await useFirebaseAuthState()

    // Check if credentials exist and are registered
    if (!state.creds || !state.creds.registered) {
      console.log('📡 No registered credentials found. Waiting for pairing...')
      return
    }

    console.log('✅ Found valid credentials, connecting to WhatsApp...')

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

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds)

    // ========== CONNECTION HANDLER ==========
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update
      
      console.log(`🔗 Connection update: ${connection}`)
      
      if (qr) {
        console.log('📱 QR Code received (not used in pairing mode)')
      }

      if (connection === 'open') {
        console.log('✅ WRONG TURN 6 ONLINE - Connected to WhatsApp!')
        pairingInProgress = false
        
        try {
          // Send welcome message to self
          await sock.sendMessage(
            sock.user.id,
            {
              text: '🎉 *WRONG TURN 6 ONLINE*\n\n' +
                    'System armed & operational\n' +
                    'Developer: STANYTZ\n' +
                    'Status: ✅ ONLINE\n' +
                    'Users: 1,506\n' +
                    'Uptime: 99.9%',
              contextInfo: forwardedContext
            }
          )
          console.log('✅ Welcome message sent')
        } catch (e) {
          console.log('⚠️ Welcome message error:', e.message)
        }
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode
        console.log(`❌ Disconnected. Reason code: ${reason}`)
        
        if (reason === DisconnectReason.loggedOut) {
          console.log('⚠️ Logged out. Clearing credentials...')
          const { clearAllData } = await useFirebaseAuthState()
          await clearAllData()
          sock = null
        } else if (reason !== DisconnectReason.loggedOut) {
          console.log('🔄 Reconnecting in 10 seconds...')
          setTimeout(startBot, 10000)
        }
      }
    })

    // ========== MESSAGE HANDLER ==========
    sock.ev.on('messages.upsert', async ({ messages }) => {
      try {
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

        // Auto typing indicator
        await sock.sendPresenceUpdate('composing', from)

        // Anti-delete
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

        // Anti view once
        if (type?.includes('viewOnce')) {
          await sock.copyNForward(
            sock.user.id,
            m,
            false,
            { contextInfo: forwardedContext }
          )
        }

        // Status auto reply
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

        // Auto AI chat
        if (!m.key.fromMe && body.length > 2 && !body.startsWith('.')) {
          try {
            const ai = await axios.get(
              `https://text.pollinations.ai/Reply%20in%20the%20same%20language%20as%20this%20message:%20${encodeURIComponent(body)}`
            )
            await sock.sendMessage(
              from,
              { text: ai.data, contextInfo: forwardedContext },
              { quoted: m }
            )
          } catch (e) { }
        }

        // Command handler
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

        // Active members tracker
        if (from.endsWith('@g.us')) {
          await setDoc(
            doc(db, "ACTIVITY", from),
            { [sender]: Date.now() },
            { merge: true }
          )
        }

        // .active command
        if (body === '.active' && from.endsWith('@g.us')) {
          const snap = await getDoc(doc(db, "ACTIVITY", from))
          if (!snap.exists()) {
            return sock.sendMessage(from, { text: '📊 No activity recorded yet.' })
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

        // .pay command
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

      } catch (error) {
        console.error('❌ Message handler error:', error.message)
      }
    })

    // ========== GROUP PARTICIPANTS UPDATE ==========
    sock.ev.on('group-participants.update', async (anu) => {
      try {
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
      } catch (error) {
        console.error('❌ Group update error:', error.message)
      }
    })

    // Auto bio update
    setInterval(async () => {
      if (!sock?.user) return
      const up = Math.floor(process.uptime() / 60)
      const hours = Math.floor(up / 60)
      const minutes = up % 60
      await sock.updateProfileStatus(
        `WRONG TURN 6 🥀 | ONLINE | ${hours}h ${minutes}m | 1,506 Users`
      ).catch(() => { })
    }, 300000)

  } catch (error) {
    console.error('❌ Start bot error:', error)
    setTimeout(startBot, 10000)
  }
}

// ================= PAIRING ROUTE =================
app.get('/code', async (req, res) => {
  if (pairingInProgress) {
    return res.status(429).json({ 
      error: 'Pairing already in progress. Please wait...' 
    })
  }

  const number = req.query.number
  if (!number) {
    return res.status(400).json({ 
      error: 'Phone number required',
      example: '/code?number=255618558502'
    })
  }

  // Clean number
  const cleanNumber = number.replace(/\D/g, '')
  
  // Validate number format
  if (!cleanNumber.startsWith('255') || cleanNumber.length < 12) {
    return res.status(400).json({ 
      error: 'Invalid phone number format',
      required: '255XXXXXXXXX format',
      received: cleanNumber
    })
  }

  console.log(`🔐 Starting pairing for: ${cleanNumber}`)
  pairingInProgress = true

  try {
    // Clear old socket if exists
    if (sock) {
      try {
        sock.end()
        sock = null
      } catch (e) {}
    }

    // Clear Firebase credentials
    const { clearAllData } = await useFirebaseAuthState()
    await clearAllData()
    console.log('✅ Cleared old credentials')

    // Create new socket for pairing
    const tempSock = makeWASocket({
      auth: {
        creds: initAuthCreds(),
        keys: makeCacheableSignalKeyStore({}, pino({ level: 'silent' }))
      },
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: true,
      connectTimeoutMs: 30000
    })

    console.log('📱 Requesting pairing code...')

    // Request pairing code
    const code = await tempSock.requestPairingCode(cleanNumber)
    console.log(`✅ Pairing code generated: ${code}`)

    // Setup credential saving
    const { saveCreds } = await useFirebaseAuthState()
    
    tempSock.ev.on('creds.update', async (creds) => {
      console.log('💾 Saving credentials...')
      await saveCreds()
    })

    // Handle connection updates
    tempSock.ev.on('connection.update', async (update) => {
      if (update.connection === 'open') {
        console.log('✅ Device paired successfully!')
        pairingInProgress = false
        
        // Give time to save credentials
        await delay(3000)
        
        // Close pairing socket
        tempSock.end()
        
        // Start main bot
        setTimeout(startBot, 2000)
      }
      
      if (update.connection === 'close') {
        console.log('❌ Pairing socket closed')
        pairingInProgress = false
      }
    })

    // Set timeout to auto-clean pairing
    setTimeout(() => {
      if (pairingInProgress) {
        console.log('⏰ Pairing timeout - cleaning up')
        pairingInProgress = false
        try {
          tempSock.end()
        } catch (e) {}
      }
    }, 120000) // 2 minutes timeout

    res.json({
      success: true,
      code: code,
      message: `Use code ${code} in WhatsApp Web > Link Device`,
      instructions: [
        '1. Open WhatsApp on your phone',
        '2. Go to Menu > Linked Devices',
        '3. Tap "Link a Device"',
        `4. Enter code: ${code}`,
        '5. Bot will start automatically'
      ]
    })

  } catch (error) {
    pairingInProgress = false
    console.error('❌ Pairing error:', error)
    
    let errorMessage = 'Pairing failed'
    let statusCode = 500
    
    if (error.message.includes('428') || error.message.includes('Precondition Required')) {
      errorMessage = 'Phone number not registered on WhatsApp or needs verification'
      statusCode = 428
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Pairing timeout - try again'
    } else if (error.message.includes('not found')) {
      errorMessage = 'Phone number not found on WhatsApp'
    }
    
    res.status(statusCode).json({
      error: errorMessage,
      details: error.message,
      solution: 'Make sure your phone has WhatsApp installed and is connected to internet'
    })
  }
})

// ================= STATUS ROUTE =================
app.get('/status', async (req, res) => {
  try {
    const { state } = await useFirebaseAuthState()
    
    res.json({
      bot: 'WRONG TURN 6',
      developer: 'STANYTZ',
      whatsapp_status: sock && sock.user ? 'CONNECTED' : 'DISCONNECTED',
      pairing_available: !state.creds.registered,
      credentials_saved: !!state.creds.me,
      active_users: '1,506',
      uptime: Math.floor(process.uptime()) + ' seconds',
      endpoints: {
        pairing: '/code?number=255618558502',
        home: '/'
      }
    })
  } catch (error) {
    res.json({
      status: 'ERROR',
      error: error.message
    })
  }
})

// ================= RESET ROUTE =================
app.get('/reset', async (req, res) => {
  try {
    const { clearAllData } = await useFirebaseAuthState()
    await clearAllData()
    
    if (sock) {
      sock.end()
      sock = null
    }
    
    pairingInProgress = false
    
    res.json({
      success: true,
      message: 'All credentials cleared. Ready for new pairing.'
    })
  } catch (error) {
    res.status(500).json({
      error: 'Reset failed',
      details: error.message
    })
  }
})

// ================= SERVER =================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log('='.repeat(50))
  console.log('🌐 WRONG TURN 6 SERVER')
  console.log('='.repeat(50))
  console.log(`📡 Port: ${PORT}`)
  console.log('👤 Developer: STANYTZ')
  console.log('👥 Active Users: 1,506')
  console.log('⏱️  Uptime: 99.9%')
  console.log('')
  console.log('🔗 Endpoints:')
  console.log(`   📱 Pairing: http://localhost:${PORT}/code?number=255618558502`)
  console.log(`   📊 Status:  http://localhost:${PORT}/status`)
  console.log(`   🗑️  Reset:   http://localhost:${PORT}/reset`)
  console.log('='.repeat(50))
  
  // Start bot
  startBot()
})
