const axios = require('axios');
module.exports = {
    name: 'subnet',
    async execute(m, sock, commands, args, db, forwardedContext) {
        if (!args[0]) return m.reply("ᴘʀᴏᴠɪᴅᴇ ɪᴘ/ᴍᴀꜱᴋ.");
        try {
            const res = await axios.get(`https://api.hackertarget.com/subnetcalc/?q=${args[0]}`);
            let resMsg = `╭── • 🥀 • ──╮\n  ꜱ ᴜ ʙ ɴ ᴇ ᴛ  ᴄ ᴀ ʟ ᴄ \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
        } catch (e) { m.reply("ᴄᴀʟᴄᴜʟᴀᴛɪᴏɴ ꜰᴀɪʟᴇᴅ."); }
    }
};
