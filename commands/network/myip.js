const axios = require('axios');
module.exports = {
    name: 'myip',
    async execute(m, sock, commands, args, db, forwardedContext) {
        try {
            const res = await axios.get('https://api.ipify.org?format=json');
            let resMsg = `╭── • 🥀 • ──╮\n  ꜱ ʏ ꜱ ᴛ ᴇ ᴍ  ɪ ᴘ  \n╰── • 🥀 • ──╯\n\n│ ◦ ᴀᴅᴅʀᴇꜱꜱ: ${res.data.ip}\n│ ◦ ꜱᴛᴀᴛᴜꜱ: ꜱᴇᴄᴜʀᴇ\n└──────────────\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
        } catch (e) { m.reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴅᴇᴛᴇᴄᴛ ɪᴘ."); }
    }
};
