const { doc, setDoc, getDoc } = require('firebase/firestore');

module.exports = {
    name: 'toggle',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const ownerId = sock.user.id.split(':')[0];
        if (!m.sender.startsWith(ownerId)) return;

        const feature = args[0]?.toLowerCase();
        if (!feature) return sock.sendMessage(m.key.remoteJid, { text: "Usage: .toggle [feature]" });

        const settingsRef = doc(db, "SETTINGS", "GLOBAL");
        const snap = await getDoc(settingsRef);
        const current = snap.exists() ? snap.data()[feature] : false;

        await setDoc(settingsRef, { [feature]: !current }, { merge: true });

        await sock.sendMessage(m.key.remoteJid, { 
            text: `ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ 🥀\n\nꜰᴇᴀᴛᴜʀᴇ: *${feature.toUpperCase()}*\nꜱᴛᴀᴛᴜꜱ: ${!current ? 'ᴀᴄᴛɪᴠᴀᴛᴇᴅ' : 'ᴅᴇᴀᴄᴛɪᴠᴀᴛᴇᴅ'}`,
            contextInfo: forwardedContext
        });
    }
};
