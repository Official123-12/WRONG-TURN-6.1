const { doc, setDoc, getDoc } = require('firebase/firestore');

module.exports = {
    name: 'scam',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const ownerId = sock.user.id.split(':')[0];
        if (!m.sender.startsWith(ownerId)) return;

        const action = args[0]; // 'add'
        const word = args.slice(1).join(" ");
        if (!action || !word) return sock.sendMessage(m.key.remoteJid, { text: "Usage: .scam add [keyword]" });

        const settingsRef = doc(db, "SETTINGS", ownerId);
        const snap = await getDoc(settingsRef);
        let currentScams = snap.exists() ? (snap.data().customScams || []) : [];

        if (!currentScams.includes(word.toLowerCase())) {
            currentScams.push(word.toLowerCase());
            await setDoc(settingsRef, { customScams: currentScams }, { merge: true });
        }

        await sock.sendMessage(m.key.remoteJid, { 
            text: `ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀\n\nAdded *${word}* to scam list.\nAny member sending this will be removed.`,
            contextInfo: forwardedContext
        });
    }
};
