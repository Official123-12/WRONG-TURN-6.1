const axios = require('axios');
module.exports = {
    name: 'cv',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const query = args.join(" ");
        if (!query) return m.reply("Provide your name, skills, and experience.");
        const res = await axios.get(`https://text.pollinations.ai/Create%20a%20professional%20CV%20layout%20for:%20${encodeURIComponent(query)}`);
        let resMsg = `╭── • 🥀 • ──╮\n  ᴄ ᴠ  ᴡ ʀ ɪ ᴛ ᴇ ʀ  \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
        await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
    }
};
