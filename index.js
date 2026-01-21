require('dotenv').config()

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
  doc, getDoc, setDoc, deleteDoc
} = require('firebase/firestore')

const express = require('express')
const axios = require('axios')
const pino = require('pino')

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

/* ================= BRAND / FONTS ================= */
const BRAND = {
  bot: 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀',
  dev: '_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_',
  online:
`ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀

ꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ
ꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ ✔️`
}

/* ================= GLOBAL ================= */
const app = express()
let sock
const msgCache = new Map()

const CHANNEL_JID = '120363404317544295@newsletter'
const FORCE_GROUP = '120363406549688641@g.us'
const EMOJIS = ['🥀','🔥','⚡','🧠','😎','👀','🖤']

/* ================= FIREBASE AUTH ================= */
async function useFirebaseAuth(session) {
  const fix = id => `${session}_${id.replace(/\//g,'_').replace(/@/g,'at')}`

  const write = async (data,id)=>
    setDoc(doc(db,'WT6_SESSIONS',fix(id)),
      JSON.parse(JSON.stringify(data,BufferJSON.replacer)))

  const read = async id=>{
    const s = await getDoc(doc(db,'WT6_SESSIONS',fix(id)))
    return s.exists()
      ? JSON.parse(JSON.stringify(s.data()),BufferJSON.reviver)
      : null
  }

  const remove = async id=>deleteDoc(doc(db,'WT6_SESSIONS',fix(id)))
  const creds = await read('creds') || initAuthCreds()

  return {
    state:{
      creds,
      keys:{
        get: async (t,ids)=>{
          const o={}
          for (let i of ids) o[i]=await read(`${t}-${i}`)
          return o
        },
        set: async data=>{
          for (let t in data)
            for (let i in data[t])
              data[t][i]
                ? await write(data[t][i],`${t}-${i}`)
                : await remove(`${t}-${i}`)
        }
      }
    },
    saveCreds: ()=>write(creds,'creds'),
    clear: ()=>remove('creds')
  }
}

/* ================= START BOT ================= */
async function startBot() {
  const { state, saveCreds } = await useFirebaseAuth('MASTER')

  sock = makeWASocket({
    auth: state,
    logger: pino({ level:'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: true
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect })=>{
    if (connection === 'open') {
      await sock.sendMessage(sock.user.id,{
        text:`${BRAND.online}\n\n${BRAND.dev}`,
        contextInfo:{
          forwardedNewsletterMessageInfo:{
            newsletterJid: CHANNEL_JID,
            serverMessageId: 1,
            newsletterName: BRAND.bot
          }
        }
      })
    }

    if (
      connection === 'close' &&
      lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
    ) setTimeout(startBot,5000)
  })

  /* ================= MESSAGES ================= */
  sock.ev.on('messages.upsert', async ({ messages })=>{
    const m = messages[0]
    if (!m.message) return

    const from = m.key.remoteJid
    const sender = m.key.participant || from
    const body =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      m.message.videoMessage?.caption || ''

    const type = getContentType(m.message)
    msgCache.set(m.key.id,m)

    /* ===== STATUS ENGINE ===== */
    if (from === 'status@broadcast') {
      await sock.readMessages([m.key])

      await sock.sendMessage(from,{
        react:{
          text: EMOJIS[Math.floor(Math.random()*EMOJIS.length)],
          key: m.key
        }
      },{ statusJidList:[sender] })

      const ai = await axios.get(
        `https://text.pollinations.ai/Think deeply and reply shortly in same language:\n${body}`
      )

      await sock.sendMessage(from,{
        text:`${BRAND.bot}\n\n${ai.data}\n\n${BRAND.dev}`,
        contextInfo:{
          forwardedNewsletterMessageInfo:{
            newsletterJid: CHANNEL_JID,
            serverMessageId: 1,
            newsletterName: BRAND.bot
          }
        }
      })
      return
    }

    /* ===== ANTI DELETE ===== */
    if (m.message?.protocolMessage?.type === 0) {
      const old = msgCache.get(m.message.protocolMessage.key.id)
      if (old) await sock.copyNForward(sock.user.id,old,false)
    }

    /* ===== ANTI VIEW ONCE ===== */
    if (type?.includes('viewOnce'))
      await sock.copyNForward(sock.user.id,m,false)

    /* ===== AUTO AI CHAT ===== */
    if (!body.startsWith('.') && body.length > 2) {
      const ai = await axios.get(
        `https://text.pollinations.ai/Reply like a human in same language:\n${body}`
      )

      await sock.sendMessage(from,{
        text:`${BRAND.bot}\n\n${ai.data}\n\n${BRAND.dev}`,
        contextInfo:{
          forwardedNewsletterMessageInfo:{
            newsletterJid: CHANNEL_JID,
            serverMessageId: 1,
            newsletterName: BRAND.bot
          }
        }
      },{ quoted:m })
    }
  })
}

/* ================= PAIRING ================= */
app.get('/code', async (req,res)=>{
  const num = req.query.number
  if (!num) return res.send('NO NUMBER')

  const auth = await useFirebaseAuth('MASTER')
  await auth.clear()

  sock = makeWASocket({
    auth: auth.state,
    logger: pino({ level:'silent' }),
    browser: Browsers.ubuntu('Chrome')
  })

  await delay(3000)
  const code = await sock.requestPairingCode(num.replace(/\D/g,''))

  res.json({ code })

  sock.ev.on('creds.update', auth.saveCreds)
  sock.ev.on('connection.update', u=>{
    if (u.connection === 'open') startBot()
  })
})

/* ================= AUTO BIO ================= */
setInterval(async ()=>{
  if (sock?.user) {
    const up = Math.floor(process.uptime()/60)
    await sock.updateProfileStatus(
      `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀 | ᴜᴘᴛɪᴍᴇ ${up}m`
    ).catch(()=>{})
  }
},30000)

/* ================= SERVER ================= */
app.listen(3000,()=>{
  console.log('WRONG TURN 6 SERVER ONLINE')
  startBot()
})
