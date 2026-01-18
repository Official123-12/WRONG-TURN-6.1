const axios = require('axios');
module.exports = {
    name: 'ytmp3',
    async execute(m, sock, commands, args) {
        if (!args[0]) return m.reply("Provide YouTube Link.");
        try {
            const res = await axios.get(`https://api.dhammasepun.me/api/ytmp3?url=${args[0]}`);
            await sock.sendMessage(m.key.remoteJid, { audio: { url: res.data.result.download_url }, mimetype: 'audio/mp4' }, { quoted: m });
        } catch (e) { m.reply("Download failed."); }
    }
};
