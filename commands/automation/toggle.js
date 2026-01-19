const { doc, setDoc, getDoc } = require('firebase/firestore');

module.exports = {
    name: 'toggle',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const feature = args[0]?.toLowerCase();
        if (!feature) return sock.sendMessage(m.key.remoteJid, { text: "Usage: .toggle [feature_name]" });

        const settingsRef = doc(db, "SETTINGS", "GLOBAL");
        const snap = await getDoc(settingsRef);
        const current = snap.exists() ? snap.data()[feature] : false;

        await setDoc(settingsRef, { [feature]: !current }, { merge: true });

        await sock.sendMessage(m.key.remoteJid, { 
            text: `WRONG TURN BOT ✔️\n\nFeature *${feature.toUpperCase()}* is now ${!current ? 'ENABLED' : 'DISABLED'}.\n\nDeveloper: STANYTZ`,
            contextInfo: forwardedContext 
        });
    }
};
