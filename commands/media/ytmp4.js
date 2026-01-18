const axios = require('axios');
module.exports = {
    name: 'ytmp4',
    async execute(m, sock, commands, args) {
        if (!args[0]) return m.reply("Provide YouTube Link.");
        try {
            const res = await axios.get(`https://api.dhammasepun.me/api/ytmp4?url=${args[0]}`);
            await sock.sendMessage(m.key.remoteJid, { video: { url: res.data.result.download_url }, caption: "WRONG TURN 6 | STANYTZ" }, { quoted: m });
        } catch (e) { m.reply("Download failed."); }
    }
};
