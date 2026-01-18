const axios = require('axios');
module.exports = {
    name: 'twitter',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;
        if (!args[0]) return sock.sendMessage(from, { text: "Provide a Twitter link." }, { quoted: m });
        try {
            const res = await axios.get(`https://api.dhammasepun.me/api/twitter?url=${args[0]}`);
            const videoUrl = res.data.result.SD || res.data.result.HD;
            await sock.sendMessage(from, { 
                video: { url: videoUrl }, 
                caption: `WRONG TURN 6 ✔️\nDeveloper: STANYTZ` 
            }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: "Failed to download Twitter video." }, { quoted: m });
        }
    }
};
