const axios = require('axios');
module.exports = {
    name: 'ig',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;
        if (!args[0]) return sock.sendMessage(from, { text: "Provide an Instagram link." }, { quoted: m });
        try {
            const res = await axios.get(`https://api.dhammasepun.me/api/igdl?url=${args[0]}`);
            const mediaUrl = res.data.result[0].url;
            await sock.sendMessage(from, { 
                video: { url: mediaUrl }, 
                caption: `WRONG TURN 6 ✔️\nDeveloper: STANYTZ` 
            }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: "Error. Content might be private or invalid." }, { quoted: m });
        }
    }
};
