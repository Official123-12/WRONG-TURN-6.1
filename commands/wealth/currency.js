const axios = require('axios');

module.exports = {
    name: 'currency',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        if (!args[2]) return sock.sendMessage(from, { text: "ᴜꜱᴀɢᴇ: .ᴄᴜʀʀᴇɴᴄʏ [ᴀᴍᴏᴜɴᴛ] [ꜰʀᴏᴍ] [ᴛᴏ]\nᴇx: .ᴄᴜʀʀᴇɴᴄʏ 100 ᴜꜱᴅ ᴛᴢꜱ" });

        try {
            const amount = args[0];
            const fromCurr = args[1].toUpperCase();
            const toCurr = args[2].toUpperCase();
            const res = await axios.get(`https://api.exchangerate-api.com/v4/latest/${fromCurr}`);
            const rate = res.data.rates[toCurr];
            const result = (amount * rate).toLocaleString();

            let resMsg = `╭─── • 🥀 • ───╮\n`;
            resMsg += `  ᴄ ᴏ ɴ ᴠ ᴇ ʀ ꜱ ɪ ᴏ ɴ \n`;
            resMsg += `╰─── • 🥀 • ───╯\n\n`;
            resMsg += `🥀  *ɪɴᴘᴜᴛ* : ${amount} ${fromCurr}\n`;
            resMsg += `🥀  *ᴏᴜᴛᴘᴜᴛ* : ${result} ${toCurr}\n`;
            resMsg += `🥀  *ʀᴀᴛᴇ* : ${rate.toFixed(2)}\n\n`;
            resMsg += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;

            await sock.sendMessage(from, { text: resMsg, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: "⚠️ ɪɴᴠᴀʟɪᴅ ᴄᴜʀʀᴇɴᴄʏ ᴄᴏᴅᴇ." });
        }
    }
};
