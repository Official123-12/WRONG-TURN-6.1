const axios = require('axios');
module.exports = {
    name: 'lyrics',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;
        const query = args.join(" ");
        if (!query) return sock.sendMessage(from, { text: "Provide a song name." }, { quoted: m });
        try {
            const res = await axios.get(`https://api.popcat.xyz/lyrics?song=${encodeURIComponent(query)}`);
            const msg = `Title: ${res.data.title}\nArtist: ${res.data.artist}\n\n${res.data.lyrics}\n\nWRONG TURN 6 ✔️\nDeveloper: STANYTZ`;
            await sock.sendMessage(from, { text: msg }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: "Lyrics not found." }, { quoted: m });
        }
    }
};
