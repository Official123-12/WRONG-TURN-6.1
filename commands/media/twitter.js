const axios = require('axios');
module.exports = {
    name: 'twitter',
    async execute(m, sock, commands, args, db, forwardedContext) {
        if (!args[0]) return m.reply("ᴘʀᴏᴠɪᴅᴇ x/ᴛᴡɪᴛᴛᴇʀ ʟɪɴᴋ.");
        try {
            const res = await axios.get(`https://api.dhammasepun.me/api/twitter?url=${args[0]}`);
            const vid = res.data.result.HD || res.data.result.SD;
            let cap = `╭─── • 🥀 • ───╮\n  x  ᴅ ᴏ ᴡ ɴ ʟ ᴏ ᴀ ᴅ  \n╰─── • 🥀 • ───╯\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { video: { url: vid }, caption: cap, contextInfo: forwardedContext });
        } catch (e) { m.reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ."); }
    }
};
