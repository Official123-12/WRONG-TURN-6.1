const { doc, setDoc, getDoc } = require('firebase/firestore');

module.exports = {
    name: 'toggle',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const ownerId = sock.user.id.split(':')[0];
        if (!m.key.fromMe && !m.sender.startsWith(ownerId)) return;

        const feature = args[0]?.toLowerCase();
        if (!feature) return sock.sendMessage(m.key.remoteJid, { text: "Provide a feature name to toggle." });

        const settingsRef = doc(db, "SETTINGS", "GLOBAL");
        const snap = await getDoc(settingsRef);
        const current = snap.exists() ? snap.data()[feature] : false;

        await setDoc(settingsRef, { [feature]: !current }, { merge: true });

        let status = !current ? "ᴀᴄᴛɪᴠᴀᴛᴇᴅ" : "ᴅᴇᴀᴄᴛɪᴠᴀᴛᴇᴅ";
        let res = `╭─── • 🥀 • ───╮\n`;
        res += `  ꜱ ʏ ꜱ ᴛ ᴇ ᴍ  ᴜ ᴘ ᴅ ᴀ ᴛ ᴇ  \n`;
        res += `╰─── • 🥀 • ───╯\n\n`;
        res += `🥀  ꜰᴇᴀᴛᴜʀᴇ: ${feature.toUpperCase()}\n`;
        res += `🥀  ꜱᴛᴀᴛᴜꜱ: ${status}\n\n`;
        res += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;

        await sock.sendMessage(m.key.remoteJid, { text: res, contextInfo: forwardedContext });
    }
};
