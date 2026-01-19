const axios = require('axios');
module.exports = {
    name: 'lyrics',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const query = args.join(" ");
        if (!query) return m.reply("ᴘʀᴏᴠɪᴅᴇ ᴀ ꜱᴏɴɢ ɴᴀᴍᴇ.");
        try {
            const res = await axios.get(`https://api.popcat.xyz/lyrics?song=${encodeURIComponent(query)}`);
            let resMsg = `╭─── • 🥀 • ───╮\n  ʟ ʏ ʀ ɪ ᴄ ꜱ  \n╰─── • 🥀 • ───╯\n\n${res.data.lyrics}\n\n_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
        } catch (e) { m.reply("ʟʏʀɪᴄꜱ ɴᴏᴛ ꜰᴏᴜɴᴅ."); }
    }
};
