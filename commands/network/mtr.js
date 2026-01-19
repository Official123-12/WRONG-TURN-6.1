const axios = require('axios');
module.exports = {
    name: 'mtr',
    async execute(m, sock, commands, args, db, forwardedContext) {
        if (!args[0]) return m.reply("ᴘʀᴏᴠɪᴅᴇ ᴀ ᴛᴀʀɢᴇᴛ.");
        try {
            const res = await axios.get(`https://api.hackertarget.com/mtr/?q=${args[0]}`);
            let resMsg = `╭── • 🥀 • ──╮\n  ᴍ ᴛ ʀ  ᴛ ʀ ᴀ ᴄ ᴇ  \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
        } catch (e) { m.reply("ᴍᴛʀ ꜰᴀɪʟᴇᴅ."); }
    }
};
