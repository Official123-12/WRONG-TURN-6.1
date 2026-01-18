
const axios = require('axios');
module.exports = {
    name: 'pinterest',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;
        const query = args.join(" ");
        if (!query) return sock.sendMessage(from, { text: "What do you want to search on Pinterest?" }, { quoted: m });
        try {
            const res = await axios.get(`https://api.boxi.my.id/api/pinterest?query=${encodeURIComponent(query)}`);
            const imageUrl = res.data.result[0];
            await sock.sendMessage(from, { 
                image: { url: imageUrl }, 
                caption: `Result for: ${query}\nWRONG TURN 6 ✔️\nDeveloper: STANYTZ` 
            }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: "Search failed." }, { quoted: m });
        }
    }
};
