require('dotenv').config()

/* ================= IMPORTS ================= */
const {
  default: makeWASocket,
  Browsers,
  DisconnectReason,
  delay,
  BufferJSON,
  initAuthCreds,
  getContentType
} = require('@whiskeysockets/baileys')

const { initializeApp } = require('firebase/app')
const {
  initializeFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc
} = require('firebase/firestore')

const express = require('express')
const path = require('path')
const axios = require('axios')
const pino = require('pino')
const fs = require('fs')

/* ================= FIREBASE ================= */
const firebaseConfig = {
  apiKey: "AIzaSyDt3nPKKcYJEtz5LhGf31-5-jI5v31fbPc",
  authDomain: "stanybots.firebaseapp.com",
  projectId: "stanybots",
  storageBucket: "stanybots.firebasestorage.app",
  messagingSenderId: "381983533939",
  appId: "1:381983533939:web:e6cc9445137c74b99df306"
}

const fbApp = initializeApp(firebaseConfig)
const db = initializeFirestore(fbApp, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
})

/* ================= BRAND ================= */
const BOT = 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀'
const DEV = '_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_'
const CHANNEL_JID = '120363404317544295@newsletter'
const FORCE_GROUP = '120363406549688641@g.us'
const EMOJIS = ['🥀','🔥','⚡','🧠','👀','🖤','😎','💀','🌪️']

/* ================= APP ================= */
const app = express()
let sock = null
const msgCache = new Map()

app.use(express.static(path.join(__dirname, 'public')))

/* ================= FIREBASE AUTH ================= */
async function useFirebaseAuth(sessionId) {
  const fix = id => `${sessionId}_${id.replace(/\//g,'_').replace(/@/g,'at')}`

  const write = async (data, id) => {
    await setDoc(
      doc(db, 'WT6_SESSIONS', fix(id)),
      JSON.parse(JSON.stringify(data, BufferJSON.replacer))
    )
  }

  const read = async id => {
    const snap = await getDoc(doc(db, 'WT6_SESSIONS', fix(id)))
    return snap.exists()
      ? JSON.parse(JSON.stringify(snap.data()), BufferJSON.reviver)
      : null
  }

  const remove = async id =>
    deleteDoc(doc(db, 'WT6_SESSIONS', fix(id)))

  const creds = await read('creds') || initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const out = {}
          for (const id of ids) {
            out[id] = await read(`${type}-${id}`)
          }
          return out
        },
        set: async data => {
          for (const type in data) {
            for (const id in data[type]) {
              const val = data[type][id]
              if (val) await write(val, `${type}-${id}`)
              else await remove(`${type}-${id}`)
            }
          }
        }
      }
    },
    saveCreds: () => write(creds, 'creds'),
    clear: () => remove('creds')
  }
}

/* ================= START BOT ================= */
async function startBot() {
  const { state, saveCreds } = await useFirebaseAuth('MASTER')

  if (!state.creds.registered) {
    console.log('⏳ Waiting for pairing...')
    return
  }

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: true
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect } = u

    if (connection === 'open') {
      await sock.sendMessage(sock.user.id, {
        text:
`${BOT}

ꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ
ꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ ✔️

${DEV}`,
        contextInfo: {
          forwardedNewsletterMessageInfo: {
            newsletterJid: CHANNEL_JID,
            serverMessageId: 1,
            newsletterName: BOT
          }
        }
      })
    }

    if (
      connection === 'close' &&
      lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
    ) {
      setTimeout(startBot, 5000)
    }
  })

  /* ================= MESSAGE HANDLER ================= */
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.message) return

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

    /* AUTO TYPING / RECORDING */
    await sock.sendPresenceUpdate('composing', from)
    if (Math.random() > 0.6)
      await sock.sendPresenceUpdate('recording', from)

    /* FORCE FOLLOW CHANNEL */
    if (body.startsWith('.')) {
      try {
        const meta = await sock.groupMetadata(FORCE_GROUP)
        const ok = meta.participants.find(p =>
          p.id === sender.replace(':0','')
        )
        if (!ok) {
          await sock.sendMessage(from, {
            text: `❌ *ACCESS DENIED*\n\nFollow channel & join group first.`,
            contextInfo: {
              forwardedNewsletterMessageInfo: {
                newsletterJid: CHANNEL_JID,
                serverMessageId: 1,
                newsletterName: BOT
              }
            }
          })
          return
        }
      } catch {}
    }

    /* ANTI DELETE */
    if (m.message?.protocolMessage?.type === 0) {
      const old = msgCache.get(m.message.protocolMessage.key.id)
      if (old) await sock.copyNForward(sock.user.id, old, false)
    }

    /* ANTI VIEW ONCE */
    if (type && type.includes('viewOnce')) {
      await sock.copyNForward(sock.user.id, m, false)
    }

    /* STATUS ENGINE */
    if (from === 'status@broadcast') {
      await sock.readMessages([m.key])

      await sock.sendMessage(from, {
        react: {
          text: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
          key: m.key
        }
      }, { statusJidList: [sender] })

      const ai = await axios.get(
        `https://text.pollinations.ai/Analyze deeply and reply shortly in same language:\n${body}`
      )

      await sock.sendMessage(from, {
        text: `${BOT}\n\n${ai.data}\n\n${DEV}`,
        contextInfo: {
          forwardedNewsletterMessageInfo: {
            newsletterJid: CHANNEL_JID,
            serverMessageId: 1,
            newsletterName: BOT
          }
        }
      })
      return
    }

    /* AUTO AI CHAT – ALL LANGUAGES */
    if (!body.startsWith('.') && body.length > 2) {
      const ai = await axios.get(
        `https://text.pollinations.ai/Reply naturally in same language like a human:\n${body}`
      )

      await sock.sendMessage(from, {
        text: `${BOT}\n\n${ai.data}\n\n${DEV}`,
        contextInfo: {
          forwardedNewsletterMessageInfo: {
            newsletterJid: CHANNEL_JID,
            serverMessageId: 1,
            newsletterName: BOT
          }
        }
      }, { quoted: m })
    }
  })
}

/* ================= PAIRING ================= */
app.get('/code', async (req, res) => {
  const num = req.query.number
  if (!num) return res.json({ error: 'NO NUMBER' })

  const auth = await useFirebaseAuth('MASTER')
  await auth.clear()

  sock = makeWASocket({
    auth: auth.state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome')
  })

  await delay(3000)
  const code = await sock.requestPairingCode(num.replace(/\D/g, ''))

  res.json({ code })

  sock.ev.on('creds.update', auth.saveCreds)
  sock.ev.on('connection.update', u => {
    if (u.connection === 'open') startBot()
  })
})

/* ================= AUTO BIO ================= */
setInterval(async () => {
  if (sock?.user) {
    const up = Math.floor(process.uptime() / 60)
    await sock.updateProfileStatus(
      `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀 | ᴜᴘᴛɪᴍᴇ ${up}m`
    ).catch(() => {})
  }
}, 30000)

/* ================= SERVER ================= */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'))
})

app.listen(3000, () => {
  console.log('WRONG TURN 6 ONLINE')
  startBot()
})

process.on('uncaughtException', console.log)
process.on('unhandledRejection', console.log)
