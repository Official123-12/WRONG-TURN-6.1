const admin = require("firebase-admin");
const { BufferJSON } = require("@whiskeysockets/baileys");

const serviceAccount = {
  "type": "service_account",
  "project_id": "stanybots",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDcpy6S8a0fJbRT\n...", // Weka ile key yako yote hapa
  "client_email": "firebase-adminsdk-fbsvc@stanybots.iam.gserviceaccount.com"
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// Hii inazuia 'Received an instance of Binary' errors
const saveSession = async (sessionId, data) => {
    const sessionData = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
    await db.collection('sessions').doc(sessionId).set({ payload: sessionData }, { merge: true });
};

const getSession = async (sessionId) => {
    const doc = await db.collection('sessions').doc(sessionId).get();
    if (!doc.exists) return null;
    return JSON.parse(JSON.stringify(doc.data().payload), BufferJSON.reviver);
};

module.exports = { db, saveSession, getSession };
