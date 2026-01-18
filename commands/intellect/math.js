const axios = require('axios');
module.exports = {
    name: 'math',
    async execute(m, sock, commands, args) {
        if (!args[0]) return m.reply("Provide a calculation.");
        const res = await axios.get(`https://api.mathjs.org/v4/?expr=${encodeURIComponent(args.join(""))}`);
        m.reply(`📝 *RESULT:* ${res.data}\n\n*STANYTZ ACADEMIC HUB*`);
    }
};
