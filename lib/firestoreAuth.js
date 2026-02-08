const { BufferJSON } = require('@whiskeysockets/baileys');
const { getDoc, setDoc, deleteDoc, doc, query, collection, where, getDocs } = require('firebase/firestore');

async function useFirebaseAuthState(db, collectionName, sessionId) {
    const fixId = (id) => `session_${sessionId}_${id.replace(/\//g, '__').replace(/\@/g, 'at')}`;
    const writeData = async (data, id) => setDoc(doc(db, collectionName, fixId(id)), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            if (snapshot.exists()) return JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver);
        } catch (e) { return null; }
        return null;
    };
    let creds = await readData('creds') || require('@whiskeysockets/baileys').initAuthCreds();
    return { state: { creds, keys: {
        get: async (type, ids) => {
            const data = {};
            await Promise.all(ids.map(async id => {
                let value = await readData(`${type}-${id}`);
                if (type === 'app-state-sync-key' && value) value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
                data[id] = value;
            }));
            return data;
        },
        set: async (data) => {
            for (const type in data) {
                for (const id in data[type]) {
                    const value = data[type][id];
                    if (value) await writeData(value, `${type}-${id}`);
                    else await deleteDoc(doc(db, collectionName, fixId(`${type}-${id}`)));
                }
            }
        }
    }}, saveCreds: () => writeData(creds, 'creds'), wipeSession: async () => {
        const q = query(collection(db, collectionName), where("__name__", ">=", `session_${sessionId}`), where("__name__", "<=", `session_${sessionId}\uf8ff`));
        const snap = await getDocs(q);
        for (const d of snap.docs) await deleteDoc(d.ref);
    }};
}
module.exports = { useFirebaseAuthState };
