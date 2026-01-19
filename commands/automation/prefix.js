const { doc, setDoc } = require('firebase/firestore');

module.exports = {
    name: 'prefix',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const ownerId = sock.user.id.split(':')[0];
        if (!m.key.fromMe && !m.sender.startsWith(ownerId)) return;

        const newPrefix = args[0];
        if (!newPrefix || newPrefix.length > 1) return m.reply("Provide a single character prefix.");

        await setDoc(doc(db, "SETTINGS", "GLOBAL"), { prefix: newPrefix }, { merge: true });

        let res = `╭─── • 🥀 • ───╮\n`;
        res += `  ᴘ ʀ ᴇ ꜰ ɪ x  ꜱ ᴇ ᴛ  \n`;
        res += `╰─── • 🥀 • ───╯\n\n`;
        res += `🥀  ɴᴇᴡ ᴘʀᴇꜰɪx: [ ${newPrefix} ]\n\n`;
        res += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;

        await sock.sendMessage(m.key.remoteJid, { text: res, contextInfo: forwardedContext });
    }
};
