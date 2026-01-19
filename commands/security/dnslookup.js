const axios = require('axios');
module.exports = {
    name: 'dnslookup',
    async execute(m, sock, commands, args, db, forwardedContext) {
        if (!args[0]) return m.reply("ᴘʀᴏᴠɪᴅᴇ ᴀ ᴅᴏᴍᴀɪɴ.");
        try {
            const res = await axios.get(`https://api.hackertarget.com/dnslookup/?q=${args[0]}`);
            let resMsg = `╭── • 🥀 • ──╮\n  ᴅ ɴ ꜱ  ʀ ᴇ ᴄ ᴏ ʀ ᴅ ꜱ \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
        } catch (e) { m.reply("ᴅɴꜱ ʟᴏᴏᴋᴜᴘ ꜰᴀɪʟᴇᴅ."); }
    }
};
