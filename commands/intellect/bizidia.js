const axios = require('axios');
module.exports = {
    name: 'bizidia',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const query = args.join(" ") || "a tech startup";
        const res = await axios.get(`https://text.pollinations.ai/Generate%20a%20profitable%20and%20unique%20business%20idea%20for:%20${encodeURIComponent(query)}`);
        let resMsg = `╭── • 🥀 • ──╮\n  ʙ ɪ ᴢ  ɪ ᴅ ᴇ ᴀ  \n╰── • 🥀 • ──╯\n\n${res.data}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
        await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
    }
};
