const { doc, setDoc } = require('firebase/firestore');

module.exports = {
    name: 'prefix',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const ownerId = sock.user.id.split(':')[0];
        if (!m.sender.startsWith(ownerId)) return;

        const newPrefix = args[0];
        if (!newPrefix || newPrefix.length > 1) return m.reply("ᴘʀᴏᴠɪᴅᴇ ᴀ ꜱɪɴɢʟᴇ ᴄʜᴀʀᴀᴄᴛᴇʀ (ᴇ.ɢ. !)");

        await setDoc(doc(db, "SETTINGS", "GLOBAL"), { prefix: newPrefix }, { merge: true });

        let res = `╭─── • 🥀 • ───╮\n  ᴘʀᴇꜰɪx ᴜᴘᴅᴀᴛᴇ  \n╰─── • 🥀 • ───╯\n\n`;
        res += `🥀 *ɴᴇᴡ ᴘʀᴇꜰɪx* : [ ${newPrefix} ]\n\n`;
        res += `_ʙᴏᴛ ᴡɪʟʟ ɴᴏᴡ ʀᴇꜱᴘᴏɴᴅ ᴛᴏ ${newPrefix}_`;

        await sock.sendMessage(m.key.remoteJid, { text: res, contextInfo: forwardedContext });
    }
};
