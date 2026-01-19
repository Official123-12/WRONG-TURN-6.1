const axios = require('axios');
module.exports = {
    name: 'homework',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const query = args.join(" ");
        if (!query) return m.reply("What is your homework question?");
        const res = await axios.get(`https://text.pollinations.ai/Explain%20this%20homework%20topic%20simply:%20${encodeURIComponent(query)}`);
        let resMsg = `╭── • 🥀 • ──╮\n  ʜ ᴏ ᴍ ᴇ ᴡ ᴏ ʀ ᴋ  \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
        await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
    }
};
