const { BufferJSON } = require('@whiskeysockets/baileys');

/**
 * WRONG TURN 6 - Firebase Session Handler
 * Developer: STANYTZ
 */

async function useFirebaseAuthState(collection) {
    // Kusafisha ID kuzuia error za Firestore (Firestore hairuhusu / na @ kwenye Document ID)
    const fixId = (id) => id.replace(/\//g, '__').replace(/\@/g, 'at');

    const writeData = (data, id) => {
        // Muhimu: Tunatumia BufferJSON.replacer kugeuza Binary kuwa String
        return collection.doc(fixId(id)).set(JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    };

    const readData = async (id) => {
        try {
            const doc = await collection.doc(fixId(id)).get();
            if (doc.exists) {
                // Muhimu: Tunatumia BufferJSON.reviver kurudisha String kuwa Binary
                return JSON.parse(JSON.stringify(doc.data()), BufferJSON.reviver);
            }
        } catch (e) {
            console.error("❌ Firebase Read Error:", e.message);
        }
        return null;
    };

    const removeData = async (id) => {
        try {
            await collection.doc(fixId(id)).delete();
        } catch (e) {}
    };

    // Pakia credentials kama zipo, la sivyo tengeneza mpya
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
