const axios = require('axios');
module.exports = {
    name: 'whois',
    async execute(m, sock, commands, args, db, forwardedContext) {
        if (!args[0]) return m.reply("ᴘʀᴏᴠɪᴅᴇ ᴀ ᴅᴏᴍᴀɪɴ.");
        try {
            const res = await axios.get(`https://api.hackertarget.com/whois/?q=${args[0]}`);
            let resMsg = `╭── • 🥀 • ──╮\n  ᴡ ʜ ᴏ ɪ ꜱ  ᴅ ᴀ ᴛ ᴀ  \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
        } catch (e) { m.reply("ᴡʜᴏɪꜱ ꜰᴀɪʟᴇᴅ."); }
    }
};
