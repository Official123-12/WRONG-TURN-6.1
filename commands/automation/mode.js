const { doc, setDoc } = require('firebase/firestore');

module.exports = {
    name: 'mode',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const ownerId = sock.user.id.split(':')[0];
        if (!m.key.fromMe && !m.sender.startsWith(ownerId)) return;

        const mode = args[0]?.toLowerCase();
        if (mode !== 'public' && mode !== 'private') return m.reply("Usage: .mode public | .mode private");

        await setDoc(doc(db, "SETTINGS", "GLOBAL"), { mode: mode }, { merge: true });

        let res = `╭─── • 🥀 • ───╮\n`;
        res += `  ꜱ ʏ ꜱ ᴛ ᴇ ᴍ  ᴍ ᴏ ᴅ ᴇ  \n`;
        res += `╰─── • 🥀 • ───╯\n\n`;
        res += `🥀  ꜱᴛᴀᴛᴜꜱ: ${mode.toUpperCase()}\n\n`;
        res += `_ʙᴏᴛ: ᴡʀᴏɴɢ ᴛᴜʀɴ ʙᴏᴛ_`;

        await sock.sendMessage(m.key.remoteJid, { text: res, contextInfo: forwardedContext });
    }
};
