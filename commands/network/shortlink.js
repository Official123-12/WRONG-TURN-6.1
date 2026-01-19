const axios = require('axios');
module.exports = {
    name: 'shortlink',
    async execute(m, sock, commands, args, db, forwardedContext) {
        if (!args[0]) return m.reply("ᴘʀᴏᴠɪᴅᴇ ᴀ ʟɪɴᴋ.");
        try {
            const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(args[0])}`);
            let resMsg = `╭── • 🥀 • ──╮\n  ꜱ ʜ ᴏ ʀ ᴛ  ʟ ɪ ɴ ᴋ  \n╰── • 🥀 • ──╯\n\n│ ◦ ᴏʀɪɢɪɴᴀʟ: ${args[0]}\n│ ◦ ꜱʜᴏʀᴛ: ${res.data}\n└──────────────\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
        } catch (e) { m.reply("ꜱʜᴏʀᴛᴇɴɪɴɢ ꜰᴀɪʟᴇᴅ."); }
    }
};
