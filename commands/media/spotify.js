const axios = require('axios');
module.exports = {
    name: 'spotify',
    async execute(m, sock, commands, args) {
        if (!args[0]) return m.reply("Song name?");
        const res = await axios.get(`https://api.popcat.xyz/spotify?q=${encodeURIComponent(args.join(" "))}`);
        const txt = `🎵 *Title:* ${res.data.title}\n👤 *Artist:* ${res.data.artists}\n💿 *Album:* ${res.data.album}\n\n*WRONG TURN 6 | STANYTZ*`;
        await sock.sendMessage(m.key.remoteJid, { image: { url: res.data.image }, caption: txt }, { quoted: m });
    }
};
