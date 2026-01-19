const axios = require('axios');

module.exports = {
    name: 'crypto',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        const coins = ["ʙɪᴛᴄᴏɪɴ", "ᴇᴛʜᴇʀᴇᴜᴍ", "ʙɪɴᴀɴᴄᴇ ᴄᴏɪɴ", "ꜱᴏʟᴀɴᴀ", "xʀᴘ", "ᴄᴀʀᴅᴀɴᴏ", "ᴅᴏɢᴇᴄᴏɪɴ", "ᴛʀᴏɴ", "ᴘᴏʟᴋᴀᴅᴏᴛ", "ꜱʜɪʙᴀ ɪɴᴜ"];

        if (!args[0]) {
            let list = `╭─── • 🥀 • ───╮\n  ᴄʀʏᴘᴛᴏ ᴍᴀʀᴋᴇᴛ \n╰─── • 🥀 • ───╯\n\n`;
            list += `ꜱᴇʟᴇᴄᴛ ᴀ ᴄᴏɪɴ ᴛᴏ ᴀɴᴀʟʏᴢᴇ:\n\n`;
            coins.forEach((c, i) => list += `${i + 1}. ${c}\n`);
            return sock.sendMessage(from, { text: list, contextInfo: forwardedContext }, { quoted: m });
        }

        const choice = parseInt(args[0]);
        if (choice >= 1 && choice <= 10) {
            const coinId = ["bitcoin", "ethereum", "binancecoin", "solana", "ripple", "cardano", "dogecoin", "tron", "polkadot", "shiba-inu"][choice - 1];
            try {
                const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`);
                const data = res.data[coinId];
                
                let resMsg = `╭─── • 🥀 • ───╮\n   ᴄᴏɪɴ ꜱᴛᴀᴛꜱ \n╰─── • 🥀 • ───╯\n\n`;
                resMsg += `🥀  *ɴᴀᴍᴇ* : ${coins[choice-1]}\n`;
                resMsg += `🥀  *ᴘʀɪᴄᴇ* : $${data.usd.toLocaleString()}\n`;
                resMsg += `🥀  *𝟸𝟺ʜ ᴄʜᴀɴɢᴇ* : ${data.usd_24h_change.toFixed(2)}%\n\n`;
                resMsg += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
                await sock.sendMessage(from, { text: resMsg, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) { m.reply("Crypto API Error."); }
        }
    }
};
