const axios = require('axios');
module.exports = {
    name: 'essay',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const query = args.join(" ");
        if (!query) return m.reply("What is the essay topic?");
        const res = await axios.get(`https://text.pollinations.ai/Write%20a%20high-quality%20academic%20essay%20on:%20${encodeURIComponent(query)}`);
        let resMsg = `╭── • 🥀 • ──╮\n  ᴇ ꜱ ꜱ ᴀ ʏ  ɢ ᴇ ɴ  \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
        await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
    }
};
