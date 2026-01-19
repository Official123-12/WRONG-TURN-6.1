const axios = require('axios');
module.exports = {
    name: 'summary',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const query = args.join(" ");
        if (!query) return m.reply("Paste the text you want to summarize.");
        const res = await axios.get(`https://text.pollinations.ai/Summarize%20the%20following%20text%20briefly%20in%20bullet%20points:%20${encodeURIComponent(query)}`);
        let resMsg = `╭── • 🥀 • ──╮\n  ꜱ ᴜ ᴍ ᴍ ᴀ ʀ ʏ  \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
        await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
    }
};
