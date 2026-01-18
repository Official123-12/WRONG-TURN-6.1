const axios = require('axios');
module.exports = {
    name: 'forex',
    async execute(m, sock, commands, args) {
        if (!args[1]) return m.reply("Usage: .forex USD TZS");
        try {
            const res = await axios.get(`https://api.exchangerate-api.com/v4/latest/${args[0].toUpperCase()}`);
            const rate = res.data.rates[args[1].toUpperCase()];
            if (!rate) return m.reply("Invalid Currency Code.");
            const msg = `┏━━━━ 『 *FOREX EXCHANGE* 』 ━━━━┓\n┃\n┃ 🥀 *Base:* ${args[0].toUpperCase()}\n┃ 🥀 *Target:* ${args[1].toUpperCase()}\n┃ 🥀 *Rate:* ${rate}\n┃\n┗━━━━━━━━━━━━━━━━━━━┛\n*WRONG TURN 6 | STANYTZ INDUSTRIES* ✔️`;
            m.reply(msg);
        } catch (e) { m.reply("API Error. Ensure symbols are correct (e.g., USD, TZS)."); }
    }
};
