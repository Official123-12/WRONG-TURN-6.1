const admin = require("firebase-admin");
const { BufferJSON } = require("@whiskeysockets/baileys");

// YOUR EXACT KEY WITH NEWLINE FIX APPLIED
const serviceAccount = {
  "type": "service_account",
  "project_id": "stanybots",
  "private_key_id": "746be8a70fe0db83f0436d9d030c46c47d7c84f6",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDcpy6S8a0fJbRT\n7mcDBeJgh1Q4i0M296SiI/fq6YkJ5adOh9zQd70Km5tLttt9IajHJ1NdSjZLSnGT\n3NSTsvUxB2PoWPSZtqsL0AyDLmoJx3PEGel5EBvPpD3NWfu9kaTdF9OMKuu2WZUj\nxW4S9HX0M9KAuSCdTFRVCWFozEqf2e+7Obhj8bFIUbUICjqLSh9SsKtxdGxJ9wq0\n6BttfemM2/GhseCuRfu7/0bmiYjbqAwGTEuw3uuKW6+r6sQV5+068E3yjAIgYj3B\n82v7Zwt8XytJfGa6CV+Kj1esHytQPJJ4+x5fpwW0b0mMq6y6Tp77+wiqXQwle5zB\n6rI5CzxnAgMBAAECggEAFEgpt8gPKbXFhZF8VoLL9CN8UlY6r2rD70NvHmCpAAfk\nAQvr+B2JetgixirgsffOE8BBoWmY5ALLvdOmloz0jLUpMco7cYWg400UWVqC1LNI\nqNXY6A/a/pMSOzXyNdKVXN07zL6FPBWv58HWBFgEH5ZD2yEpJkxF1CswkPl2QosR\n/zqeRYuYjWRica/ztaizNk+NC4cy7h0uqiLzA0BYJn/ZTkOypTkYvUafoQEKxtsp\nvZrEQ+d4p/2wLYF9SnWv218Y9b5fsZJESzaUQbNazNZwcNaSFFYmiY2dTm5pleOU\nPfFcYm8eQukVxcN4KORWc7BmUxaxBGHW+1mBSyX3QQKBgQD84KRIMODhT5sP3bel\nDFOVKOg3i6PhUMigkXrXJIUsHPibd63pnVEeXr850fVuRBVERXjpBlC+aMoA90Tz\nzaSLILPY5WIniePLH6ben5T3wC9iYU0wO3ZkwJqW1jZ47CfCnxrmv70TpuPP/kKc\nMnMDyxMpb4zCHzG6YREVIXYeRQKBgQDfYK1XtuVgaxMf+kjV2jp/U3t54uobPH3D\n65pDrnslLZfe6eNJ+woHlxKgTgFqJnMjLGff1Tu1e7t99CbieRfEplmCyNttzHdm\nKXyCzr+G+llgkNpvfIZHS6ZEksay41oTcO0JkSVpTCCxs2osOSICM6yhi9qnYvre\nE/7QOviguwKBgQDbJ2CYw+uQuKnc5T0LyBQD2BDwWo+rbJSDO7FnFNppMa5vJhhN\nty4fEOPPG1wFtPFtWnwAD54Ydr5ieemDFXx9qtjSp3EabRFC72px04GJ+T/XlhYM\nL+xaQuV2xa0tvRR0QelRg2g8yMz0bBmUPtCYv/0aUvd9IQW6zfa9BmPUtQKBgC42\nG+ZHihB2VlCJQMQtD2kD5kmC7heQXhxIA3P5BrTcR8zv6fuGGb8UO+A6AwToy2z9\ZMfjnySeYl1eQyUbFBW0rFPoJa0DXbge4QlWqDzOUesuTGJACq95MP6CtuSPMDVR\naVhPVMQB4cmhaleXwjdeZVpOSn/SdD+5Nz/w0zq9AoGAO7j7hc9SRacoTUU2MJOT\n6+y8q1hFUuOb+tb3LwHzkdQ5kyHyNs5PT0Ib994jAon7Ocfl8bL6ILtNDMBiKVXf\nkg3B0lPkRSW+cDAUAENasCH3OrQrlYVceYnmu/Yc2K3nOvoJS2BLiGa/aCjCPHE2\nNVhK+Ycb7OpMDt2fyWIkyEY=\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n'), // CRITICAL FIX APPLIED HERE
  "client_email": "firebase-adminsdk-fbsvc@stanybots.iam.gserviceaccount.com",
  "client_id": "103847718279811211149",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40stanybots.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

// Initialize Firebase correctly
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("🔥 Firebase Admin Connected Successfully");
    } catch (error) {
        console.error("❌ Firebase Initialization Error:", error);
    }
}

const db = admin.firestore();

// Session Management with BufferJSON to prevent Binary Errors
const saveSession = async (id, data) => {
    try {
        const cleanData = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
        await db.collection('sessions').doc(id).set({ payload: cleanData }, { merge: true });
    } catch (e) {
        console.error("Error saving session to Firebase:", e);
    }
};

const getSession = async (id) => {
    try {
        const doc = await db.collection('sessions').doc(id).get();
        if (!doc.exists) return null;
        return JSON.parse(JSON.stringify(doc.data().payload), BufferJSON.reviver);
    } catch (e) {
        console.error("Error fetching session from Firebase:", e);
        return null;
    }
};

module.exports = { db, saveSession, getSession };
