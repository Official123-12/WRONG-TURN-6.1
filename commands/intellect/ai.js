const axios = require('axios');
module.exports = {
    name: 'ai',
    async execute(m, sock, commands, args) {
        const jid = m.key.remoteJid;
        const query = args.join(" ");
        if (!query) return sock.sendMessage(jid, { text: "How can I assist you today?" }, { quoted: m });
        try {
            const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(query)}`);
            const msg = `🤖 *WT6 AI ENGINE*\n\n${res.data}\n\n*WRONG TURN 6 | STANYTZ INDUSTRIES* ✔️`;
            await sock.sendMessage(jid, { text: msg }, { quoted: m });
        } catch (e) { 
            await sock.sendMessage(jid, { text: "AI Service Busy." }, { quoted: m });
        }
    }
};
