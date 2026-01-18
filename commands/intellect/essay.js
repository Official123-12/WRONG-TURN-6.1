const axios = require('axios');
module.exports = {
    name: 'essay',
    async execute(m, sock, commands, args) {
        if (!args[0]) return m.reply("Topic for essay?");
        m.reply("*_Generating Academic Essay..._*");
        const res = await axios.get(`https://text.pollinations.ai/Write%20a%20detailed%20essay%20on%20${encodeURIComponent(args.join(" "))}`);
        m.reply(`📖 *ESSAY ARCHITECT:*\n\n${res.data}\n\n*CAPTION BY STANYTZ*`);
    }
};
