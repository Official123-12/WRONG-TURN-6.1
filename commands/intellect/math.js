const axios = require('axios');
module.exports = {
    name: 'math',
    async execute(m, sock, commands, args) {
        const jid = m.key.remoteJid;
        if (!args[0]) return sock.sendMessage(jid, { text: "Provide a calculation (e.g. .math 10+5)" }, { quoted: m });
        try {
            const res = await axios.get(`https://api.mathjs.org/v4/?expr=${encodeURIComponent(args.join(""))}`);
            const msg = `📝 *MATH RESULT*\n\n┃ 🥀 *Query:* ${args.join("")}\n┃ 🥀 *Result:* ${res.data}\n\n*WRONG TURN 6 | STANYTZ INDUSTRIES* ✔️`;
            await sock.sendMessage(jid, { text: msg }, { quoted: m });
        } catch (e) { 
            await sock.sendMessage(jid, { text: "Invalid expression." }, { quoted: m });
        }
    }
};
