const axios = require('axios');
module.exports = {
    name: 'spotify',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;
        const query = args.join(" ");
        if (!query) return sock.sendMessage(from, { text: "Provide a song name." }, { quoted: m });
        try {
            const res = await axios.get(`https://api.popcat.xyz/spotify?q=${encodeURIComponent(query)}`);
            const txt = `Song: ${res.data.title}\nArtist: ${res.data.artists}\nAlbum: ${res.data.album}\nWRONG TURN 6 ✔️\nDeveloper: STANYTZ`;
            await sock.sendMessage(from, { 
                image: { url: res.data.image }, 
                caption: txt 
            }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: "Song not found." }, { quoted: m });
        }
    }
};
