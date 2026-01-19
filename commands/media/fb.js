const axios = require('axios');
module.exports = {
    name: 'fb',
    async execute(m, sock, commands, args, db, forwardedContext) {
        if (!args[0]) return m.reply("ᴘʀᴏᴠɪᴅᴇ ꜰᴀᴄᴇʙᴏᴏᴋ ʟɪɴᴋ.");
        try {
            const res = await axios.get(`https://api.dhammasepun.me/api/fbdl?url=${args[0]}`);
            const vid = res.data.result.hd || res.data.result.sd;
            let cap = `╭─── • 🥀 • ───╮\n  ꜰ ʙ  ᴅ ᴏ ᴡ ɴ ʟ ᴏ ᴀ ᴅ  \n╰─── • 🥀 • ───╯\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { video: { url: vid }, caption: cap, contextInfo: forwardedContext });
        } catch (e) { m.reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴠɪᴅᴇᴏ."); }
    }
};
