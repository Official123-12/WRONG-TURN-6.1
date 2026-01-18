const axios = require('axios');
module.exports = {
    name: 'ytmp3',
    async execute(m, sock, commands, args) {
        const jid = m.key.remoteJid;
        if (!args[0]) return sock.sendMessage(jid, { text: "Provide YouTube Link." }, { quoted: m });
        try {
            const res = await axios.get(`https://api.dhammasepun.me/api/ytmp3?url=${args[0]}`);
            await sock.sendMessage(jid, { audio: { url: res.data.result.download_url }, mimetype: 'audio/mp4' }, { quoted: m });
        } catch (e) { 
            await sock.sendMessage(jid, { text: "Failed to process audio." }, { quoted: m });
        }
    }
};
