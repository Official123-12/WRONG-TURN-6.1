/*************************************************
 * WRONG TURN 6 🥀
 * Developer: STANYTZ
 * File: index.js (SINGLE FILE – OPTION 2)
 *************************************************/

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
const {
  initializeFirestore,
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

/* ================= FIREBASE CONFIG ================= */

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

/* ================= EXPRESS APP ================= */

const app = express()
const PORT = process.env.PORT || 3000

/* ================= GLOBAL STATE ================= */

let sock = null
const commands = new Map()
const msgCache = new Map()

/* ================= FORWARDED CONTEXT ================= */

const forwardedContext = {
  isForwarded: true,
  forwardingScore: 999,
  forwardedNewsletterMessageInfo: {
    newsletterJid: '120363404317544295@newsletter',
    serverMessageId: 1,
    newsletterName: 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀'
  }
}

/* ================= DEFAULT SETTINGS ================= */

const DEFAULT_SETTINGS = {
  prefix: '.',
  public: true,

  autoAI: true,
  autoTyping: true,
  autoRecording: true,

  autoStatusView: true,
  autoStatusLike: true,
  autoStatusReply: true,

  antiDelete: true,
  antiViewOnce: true,
  antiLink: true,
  antiPorn: true,
  antiScam: true,
  antiMedia: false,

  welcome: true,
  goodbye: true,

  forceFollow: true,
  autoBio: true
}

/* ================= UTILITY HELPERS ================= */

const sleep = ms => new Promise(r => setTimeout(r, ms))

const normalizeNumber = n => n.replace(/\D/g, '')

const isLink = text => /(https?:\/\/|wa\.me|chat\.whatsapp\.com)/i.test(text)

const isPorn = text =>
  /(porn|xxx|sex|nude|ngono|🔞|xvideos|xnxx)/i.test(text)

const isScam = text =>
  /(bundle|fixed match|bet|invest|earn money|crypto)/i.test(text)

/* ================= COMMAND LOADER ================= */

function loadCommands() {
  const base = path.join(__dirname, 'commands')
  if (!fs.existsSync(base)) fs.mkdirSync(base)

  const folders = fs.readdirSync(base)
  for (const folder of folders) {
    const fPath = path.join(base, folder)
    if (!fs.lstatSync(fPath).isDirectory()) continue

    const files = fs.readdirSync(fPath).filter(f => f.endsWith('.js'))
    for (const file of files) {
      try {
        const cmd = require(path.join(fPath, file))
        if (cmd?.name) {
          commands.set(cmd.name.toLowerCase(), cmd)
        }
      } catch (e) {
        console.log('CMD LOAD ERROR:', file)
      }
    }
  }
}

/* ================= FIREBASE AUTH STATE ================= */

async function useFirebaseAuthState(collection, session) {

  const fixId = id =>
    `${session}_${id.replace(/\//g, '__').replace(/@/g, '_')}`

  const writeData = (data, id) =>
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

  const removeData = id =>
    deleteDoc(doc(db, collection, fixId(id)))

  const creds = await readData('creds') || initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {}
          for (const id of ids) {
            data[id] = await readData(`${type}-${id}`)
          }
          return data
        },
        set: async data => {
          for (const type in data) {
            for (const id in data[type]) {
              const v = data[type][id]
              v
                ? await writeData(v, `${type}-${id}`)
                : await removeData(`${type}-${id}`)
            }
          }
        }
      }
    },
    saveCreds: () => writeData(creds, 'creds'),
    clear: () => removeData('creds')
  }
}
/* ================= START BOT ================= */

