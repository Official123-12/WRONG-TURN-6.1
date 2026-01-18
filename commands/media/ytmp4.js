const axios = require('axios');
module.exports = {
    name: 'ytmp4',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;
        if (!args[0]) return sock.sendMessage(from, { text: "Provide a YouTube link." }, { quoted: m });
        try {
            const res = await axios.get(`https://api.dhammasepun.me/api/ytmp4?url=${args[0]}`);
            const videoUrl = res.data.result.download_url;
            await sock.sendMessage(from, { 
                video: { url: videoUrl }, 
                caption: `WRONG TURN 6 ✔️\nDeveloper: STANYTZ` 
            }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: "Failed to download video." }, { quoted: m });
        }
    }
};
