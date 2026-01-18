const axios = require('axios');
module.exports = {
    name: 'gold',
    async execute(m) {
        const res = await axios.get(`https://api.gold-api.com/price/XAU`);
        m.reply(`🥇 *GOLD PRICE:* $${res.data.price}\n*STANYTZ FINANCE*`);
    }
};
