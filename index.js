require('dotenv').config()
const {
  default: makeWASocket,
  DisconnectReason,
  Browsers,
  delay,
  makeCacheableSignalKeyStore,
  initAuthCreds,
  BufferJSON,
  getContentType
} = require('@whiskeysockets/baileys')

const { initializeApp } = require('firebase/app')
const { initializeFirestore, doc, getDoc, setDoc } = require('firebase/firestore')
const express = require('express')
const path = require('path')
const fs = require('fs-extra')
const pino = require('pino')
const axios = require('axios')

/* ================= FIREBASE ================= */
const firebaseConfig = {
  apiKey: "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
  authDomain: "stanybots.firebaseapp.com",
  projectId: "stanybots",
  storageBucket: "stanybots.firebasestorage.app",
  messagingSenderId: "381983533939",
  appId: "1:381983533939:web:e6cc9445137c74b99df306"
}

const firebaseApp = initializeApp(firebaseConfig)
const db = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
})

/* ================= GLOBALS ================= */
const app = express()
const commands = new Map()
const msgCache = new Map()
let sock = null
let isPairing = false

/* ================= FORWARDED CONTEXT ================= */
const forwardedContext = {
  isForwarded: true,
  forwardingScore: 999,
  forwardedNewsletterMessageInfo: {
    newsletterJid: '120363404317544295@newsletter',
    serverMessageId: 1,
    newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀'
  }
}

/* ================= COMMAND LOADER ================= */
function loadCmds () {
  const cmdPath = path.join(__dirname, 'commands')
  if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath)

  for (const folder of fs.readdirSync(cmdPath)) {
    const folderPath = path.join(cmdPath, folder)
    if (!fs.lstatSync(folderPath).isDirectory()) continue

    for (const file of fs.readdirSync(folderPath).filter(f => f.endsWith('.js'))) {
      try {
        const cmd = require(path.join(folderPath, file))
        if (cmd?.name) {
          cmd.category = folder
          commands.set(cmd.name.toLowerCase(), cmd)
        }
      } catch {}
    }
  }
}

/* ================= FIREBASE AUTH STATE ================= */
async function useFirebaseAuthState (collection, sessionId) {
  const fixId = id =>
    `${sessionId}_${id.replace(/\//g, '__').replace(/@/g, 'at')}`

  const writeData = async (data, id) =>
    setDoc(
      doc(db, collection, fixId(id)),
      JSON.parse(JSON.stringify(data, BufferJSON.replacer))
    )

  const readData = async id => {
    try {
      const snap = await getDoc(doc(db, collection, fixId(id)))
      return snap.exists()
        ? JSON.parse(JSON.stringify(snap.data()), BufferJSON.reviver)
        : null
    } catch {
      return null
    }
  }

  const creds = (await readData('creds')) || initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {}
          for (const id of ids) {
            let value = await readData(`${type}-${id}`)
            if (
              type === 'app-state-sync-key' &&
              value
            ) {
              value =
                require('@whiskeysockets/baileys').proto.Message
                  .AppStateSyncKeyData.fromObject(value)
            }
            data[id] = value
          }
          return data
        },
        set: async data => {
          for (const type in data) {
            for (const id in data[type]) {
              const value = data[type][id]
              if (value) await writeData(value, `${type}-${id}`)
            }
          }
        }
      }
    },
    saveCreds: () => writeData(creds, 'creds')
  }
}

/* ================= MAIN BOT ================= */
async function startBot () {
  if (sock || isPairing) return

  loadCmds()
  const { state, saveCreds } = await useFirebaseAuthState(
    'WT6_SESSIONS',
    'MASTER'
  )

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', u => {
    if (u.connection === 'open') {
      sock.sendMessage(sock.user.id, {
        text:
          'ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\n' +
          'ꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\n' +
          'ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ\n' +
          'ꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ ✔️',
        contextInfo: forwardedContext
      })
    }

    if (
      u.connection === 'close' &&
      u.lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut
    ) {
      sock = null
      setTimeout(startBot, 5000)
    }
  })

  /* ================= MESSAGES ================= */
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m?.message) return

    const from = m.key.remoteJid
    const sender = m.key.participant || from
    const body =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      ''
    const type = getContentType(m.message)

    msgCache.set(m.key.id, m)

    // AUTO PRESENCE
    await sock.sendPresenceUpdate('composing', from)

    // ANTI DELETE
    if (m.message.protocolMessage?.type === 0) {
      const cached = msgCache.get(
        m.message.protocolMessage.key.id
      )
      if (cached)
        await sock.copyNForward(
          sock.user.id,
          cached,
          false,
          { contextInfo: forwardedContext }
        )
    }

    // ANTI VIEWONCE
    if (
      type === 'viewOnceMessage' ||
      type === 'viewOnceMessageV2'
    ) {
      await sock.copyNForward(
        sock.user.id,
        m,
        false,
        { contextInfo: forwardedContext }
      )
    }

    // AUTO AI CHAT (ALL LANGUAGES)
    if (!body.startsWith('.') && body.length > 2) {
      try {
        const ai = await axios.get(
          `https://text.pollinations.ai/Respond naturally in the user's language: ${encodeURIComponent(
            body
          )}`
        )
        await sock.sendMessage(
          from,
          {
            text:
              'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n' +
              ai.data +
              '\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_',
            contextInfo: forwardedContext
          },
          { quoted: m }
        )
      } catch {}
    }

    // COMMANDS
    if (body.startsWith('.')) {
      const args = body.slice(1).trim().split(/ +/)
      const name = args.shift().toLowerCase()
      const cmd = commands.get(name)
      if (cmd)
        await cmd.execute(
          m,
          sock,
          [...commands.values()],
          args,
          db,
          forwardedContext
        )
    }
  })
}

/* ================= PAIRING ================= */
app.get('/code', async (req, res) => {
  if (isPairing) return res.send({ error: 'Busy' })
  isPairing = true

  try {
    const auth = await useFirebaseAuthState(
      'WT6_SESSIONS',
      'MASTER'
    )

    sock = makeWASocket({
      auth: auth.state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Chrome')
    })

    await delay(3000)
    const code = await sock.requestPairingCode(
      req.query.number.replace(/\D/g, '')
    )

    res.send({ code })

    sock.ev.on('creds.update', auth.saveCreds)
    sock.ev.on('connection.update', u => {
      if (u.connection === 'open') {
        isPairing = false
        startBot()
      }
    })
  } catch (e) {
    isPairing = false
    res.status(500).send({ error: 'Pairing failed' })
  }
})

/* ================= SERVER ================= */
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public/index.html'))
)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🌐 SERVER RUNNING : ${PORT}`)
  startBot()
})
