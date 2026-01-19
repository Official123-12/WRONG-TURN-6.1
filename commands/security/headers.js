const axios = require('axios');
module.exports = {
    name: 'headers',
    async execute(m, sock, commands, args, db, forwardedContext) {
        if (!args[0]) return m.reply("ᴜꜱᴀɢᴇ: .ʜᴇᴀᴅᴇʀꜱ ɢᴏᴏɢʟᴇ.ᴄᴏᴍ");
        try {
            const res = await axios.get(`https://api.hackertarget.com/httpheaders/?q=${args[0]}`);
            let resMsg = `╭── • 🥀 • ──╮\n  ʜ ᴛ ᴛ ᴘ  ʜ ᴇ ᴀ ᴅ ᴇ ʀ ꜱ \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
        } catch (e) { m.reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ʜᴇᴀᴅᴇʀꜱ."); }
    }
};