async function startBot() {
  loadCommands()

  const { state, saveCreds } =
    await useFirebaseAuthState("WT6_SESSIONS", "MASTER")

  if (!state.creds.registered) {
    console.log("⏳ WAITING FOR PAIRING CODE...")
    return
  }

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu("Chrome"),
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true
  })

  sock.ev.on('creds.update', saveCreds)

  /* ========== CONNECTION UPDATE ========== */
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log("✅ WRONG TURN 6 CONNECTED")

      const welcome =
        `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n` +
        `ꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\n` +
        `ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ\n` +
        `ꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ ✔️`

      sock.sendMessage(sock.user.id, {
        text: welcome,
        contextInfo: forwardedContext
      })
    }

    if (
      connection === 'close' &&
      lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
    ) {
      console.log("🔄 RECONNECTING...")
      setTimeout(startBot, 5000)
    }
  })

  /* ========== GROUP EVENTS (WELCOME / GOODBYE) ========== */
  sock.ev.on('group-participants.update', async (anu) => {
    if (!DEFAULT_SETTINGS.welcome && !DEFAULT_SETTINGS.goodbye) return

    const { id, participants, action } = anu
    const meta = await sock.groupMetadata(id)
    const groupPic =
      await sock.profilePictureUrl(id, 'image')
        .catch(() => null)

    for (const user of participants) {
      if (action === 'add' && DEFAULT_SETTINGS.welcome) {
        const text =
          `╭─❖\n` +
          `│ 🥀 ᴡᴇʟᴄᴏᴍᴇ\n` +
          `│ 👤 @${user.split('@')[0]}\n` +
          `│ 👥 ${meta.subject}\n` +
          `╰─❖`

        await sock.sendMessage(id, {
          image: groupPic ? { url: groupPic } : undefined,
          caption: text,
          mentions: [user],
          contextInfo: forwardedContext
        })
      }

      if (action === 'remove' && DEFAULT_SETTINGS.goodbye) {
        const text =
          `╭─❖\n` +
          `│ 🥀 ɢᴏᴏᴅʙʏᴇ\n` +
          `│ 👤 @${user.split('@')[0]}\n` +
          `╰─❖`

        await sock.sendMessage(id, {
          text,
          mentions: [user],
          contextInfo: forwardedContext
        })
      }
    }
  })

  /* ========== MESSAGE HANDLER ========== */
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

    /* ===== AUTO PRESENCE ===== */
    if (DEFAULT_SETTINGS.autoTyping)
      await sock.sendPresenceUpdate('composing', from)
    if (DEFAULT_SETTINGS.autoRecording && Math.random() > 0.5)
      await sock.sendPresenceUpdate('recording', from)

    /* ===== FORCE FOLLOW ===== */
    if (DEFAULT_SETTINGS.forceFollow && body.startsWith(DEFAULT_SETTINGS.prefix)) {
      try {
        const groupMeta =
          await sock.groupMetadata('120363406549688641@g.us')

        const isMember =
          groupMeta.participants
            .find(p => p.id === sender)

        if (!isMember) {
          return sock.sendMessage(from, {
            text:
              `❌ *ACCESS DENIED*\n\n` +
              `Join our group/channel first:\n` +
              `https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y`,
            contextInfo: forwardedContext
          })
        }
      } catch {}
    }

    /* ===== ANTI DELETE ===== */
    if (
      DEFAULT_SETTINGS.antiDelete &&
      m.message.protocolMessage?.type === 0
    ) {
      const cached =
        msgCache.get(m.message.protocolMessage.key.id)

      if (cached) {
        await sock.copyNForward(
          sock.user.id,
          cached,
          false,
          { contextInfo: forwardedContext }
        )
      }
    }

    /* ===== ANTI VIEW ONCE ===== */
    if (
      DEFAULT_SETTINGS.antiViewOnce &&
      (type === 'viewOnceMessage' || type === 'viewOnceMessageV2')
    ) {
      await sock.copyNForward(
        sock.user.id,
        m,
        false,
        { contextInfo: forwardedContext }
      )
    }

    /* ===== GROUP PROTECTION ===== */
    if (from.endsWith('@g.us')) {
      if (DEFAULT_SETTINGS.antiLink && isLink(body))
        await sock.sendMessage(from, { delete: m.key })

      if (DEFAULT_SETTINGS.antiPorn && isPorn(body))
        await sock.sendMessage(from, { delete: m.key })

      if (DEFAULT_SETTINGS.antiScam && isScam(body))
        await sock.sendMessage(from, { delete: m.key })

      if (
        DEFAULT_SETTINGS.antiMedia &&
        ['imageMessage', 'videoMessage', 'audioMessage'].includes(type)
      ) {
        await sock.sendMessage(from, { delete: m.key })
      }
    }

    /* ===== AUTO AI CHAT (ALL LANGUAGES) ===== */
    if (
      DEFAULT_SETTINGS.autoAI &&
      !body.startsWith(DEFAULT_SETTINGS.prefix) &&
      !m.key.fromMe &&
      body.length > 2
    ) {
      try {
        const prompt =
          `Reply like a human in user's language:\n${body}`

        const ai =
          await axios.get(
            `https://text.pollinations.ai/${encodeURIComponent(prompt)}`
          )

        await sock.sendMessage(from, {
          text:
            `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\n` +
            `${ai.data}\n\n` +
            `_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`,
          contextInfo: forwardedContext
        }, { quoted: m })
      } catch {}
    }

    /* ===== COMMAND HANDLER ===== */
    if (body.startsWith(DEFAULT_SETTINGS.prefix)) {
      const args =
        body
          .slice(DEFAULT_SETTINGS.prefix.length)
          .trim()
          .split(/ +/)

      const cmdName = args.shift()?.toLowerCase()
      const cmd = commands.get(cmdName)

      if (cmd) {
        try {
          await cmd.execute(
            m,
            sock,
            Array.from(commands.values()),
            args,
            db,
            forwardedContext
          )
        } catch {}
      }
    }
  })
}
/* ================= PAIRING CODE ROUTE ================= */

app.get('/code', async (req, res) => {
  const number = req.query.number
  if (!number) return res.status(400).json({ error: 'Number required' })

  try {
    const { state, saveCreds, clearSession } =
      await useFirebaseAuthState("WT6_SESSIONS", "MASTER")

    await clearSession()

    const tempSock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu("Chrome"),
      printQRInTerminal: false
    })

    tempSock.ev.on('creds.update', saveCreds)

    await delay(4000)

    const code =
      await tempSock.requestPairingCode(
        number.replace(/\D/g, '')
      )

    res.json({ code })

    tempSock.ev.on('connection.update', (u) => {
      if (u.connection === 'open') {
        console.log("🔗 DEVICE LINKED SUCCESSFULLY")
        startBot()
      }
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({
      error: 'Precondition Required FIXED'
    })
  }
})

/* ================= EXPRESS ================= */

app.get('/', (_, res) =>
  res.sendFile(path.join(__dirname, 'public/index.html'))
)


app.listen(PORT, () => {
  console.log(`🌐 SERVER RUNNING ON :${PORT}`)
  startBot()
})

/* ================= AUTO BIO ================= */

setInterval(async () => {
  try {
    if (!sock?.user) return

    const up =
      `${Math.floor(process.uptime() / 3600)}h ` +
      `${Math.floor((process.uptime() % 3600) / 60)}m`

    await sock.updateProfileStatus(
      `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀 | ᴜᴘᴛɪᴍᴇ ${up}`
    )
  } catch {}
}, 60000)

/* ================= CALL BLOCK ================= */

sock?.ev?.on?.('call', async (call) => {
  await sock.rejectCall(call[0].id, call[0].from)
})

/* ================= PROCESS SAFETY ================= */

process.on('uncaughtException', () => {})
process.on('unhandledRejection', () => {})

/* ================= END ================= */
