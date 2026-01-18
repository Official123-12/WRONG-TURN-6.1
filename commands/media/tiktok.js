const axios = require('axios');
module.exports = {
    name: 'tiktok',
    async execute(m, sock, commands, args) {
        const jid = m.key.remoteJid;
        if (!args[0]) return sock.sendMessage(jid, { text: "Provide TikTok URL." }, { quoted: m });
        try {
            const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${args[0]}`);
            const videoUrl = res.data.video.noWatermark;
            await sock.sendMessage(jid, { video: { url: videoUrl }, caption: "*WRONG TURN 6 | STANYTZ INDUSTRIES* ✔️" }, { quoted: m });
        } catch (e) { 
            await sock.sendMessage(jid, { text: "Download failed." }, { quoted: m });
        }
    }
};
