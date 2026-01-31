const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { doc, getDoc, setDoc } = require('firebase/firestore');

async function useFirebaseAuthState(db, collectionName, sessionId) {
    const docRef = doc(db, collectionName, sessionId);
    
    const readState = async () => {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            return {
                creds: JSON.parse(data.creds || '{}', BufferJSON.reviver),
                keys: JSON.parse(data.keys || '{}', BufferJSON.reviver)
            };
        }
        return { creds: initAuthCreds(), keys: {} };
    };

    const saveState = async (state) => {
        await setDoc(docRef, {
            creds: JSON.stringify(state.creds, BufferJSON.replacer),
            keys: JSON.stringify(state.keys, BufferJSON.replacer),
            updatedAt: new Date().toISOString()
        });
    };

    const wipeSession = async () => {
        await setDoc(docRef, {
            creds: JSON.stringify(initAuthCreds(), BufferJSON.replacer),
            keys: JSON.stringify({}, BufferJSON.replacer),
            updatedAt: new Date().toISOString()
        });
    };

    const state = await readState();
    
    return {
        state,
        saveCreds: () => saveState(state),
        wipeSession
    };
}

module.exports = { useFirebaseAuthState };
