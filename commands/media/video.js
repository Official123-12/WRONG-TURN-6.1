const axios = require('axios');
module.exports = {
    name: 'video',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const query = args.join(" ");
        if (!query) return m.reply("ᴡʜᴀᴛ ᴠɪᴅᴇᴏ ᴅᴏ ʏᴏᴜ ɴᴇᴇᴅ?");
        try {
            const search = await axios.get(`https://api.popcat.xyz/ytsearch?q=${encodeURIComponent(query)}`);
            const vid = search.data[0];
            const dl = await axios.get(`https://api.dhammasepun.me/api/ytmp4?url=${vid.url}`);
            
            let cap = `╭─── • 🥀 • ───╮\n  ᴠ ɪ ᴅ ᴇ ᴏ  ᴅ ʟ  \n╰─── • 🥀 • ───╯\n\n│ ◦ ᴛɪᴛʟᴇ: ${vid.title}\n│ ◦ ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\n└──────────────`;
            await sock.sendMessage(m.key.remoteJid, { video: { url: dl.data.result.download_url }, caption: cap, contextInfo: forwardedContext });
        } catch (e) { m.reply("ᴠɪᴅᴇᴏ ɴᴏᴛ ꜰᴏᴜɴᴅ."); }
    }
};
