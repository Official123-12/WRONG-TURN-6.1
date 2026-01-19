const axios = require('axios');
module.exports = {
    name: 'ai',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        const query = args.join(" ");
        if (!query) return sock.sendMessage(from, { text: "How can I help you, Master?" });

        try {
            const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(query)}`);
            
            let body = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
            body += `┃  🤖 𝗪𝗧𝟲 𝗔𝗜 𝗥𝗘𝗦𝗣𝗢𝗡𝗦𝗘   ┃\n`;
            body += `┣━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
            body += `${res.data}\n`;
            body += `┣━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
            body += `┃ 𝗕𝗼𝘁: 𝗪𝗥𝗢𝗡𝗚 𝗧𝗨𝗥𝗡 𝗕𝗢𝗧\n`;
            body += `┃ 𝗗𝗲𝘃: 𝗦𝗧𝗔𝗡𝗬𝗧𝗭\n`;
            body += `┗━━━━━━━━━━━━━━━━━━━━━━━━┛`;

            await sock.sendMessage(from, { text: body, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) { sock.sendMessage(from, { text: "AI is currently offline." }); }
    }
};
