const axios = require('axios');
module.exports = {
    name: 'codeai',
    async execute(m, sock, commands, args) {
        if (!args[0]) return m.reply("What code should I write?");
        const res = await axios.get(`https://text.pollinations.ai/Write%20code%20for%20${encodeURIComponent(args.join(" "))}`);
        m.reply(`💻 *WT6 CODE ARCHITECT:*\n\n${res.data}\n\n*POWERED BY STANYTZ*`);
    }
};
