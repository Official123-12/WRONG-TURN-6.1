const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const { collection, query, getDocs, writeBatch, doc, getDoc, setDoc, deleteDoc } = require('firebase/firestore');

/**
 * 🔐 WRONG TURN 6 - FIRESTORE AUTH ENGINE
 * Inaruhusu Multiple Users na inafuta kash (cache) zote kuzuia Linking Errors.
 */
const useFirebaseAuthState = async (db, collectionName, num) => {

    /**
     * 🧹 WIPE SESSION LOGIC
     * Hii inafuta kila kitu kinachohusu namba husika (creds, keys, sessions) 
     * kabla ya kutoa pairing code mpya.
     */
    const wipeSession = async () => {
        try {
            const snap = await getDocs(collection(db, collectionName));
            const batch = writeBatch(db);
            let count = 0;
            
            snap.forEach(d => {
                // Tunafuta documents zote zinazoanza na namba ya simu ya mtumiaji
                if (d.id.startsWith(num)) {
                    batch.delete(d.ref);
                    count++;
                }
            });
            
            if (count > 0) {
                await batch.commit();
                console.log(`🧹 Done! Swiped ${count} old session objects for ${num}`);
            }
        } catch (e) {
            console.error("❌ Wipe Error:", e);
        }
    };

    const readData = async (id) => {
        try {
            const snap = await getDoc(doc(db, collectionName, `${num}_${id}`));
            if (snap.exists()) {
                const data = JSON.stringify(snap.data());
                return JSON.parse(data, BufferJSON.reviver);
            }
        } catch (e) {
            return null;
        }
    };

    const writeData = async (data, id) => {
        try {
            const value = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
            await setDoc(doc(db, collectionName, `${num}_${id}`), value);
        } catch (e) {
            // Error handling kimya kimya
        }
    };

    const removeData = async (id) => {
        try {
            await deleteDoc(doc(db, collectionName, `${num}_${id}`));
        } catch (e) {}
    };

    // 🔑 Initialize credentials
    let creds = await readData('creds');
    if (!creds) {
        creds = initAuthCreds();
        await writeData(creds, 'creds');
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const sId = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(value, sId));
                            } else {
                                tasks.push(removeData(sId));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds'),
        wipeSession
    };
};

module.exports = { useFirebaseAuthState };
