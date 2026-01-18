const axios = require('axios');
module.exports = {
    name: 'tiktok',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;
        if (!args[0]) return sock.sendMessage(from, { text: "Provide a TikTok link." }, { quoted: m });
        try {
            const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${args[0]}`);
            const videoUrl = res.data.video.noWatermark;
            await sock.sendMessage(from, { 
                video: { url: videoUrl }, 
                caption: `WRONG TURN 6 ✔️\nDeveloper: STANYTZ` 
            }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: "Error downloading TikTok. Link might be invalid." }, { quoted: m });
        }
    }
};
