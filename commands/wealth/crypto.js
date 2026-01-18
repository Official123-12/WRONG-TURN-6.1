const axios = require('axios');
module.exports = {
    name: 'crypto',
    async execute(m, sock) {
        const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd`);
        const d = res.data;
        let txt = `💰 *LIVE MARKET DATA*\n\n` +
                  `₿ *Bitcoin:* $${d.bitcoin.usd}\n` +
                  `Ξ *Ethereum:* $${d.ethereum.usd}\n` +
                  `☀️ *Solana:* $${d.solana.usd}\n\n` +
                  `*STANYTZ WEALTH HUB*`;
        m.reply(txt);
    }
};
