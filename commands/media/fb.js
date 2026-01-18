const axios = require('axios');
module.exports = {
    name: 'fb',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;
        if (!args[0]) return sock.sendMessage(from, { text: "Provide a Facebook link." }, { quoted: m });
        try {
            const res = await axios.get(`https://api.dhammasepun.me/api/fbdl?url=${args[0]}`);
            const videoUrl = res.data.result.hd || res.data.result.sd;
            await sock.sendMessage(from, { 
                video: { url: videoUrl }, 
                caption: `WRONG TURN 6 ✔️\nDeveloper: STANYTZ` 
            }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: "Error fetching Facebook video." }, { quoted: m });
        }
    }
};
