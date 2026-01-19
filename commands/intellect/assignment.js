const axios = require('axios');
module.exports = {
    name: 'assignment',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const query = args.join(" ");
        if (!query) return m.reply("Topic for the assignment?");
        const res = await axios.get(`https://text.pollinations.ai/Write%20a%20detailed%20college%20assignment%20on:%20${encodeURIComponent(query)}`);
        let resMsg = `╭── • 🥀 • ──╮\n  ᴀ ꜱ ꜱ ɪ ɢ ɴ ᴍ ᴇ ɴ ᴛ  \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
        await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
    }
};
