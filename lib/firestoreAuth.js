const { BufferJSON } = require('@whiskeysockets/baileys');
const admin = require('firebase-admin');

async function useFirebaseAuthState(collection) {
    const fixId = (id) => id.replace(/\//g, '__').replace(/\@/g, 'at');
    const writeData = (data, id) => collection.doc(fixId(id)).set(JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    const readData = async (id) => {
        const doc = await collection.doc(fixId(id)).get();
        return doc.exists ? JSON.parse(JSON.stringify(doc.data()), BufferJSON.reviver) : null;
    };
    let creds = await readData('creds') || require('@whiskeysockets/baileys').initAuthCreds();
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = admin.security.proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            value ? await writeData(value, `${type}-${id}`) : await collection.doc(fixId(`${type}-${id}`)).delete().catch(() => {});
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}
module.exports = { useFirebaseAuthState };
