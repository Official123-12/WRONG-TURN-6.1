const axios = require('axios');
module.exports = {
    name: 'emailcheck',
    async execute(m, sock, commands, args, db, forwardedContext) {
        if (!args[0]) return m.reply("ᴘʀᴏᴠɪᴅᴇ ᴇᴍᴀɪɪʟ.");
        try {
            const res = await axios.get(`https://api.eva.pingutil.com/email?email=${args[0]}`);
            const d = res.data.data;
            let resMsg = `╭─── • 🥀 • ───╮\n`;
            resMsg += `  ᴇ ᴍ ᴀ ɪ ʟ  ꜱ ᴄ ᴀ ɴ  \n`;
            resMsg += `╰─── • 🥀 • ───╯\n\n`;
            resMsg += `│ ◦ ᴇᴍᴀɪʟ: ${d.email}\n`;
            resMsg += `│ ◦ ꜱᴛᴀᴛᴜꜱ: ${d.deliverable}\n`;
            resMsg += `│ ◦ ᴅɪꜱᴘᴏꜱᴀʙʟᴇ: ${d.disposable}\n`;
            resMsg += `│ ◦ ᴡᴇʙᴍᴀɪʟ: ${d.webmail}\n`;
            resMsg += `└──────────────\n\n`;
            resMsg += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
        } catch (e) { m.reply("ꜱᴄᴀɴ ꜰᴀɪʟᴇᴅ."); }
    }
};
