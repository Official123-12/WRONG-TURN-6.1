const axios = require('axios');
module.exports = {
    name: 'physics',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const query = args.join(" ");
        if (!query) return m.reply("Provide a physics question.");
        const res = await axios.get(`https://text.pollinations.ai/Solve%20this%20physics%20problem%20using%20formulas%20and%20explanations:%20${encodeURIComponent(query)}`);
        let resMsg = `╭── • 🥀 • ──╮\n  ᴘ ʜ ʏ ꜱ ɪ ᴄ ꜱ  \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
        await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
    }
};
