const axios = require('axios');

module.exports = {
    name: 'forex',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        try {
            const res = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
            const r = res.data.rates;
            
            let resMsg = `╭─── • 🥀 • ───╮\n`;
            resMsg += `   ꜰ ᴏ ʀ ᴇ x  ʟ ɪ ᴠ ᴇ \n`;
            resMsg += `╰─── • 🥀 • ───╯\n\n`;
            resMsg += `🥀  *ᴇᴜʀ/ᴜꜱᴅ* : ${(1/r.EUR).toFixed(4)}\n`;
            resMsg += `🥀  *ɢʙᴘ/ᴜꜱᴅ* : ${(1/r.GBP).toFixed(4)}\n`;
            resMsg += `🥀  *ᴜꜱᴅ/ᴊᴘʏ* : ${r.JPY.toFixed(2)}\n`;
            resMsg += `🥀  *ᴜꜱᴅ/ᴄᴀᴅ* : ${r.CAD.toFixed(4)}\n\n`;
            resMsg += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;

            await sock.sendMessage(from, { text: resMsg, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: "⚠️ ꜰᴏʀᴇx ꜱᴇʀᴠᴇʀ ᴅᴏᴡɴ." });
        }
    }
};
