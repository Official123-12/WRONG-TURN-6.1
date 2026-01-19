const axios = require('axios');
module.exports = {
    name: 'codeai',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const query = args.join(" ");
        if (!query) return m.reply("Describe the code you need.");
        const res = await axios.get(`https://text.pollinations.ai/Write%20clean%20efficient%20code%20for:%20${encodeURIComponent(query)}`);
        let resMsg = `╭── • 🥀 • ──╮\n  ᴄ ᴏ ᴅ ᴇ  ᴀ ɪ  \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
        await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
    }
};
