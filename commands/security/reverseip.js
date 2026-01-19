const axios = require('axios');
module.exports = {
    name: 'reverseip',
    async execute(m, sock, commands, args, db, forwardedContext) {
        if (!args[0]) return m.reply("ᴘʀᴏᴠɪᴅᴇ ɪᴘ ᴏʀ ᴅᴏᴍᴀɪɴ.");
        try {
            const res = await axios.get(`https://api.hackertarget.com/reverseiplookup/?q=${args[0]}`);
            let resMsg = `╭── • 🥀 • ──╮\n  ʀ ᴇ ᴠ ᴇ ʀ ꜱ ᴇ  ɪ ᴘ  \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
        } catch (e) { m.reply("ʀᴇᴠᴇʀꜱᴇ ɪᴘ ꜰᴀɪʟᴇᴅ."); }
    }
};
