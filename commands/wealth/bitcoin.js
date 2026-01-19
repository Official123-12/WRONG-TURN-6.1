const axios = require('axios');

module.exports = {
    name: 'bitcoin',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        try {
            const res = await axios.get('https://api.coindesk.com/v1/bpi/currentprice.json');
            const data = res.data.bpi.USD;
            
            let resMsg = `╭─── • 🥀 • ───╮\n`;
            resMsg += `  ʙ ɪ ᴛ ᴄ ᴏ ɪ ɴ  ᴡ ᴀ ᴛ ᴄ ʜ \n`;
            resMsg += `╰─── • 🥀 • ───╯\n\n`;
            resMsg += `🥀  *ᴘʀɪᴄᴇ* : $${data.rate}\n`;
            resMsg += `🥀  *ꜱʏᴍʙᴏʟ* : ʙᴛᴄ\n`;
            resMsg += `🥀  *ᴜᴘᴅᴀᴛᴇᴅ* : ${new Date().toLocaleTimeString()}\n\n`;
            resMsg += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;

            await sock.sendMessage(from, { text: resMsg, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: "⚠️ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ʙɪᴛᴄᴏɪɴ ᴅᴀᴛᴀ." });
        }
    }
};
