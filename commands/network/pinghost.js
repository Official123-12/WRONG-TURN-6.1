const axios = require('axios');
module.exports = {
    name: 'pinghost',
    async execute(m, sock, commands, args, db, forwardedContext) {
        if (!args[0]) return m.reply("ᴘʀᴏᴠɪᴅᴇ ᴀ ʜᴏꜱᴛ (ᴇ.ɢ. ɢᴏᴏɢʟᴇ.ᴄᴏᴍ)");
        try {
            const res = await axios.get(`https://api.hackertarget.com/nping/?q=${args[0]}`);
            let resMsg = `╭── • 🥀 • ──╮\n  ᴘ ɪ ɴ ɢ  ʜ ᴏ ꜱ ᴛ  \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
        } catch (e) { m.reply("ᴘɪɴɢ ꜰᴀɪʟᴇᴅ."); }
    }
};
