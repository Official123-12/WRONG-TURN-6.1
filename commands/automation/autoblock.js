const { doc, setDoc, getDoc } = require('firebase/firestore');

module.exports = {
    name: 'autoblock',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const ownerId = sock.user.id.split(':')[0];
        if (!m.key.fromMe && !m.sender.startsWith(ownerId)) return;

        const snap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const current = snap.exists() ? snap.data().autoBlock : false;

        await setDoc(doc(db, "SETTINGS", "GLOBAL"), { autoBlock: !current }, { merge: true });

        let res = `╭─── • 🥀 • ───╮\n`;
        res += `  ᴀ ᴜ ᴛ ᴏ  ʙ ʟ ᴏ ᴄ ᴋ  \n`;
        res += `╰─── • 🥀 • ───╯\n\n`;
        res += `🥀  ꜱᴛᴀᴛᴜꜱ: ${!current ? 'ᴇɴᴀʙʟᴇᴅ' : 'ᴅɪꜱᴀʙʟᴇᴅ'}\n\n`;
        res += `_ʙᴏᴛ: ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ_`;

        await sock.sendMessage(m.key.remoteJid, { text: res, contextInfo: forwardedContext });
    }
};
