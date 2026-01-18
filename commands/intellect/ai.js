const axios = require('axios');
module.exports = {
    name: 'ai',
    async execute(m, sock, commands, args) {
        const q = args.join(" ");
        if (!q) return m.reply("How can I assist you today?");
        const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(q)}`);
        m.reply(`🤖 *WT6 AI ENGINE:*\n\n${res.data}\n\n*PROCESSED BY STANYTZ*`);
    }
};
