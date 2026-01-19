const axios = require('axios');
module.exports = {
    name: 'math',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const query = args.join(" ");
        if (!query) return m.reply("Provide a math problem.");
        const res = await axios.get(`https://text.pollinations.ai/Solve%20this%20math%20problem%20step%20by%20step:%20${encodeURIComponent(query)}`);
        let resMsg = `╭── • 🥀 • ──╮\n  ᴍ ᴀ ᴛ ʜ  ᴀ ɪ  \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
        await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
    }
};
