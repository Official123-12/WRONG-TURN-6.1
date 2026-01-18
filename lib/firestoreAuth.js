const { BufferJSON } = require('@whiskeysockets/baileys');
const { getDoc, setDoc, deleteDoc, doc } = require('firebase/firestore');

async function useFirebaseAuthState(db, collectionName) {
    const fixId = (id) => id.replace(/\//g, '__').replace(/\@/g, 'at');

    const writeData = async (data, id) => {
        const cleanData = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
        return await setDoc(doc(db, collectionName, fixId(id)), cleanData);
    };

    const readData = async (id) => {
        try {
            const snapshot = await getDoc(doc(db, collectionName, fixId(id)));
            if (snapshot.exists()) {
                return JSON.parse(JSON.stringify(snapshot.data()), BufferJSON.reviver);
            }
        } catch (e) { return null; }
        return null;
    };

    const removeData = async (id) => {
        try { await deleteDoc(doc(db, collectionName, fixId(id))); } catch (e) {}
    };

    const creds = await readData('creds') || require('@whiskeysockets/baileys').initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            const { proto } = require('@whiskeysockets/baileys');
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
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
        saveCreds: () => writeData(creds, 'creds')
    };
}

module.exports = { useFirebaseAuthState };
