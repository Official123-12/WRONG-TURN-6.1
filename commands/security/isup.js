const axios = require('axios');
module.exports = {
    name: 'isup',
    async execute(m, sock, commands, args, db, forwardedContext) {
        if (!args[0]) return m.reply("ᴘʀᴏᴠɪᴅᴇ ᴀ ᴜʀʟ.");
        try {
            const res = await axios.get(`https://api.popcat.xyz/isup?url=${encodeURIComponent(args[0])}`);
            let resMsg = `╭── • 🥀 • ──╮\n  ꜱ ɪ ᴛ ᴇ  ꜱ ᴛ ᴀ ᴛ ᴜ ꜱ  \n╰── • 🥀 • ──╯\n\n│ ◦ ᴛᴀʀɢᴇᴛ: ${args[0]}\n│ ◦ ꜱᴛᴀᴛᴜꜱ: ${res.data.status}\n└──────────────\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
        } catch (e) { m.reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴄʜᴇᴄᴋ ꜱᴛᴀᴛᴜꜱ."); }
    }
};
