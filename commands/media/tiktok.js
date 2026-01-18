const axios = require('axios');
module.exports = {
    name: 'tiktok',
    async execute(m, sock, commands, args) {
        if (!args[0]) return m.reply("Paste TikTok Link.");
        try {
            const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${args[0]}`);
            const vid = res.data.video.noWatermark;
            await sock.sendMessage(m.key.remoteJid, { video: { url: vid }, caption: "WRONG TURN 6 ✔️\n*DEV: STANYTZ*" }, { quoted: m });
        } catch (e) { m.reply("Invalid Link."); }
    }
};
