const axios = require('axios');
module.exports = {
    name: 'ig',
    async execute(m, sock, commands, args, db, forwardedContext) {
        if (!args[0]) return m.reply("ᴘʀᴏᴠɪᴅᴇ ɪɴꜱᴛᴀɢʀᴀᴍ ʟɪɴᴋ.");
        try {
            const res = await axios.get(`https://api.dhammasepun.me/api/igdl?url=${args[0]}`);
            const media = res.data.result[0].url;
            
            let cap = `╭─── • 🥀 • ───╮\n  ɪ ɴ ꜱ ᴛ ᴀ  ᴅ ʟ  \n╰─── • 🥀 • ───╯\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { video: { url: media }, caption: cap, contextInfo: forwardedContext });
        } catch (e) { m.reply("ᴇʀʀᴏʀ: ᴘʀɪᴠᴀᴛᴇ ᴏʀ ɪɴᴠᴀʟɪᴅ ʟɪɴᴋ."); }
    }
};
