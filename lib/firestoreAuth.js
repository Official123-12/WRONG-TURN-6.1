const { BufferJSON, initAuthCreds, proto } = require('xmd-baileys');
const { doc, getDoc, setDoc, deleteDoc } = require('firebase/firestore');

const useFirebaseAuthState = async (db, collectionName, sessionId) => {
    const sessionDoc = doc(db, collectionName, sessionId);
    const writeData = async (data, id) => {
        const key = `${sessionId}_${id}`;
        await setDoc(doc(db, "AUTH_KEYS", key), { data: JSON.stringify(data, BufferJSON.replacer) });
    };
    const readData = async (id) => {
        const key = `${sessionId}_${id}`;
        const snap = await getDoc(doc(db, "AUTH_KEYS", key));
        if (snap.exists()) return JSON.parse(snap.data().data, BufferJSON.reviver);
        return null;
    };
    const removeData = async (id) => {
        const key = `${sessionId}_${id}`;
        await deleteDoc(doc(db, "AUTH_KEYS", key));
    };
    const snap = await getDoc(sessionDoc);
    let creds = snap.exists() ? JSON.parse(snap.data().creds, BufferJSON.reviver) : initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            if (value) await writeData(value, `${type}-${id}`);
                            else await removeData(`${type}-${id}`);
                        }
                    }
                }
            }
        },
        saveCreds: async () => { await setDoc(sessionDoc, { creds: JSON.stringify(creds, BufferJSON.replacer) }); },
        clearSession: async () => { await deleteDoc(sessionDoc); }
    };
};
module.exports = { useFirebaseAuthState };
