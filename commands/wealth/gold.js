const axios = require('axios');

module.exports = {
    name: 'gold',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        try {
            // Using a public financial aggregator API
            const res = await axios.get('https://api.gold-api.com/price/XAU');
            const data = res.data;
            
            let resMsg = `╭─── • 🥀 • ───╮\n`;
            resMsg += `   ɢ ᴏ ʟ ᴅ  ᴘ ʀ ɪ ᴄ ᴇ \n`;
            resMsg += `╰─── • 🥀 • ───╯\n\n`;
            resMsg += `🥀  *ᴘʀɪᴄᴇ* : $${data.price.toLocaleString()}\n`;
            resMsg += `🥀  *ᴜɴɪᴛ* : 1 ᴏᴜɴᴄᴇ (xᴀᴜ)\n`;
            resMsg += `🥀  *ᴍᴀʀᴋᴇᴛ* : ${data.market_status.toUpperCase()}\n\n`;
            resMsg += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;

            await sock.sendMessage(from, { text: resMsg, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: "⚠️ ɢᴏʟᴅ ᴍᴀʀᴋᴇᴛ ᴀᴘɪ ᴇʀʀᴏʀ." });
        }
    }
};
