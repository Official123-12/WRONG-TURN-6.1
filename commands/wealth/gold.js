const axios = require('axios');

module.exports = {
    name: 'gold',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        try {
            const res = await axios.get('https://api.gold-api.com/price/XAU'); // Market Gold JID
            const data = res.data;
            
            let resMsg = `╭─── • 🥀 • ───╮\n   ᴘʀᴇᴄɪᴏᴜꜱ ᴍᴇᴛᴀʟꜱ \n╰─── • 🥀 • ───╯\n\n`;
            resMsg += `🥀  *ɢᴏʟᴅ* : $${data.price.toLocaleString()}\n`;
            resMsg += `🥀  *ᴍᴀʀᴋᴇᴛ* : ${data.market_status.toUpperCase()}\n`;
            resMsg += `🥀  *ᴛɪᴍᴇ* : ${new Date().toLocaleTimeString()}\n\n`;
            resMsg += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;

            await sock.sendMessage(from, { text: resMsg, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) { m.reply("Market data unavailable."); }
    }
};
