const axios = require('axios');

module.exports = {
    name: 'crypto',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        try {
            const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana,ripple&vs_currencies=usd');
            const d = res.data;
            
            let resMsg = `╭─── • 🥀 • ───╮\n`;
            resMsg += `   ᴄ ʀ ʏ ᴘ ᴛ ᴏ  ʜ ᴜ ʙ \n`;
            resMsg += `╰─── • 🥀 • ───╯\n\n`;
            resMsg += `🥀  *ʙᴛᴄ* : $${d.bitcoin.usd.toLocaleString()}\n`;
            resMsg += `🥀  *ᴇᴛʜ* : $${d.ethereum.usd.toLocaleString()}\n`;
            resMsg += `🥀  *ʙɴʙ* : $${d.binancecoin.usd.toLocaleString()}\n`;
            resMsg += `🥀  *ꜱᴏʟ* : $${d.solana.usd.toLocaleString()}\n`;
            resMsg += `🥀  *xʀᴘ* : $${d.ripple.usd.toLocaleString()}\n\n`;
            resMsg += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴyᴛᴢ_`;

            await sock.sendMessage(from, { text: resMsg, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: "⚠️ ᴄʀʏᴘᴛᴏ ᴀᴘɪ ᴜɴᴀᴠᴀɪʟᴀʙʟᴇ." });
        }
    }
};
