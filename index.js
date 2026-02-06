require('dotenv').config()
const { default: makeWASocket, DisconnectReason, Browsers, delay, useMultiFileAuthState, getContentType, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys')
const { initializeApp } = require('firebase/app')
const { initializeFirestore, doc, getDoc, setDoc } = require('firebase/firestore')
const express = require('express')
const path = require('path')
const fs = require('fs-extra')
const pino = require('pino')
const axios = require('axios')

// ================= CONFIG =================
const ADMIN_NUMBER = '255618558502'
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb72cVkJ3jv10gzqTn18'

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
const db = initializeFirestore(firebaseApp, {})

// ================= EXPRESS =================
const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')))

// ================= GLOBALS =================
let sock = null
const commands = new Map()
const msgCache = new Map()

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
  if (!fs.existsSync(base)) fs.mkdirSync(base)
  fs.readdirSync(base).forEach(folder => {
    const dir = path.join(base, folder)
    if (!fs.lstatSync(dir).isDirectory()) return
    fs.readdirSync(dir)
      .filter(f => f.endsWith('.js'))
      .forEach(file => {
        try {
          const cmd = require(path.join(dir, file))
          if (cmd?.name) { cmd.category = folder; commands.set(cmd.name.toLowerCase(), cmd) }
        } catch(e){ console.log('CMD LOAD ERROR:', e.message) }
      })
  })
}

// ================= FIREBASE AUTH =================
async function useFirebaseAuthState(sessionId){
  const authDir = path.join(__dirname,'auth_info_baileys')
  if(!fs.existsSync(authDir)) fs.mkdirSync(authDir)
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  return { state, saveCreds }
}

// ================= START BOT =================
async function startBot(){
  loadCmds()
  const { state, saveCreds } = await useFirebaseAuthState('MASTER')

  sock = makeWASocket({
    auth:{ creds:state.creds, keys:makeCacheableSignalKeyStore(state.keys||{}, pino({level:'silent'})) },
    logger:pino({level:'silent'}),
    browser:Browsers.ubuntu('Chrome'),
    markOnlineOnConnect:true,
    generateHighQualityLinkPreview:true
  })

  sock.ev.on('creds.update',saveCreds)

  sock.ev.on('connection.update',async({connection,lastDisconnect})=>{
    if(connection==='open'){
      console.log('✅ WRONG TURN 6 ONLINE')
      if(sock.user?.id) await sock.sendMessage(sock.user.id,{
        text:'System armed & operational ✔️\nDeveloper: STANYTZ',
        contextInfo:forwardedContext
      })
    }
    if(connection==='close'){
      if(lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) setTimeout(startBot,5000)
    }
  })

  // ===== WELCOME / GOODBYE =====
  sock.ev.on('group-participants.update',async(anu)=>{
    const{id,participants,action}=anu
    let meta
    try{ meta = await sock.groupMetadata(id) }catch{return}
    const pic = await sock.profilePictureUrl(id,'image').catch(()=>null)

    for(const user of participants){
      if(action==='add'){
        await sock.sendMessage(id,{
          image: pic?{url:pic}:undefined,
          caption:`🥀 WELCOME 🥀\nUser: @${user.split('@')[0]}\nGroup: ${meta.subject}\nMembers: ${meta.participants.length}`,
          mentions:[user],
          contextInfo:forwardedContext
        })
      }
      if(action==='remove'){
        await sock.sendMessage(id,{
          text:`👋 Goodbye @${user.split('@')[0]}`,
          mentions:[user],
          contextInfo:forwardedContext
        })
      }
    }
  })

  // ===== MESSAGE HANDLER =====
  sock.ev.on('messages.upsert',async({messages})=>{
    const m=messages[0]; if(!m?.message) return
    const from = m.key.remoteJid
    const type = getContentType(m.message)
    const body = m.message.conversation||m.message.extendedTextMessage?.text||m.message.imageMessage?.caption||m.message.videoMessage?.caption||''
    msgCache.set(m.key.id,m)

    // ----- FORCE FOLLOW CHANNEL -----
    const userRef = doc(db,'WT6_USERS',from)
    const snap = await getDoc(userRef)
    if(!snap.exists() || !snap.data().followed){
      await sock.sendMessage(from,{text:`❌ You must follow our channel to use the bot:\n${CHANNEL_LINK}`})
      return
    }

    // ----- ANTI DELETE -----
    if(m.message.protocolMessage?.type===0 && !m.key.fromMe){
      const cached = msgCache.get(m.message.protocolMessage.key.id)
      if(cached) await sock.copyNForward(sock.user.id,cached,false,{contextInfo:forwardedContext})
    }

    // ----- ANTI VIEWONCE -----
    if(type?.includes('viewOnce')) await sock.copyNForward(sock.user.id,m,false,{contextInfo:forwardedContext})

    // ----- AI REPLY -----
    if(!m.key.fromMe && body.length>2 && !body.startsWith('.')){
      try{
        const ai = await axios.get(`https://text.pollinations.ai/Reply%20in%20the%20same%20language%20as%20user:${encodeURIComponent(body)}`)
        await sock.sendMessage(from,{text:ai.data,contextInfo:forwardedContext},{quoted:m})
      }catch{}
    }

    // ----- COMMAND HANDLER -----
    if(body.startsWith('.')){
      const args = body.slice(1).trim().split(/\s+/)
      const cmdName = args.shift().toLowerCase()
      const cmd = commands.get(cmdName)
      if(cmd) await cmd.execute(m,sock,commands,args,db,forwardedContext)
    }
  })
}

// ================= OFFICIAL 8-DIGIT PAIRING =================
app.post('/pair', async(req,res)=>{
  const { number } = req.body
  if(!number) return res.status(400).json({ error: 'No number provided' })
  try{
    const authDir = path.join(__dirname,'auth_info_baileys')
    if(!fs.existsSync(authDir)) fs.mkdirSync(authDir)
    const { state, saveCreds } = await useMultiFileAuthState(authDir)
    const tempSock = makeWASocket({ auth: state, logger: pino({level:'silent'}), browser: Browsers.ubuntu('Chrome') })
    tempSock.ev.on('creds.update', saveCreds)

    const code = await tempSock.requestPairingCode(number.replace(/\D/g,''))
    // Save to Firebase user collection to mark as paired
    await setDoc(doc(db,'WT6_USERS',number.replace(/\D/g,'')), { paired:true, followed:true })

    res.json({ code })

    tempSock.ev.on('connection.update', u => {
      if(u.connection==='open'){
        tempSock.end()
        setTimeout(startBot,3000)
      }
    })
  }catch(e){
    res.status(500).json({ error:'Pairing failed: '+e.message })
  }
})

// ================= SERVER =================
app.get('/',(_,res)=>res.sendFile(path.join(__dirname,'public/index.html')))
const PORT = process.env.PORT||3000
app.listen(PORT,()=>{console.log('🌐 SERVER RUNNING ON PORT:',PORT); startBot()})
