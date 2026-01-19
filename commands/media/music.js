const axios = require('axios');
module.exports = {
    name: 'music',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const query = args.join(" ");
        if (!query) return m.reply("ᴡʜᴀᴛ ꜱᴏɴɢ ᴅᴏ ʏᴏᴜ ɴᴇᴇᴅ?");
        try {
            const search = await axios.get(`https://api.popcat.xyz/ytsearch?q=${encodeURIComponent(query)}`);
            const vid = search.data[0];
            const dl = await axios.get(`https://api.dhammasepun.me/api/ytmp3?url=${vid.url}`);
            
            let cap = `╭─── • 🥀 • ───╮\n  ᴍ ᴜ ꜱ ɪ ᴄ  ᴅ ʟ  \n╰─── • 🥀 • ───╯\n\n│ ◦ ᴛɪᴛʟᴇ: ${vid.title}\n│ ◦ ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\n└──────────────`;
            await sock.sendMessage(m.key.remoteJid, { audio: { url: dl.data.result.download_url }, mimetype: 'audio/mp4', contextInfo: forwardedContext });
        } catch (e) { m.reply("ᴍᴜꜱɪᴄ ɴᴏᴛ ꜰᴏᴜɴᴅ."); }
    }
};
