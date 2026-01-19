const axios = require('axios');
module.exports = {
    name: 'portscan',
    async execute(m, sock, commands, args, db, forwardedContext) {
        if (!args[0]) return m.reply("ᴜꜱᴀɢᴇ: .ᴘᴏʀᴛꜱᴄᴀɴ ɢᴏᴏɢʟᴇ.ᴄᴏᴍ");
        try {
            const res = await axios.get(`https://api.hackertarget.com/nmap/?q=${args[0]}`);
            let resMsg = `╭─── • 🥀 • ───╮\n`;
            resMsg += `  ᴘ ᴏ ʀ ᴛ  ꜱ ᴄ ᴀ ɴ  \n`;
            resMsg += `╰─── • 🥀 • ───╯\n\n`;
            resMsg += `${res.data}\n\n`;
            resMsg += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
        } catch (e) { m.reply("ꜱᴄᴀɴ ꜰᴀɪʟᴇᴅ."); }
    }
};
