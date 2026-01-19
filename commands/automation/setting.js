const { doc, getDoc } = require('firebase/firestore');

module.exports = {
    name: 'settings',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        const ownerId = sock.user.id.split(':')[0];
        if (!m.sender.startsWith(ownerId)) return;

        const snap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const s = snap.exists() ? snap.data() : {};

        let resMsg = `╭─── • 🥀 • ───╮\n`;
        resMsg += `  ꜱ ʏ ꜱ ᴛ ᴇ ᴍ  ꜱ ᴇ ᴛ ᴛ ɪ ɴ ɢ ꜱ  \n`;
        resMsg += `╰─── • 🥀 • ───╯\n\n`;

        resMsg += `┌  🥀  *ᴀᴜᴛᴏᴍᴀᴛɪᴏɴ*\n`;
        resMsg += `│  ᴀɪ ᴄʜᴀᴛ: ${s.autoAI ? '✅' : '❌'}\n`;
        resMsg += `│  ᴀᴜᴛᴏ ᴛʏᴘɪɴɢ: ${s.autoType ? '✅' : '❌'}\n`;
        resMsg += `│  ᴀᴜᴛᴏ ʀᴇᴄᴏʀᴅɪɴɢ: ${s.autoRecord ? '✅' : '❌'}\n`;
        resMsg += `│  ᴀᴜᴛᴏ ꜱᴛᴀᴛᴜꜱ: ${s.autoStatus ? '✅' : '❌'}\n`;
        resMsg += `└──────────────\n\n`;

        resMsg += `┌  🥀  *ᴘʀɪᴠᴀᴄʏ*\n`;
        resMsg += `│  ᴀɴᴛɪ ᴅᴇʟᴇᴛᴇ: ${s.antiDelete ? '✅' : '❌'}\n`;
        resMsg += `│  ᴀɴᴛɪ ᴠɪᴇᴡ-ᴏɴᴄᴇ: ${s.antiViewOnce ? '✅' : '❌'}\n`;
        resMsg += `│  ᴀʟᴡᴀʏꜱ ᴏɴʟɪɴᴇ: ✅\n`;
        resMsg += `└──────────────\n\n`;

        resMsg += `┌  🥀  *ɢʀᴏᴜᴘ ꜱᴇᴄᴜʀɪᴛʏ*\n`;
        resMsg += `│  ᴀɴᴛɪ ʟɪɴᴋ: ${s.antiLink ? '✅' : '❌'}\n`;
        resMsg += `│  ᴀɴᴛɪ ᴘᴏʀɴ: ${s.antiPorn ? '✅' : '❌'}\n`;
        resMsg += `│  ᴀɴᴛɪ ꜱᴄᴀᴍ: ${s.antiScam ? '✅' : '❌'}\n`;
        resMsg += `└──────────────\n\n`;

        resMsg += `_ᴜꜱᴇ .ᴛᴏɢɢʟᴇ [ɴᴀᴍᴇ] ᴛᴏ ꜱᴡɪᴛᴄʜ_`;

        await sock.sendMessage(from, { text: resMsg, contextInfo: forwardedContext }, { quoted: m });
    }
};
