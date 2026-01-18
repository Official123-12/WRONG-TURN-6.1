const axios = require('axios');
module.exports = {
    name: 'ig',
    async execute(m, sock, commands, args) {
        if (!args[0]) return m.reply("Paste Instagram Link.");
        try {
            const res = await axios.get(`https://api.dhammasepun.me/api/igdl?url=${args[0]}`);
            await sock.sendMessage(m.key.remoteJid, { video: { url: res.data.result[0].url }, caption: "STANYTZ INSTA DL" }, { quoted: m });
        } catch (e) { m.reply("Content might be private."); }
    }
};
