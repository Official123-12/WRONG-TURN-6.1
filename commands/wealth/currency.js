const axios = require('axios');
module.exports = {
    name: 'currency',
    async execute(m, sock, commands, args) {
        if (!args[2]) return m.reply("Usage: .currency 100 USD TZS");
        const res = await axios.get(`https://api.exchangerate-api.com/v4/latest/${args[1].toUpperCase()}`);
        const rate = res.data.rates[args[2].toUpperCase()];
        const result = (parseFloat(args[0]) * rate).toFixed(2);
        m.reply(`💱 *CONVERSION:* ${args[0]} ${args[1]} = ${result} ${args[2]}\n*DEV: STANYTZ*`);
    }
};
