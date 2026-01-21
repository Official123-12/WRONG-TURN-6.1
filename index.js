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

const appFB = initializeApp(firebaseConfig)
const db = initializeFirestore(appFB, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
})

/* ================= BRAND ================= */
const BOT = 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀'
const DEV = '_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_'

const CHANNEL_JID = '120363404317544295@newsletter'
const FORCE_GROUP = '120363406549688641@g.us'

/* ================= GLOBAL ================= */
const app = express()
let sock
const msgCache = new Map()
const EMOJIS = ['🥀','🔥','⚡','🧠','👀','🖤','😎']

app.use(express.static(path.join(__dirname,'public')))

/* ================= FIREBASE AUTH ================= */
async function useFirebaseAuth(sessionId) {
  const fix = id => `${sessionId}_${id.replace(/\//g,'_').replace(/@/g,'at')}`

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

  if (!state.creds.registered) {
    console.log('⏳ Waiting for pairing...')
    return
  }

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
        text:
`${BOT}

ꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ
ꜱᴛᴀᴛᴜꜱ: ᴏɴʟɪɴᴇ ✔️

${DEV}`,
        contextInfo:{
          forwardedNewsletterMessageInfo:{
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

    /* AUTO TYPING / RECORDING */
    await sock.sendPresenceUpdate('composing',from)
    if (Math.random() > 0.6)
      await sock.sendPresenceUpdate('recording',from)

    /* ANTI DELETE */
    if (m.message?.protocolMessage?.type === 0) {
      const old = msgCache.get(m.message.protocolMessage.key.id)
      if (old) await sock.copyNForward(sock.user.id,old,false)
    }

    /* ANTI VIEW ONCE */
    if (type?.includes('viewOnce'))
      await sock.copyNForward(sock.user.id,m,false)

    /* STATUS ENGINE */
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
        text:`${BOT}\n\n${ai.data}\n\n${DEV}`,
        contextInfo:{
          forwardedNewsletterMessageInfo:{
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
        `https://text.pollinations.ai/Reply naturally in same language:\n${body}`
      )

      await sock.sendMessage(from,{
        text:`${BOT}\n\n${ai.data}\n\n${DEV}`,
        contextInfo:{
          forwardedNewsletterMessageInfo:{
            newsletterJid: CHANNEL_JID,
