const {
  initAuthCreds,
  BufferJSON
} = require('@whiskeysockets/baileys')

const { doc, getDoc, setDoc } = require('firebase/firestore')

module.exports = async function useFirebaseAuthState(db, col, session) {
  const fixId = id =>
    `${session}_${id.replace(/\//g, '__').replace(/@/g, 'at')}`

  const write = async (data, id) =>
    setDoc(
      doc(db, col, fixId(id)),
      JSON.parse(JSON.stringify(data, BufferJSON.replacer))
    )

  const read = async id => {
    try {
      const snap = await getDoc(doc(db, col, fixId(id)))
      return snap.exists()
        ? JSON.parse(JSON.stringify(snap.data()), BufferJSON.reviver)
        : null
    } catch {
      return null
    }
  }

  const creds = (await read('creds')) || initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {}
          for (const id of ids) {
            data[id] = await read(`${type}-${id}`)
          }
          return data
        },
        set: async data => {
          for (const type in data) {
            for (const id in data[type]) {
              await write(data[type][id], `${type}-${id}`)
            }
          }
        }
      }
    },
    saveCreds: () => write(creds, 'creds')
  }
}
