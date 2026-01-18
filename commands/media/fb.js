const axios = require('axios');
module.exports = {
    name: 'fb',
    async execute(m, sock, commands, args) {
        if (!args[0]) return m.reply("Paste Facebook Link.");
        try {
            const res = await axios.get(`https://api.dhammasepun.me/api/fbdl?url=${args[0]}`);
            await sock.sendMessage(m.key.remoteJid, { video: { url: res.data.result.hd }, caption: "STANYTZ FB DL" }, { quoted: m });
        } catch (e) { m.reply("Error fetching video."); }
    }
};
