const axios = require('axios');
module.exports = {
    name: 'bitcoin',
    async execute(m, sock) {
        const jid = m.key.remoteJid;
        try {
            const res = await axios.get('https://api.coindesk.com/v1/bpi/currentprice.json');
            const price = res.data.bpi.USD.rate;
            const msg = `┏━━━━ 『 *CRYPTO WATCH* 』 ━━━━┓\n┃\n┃ 🥀 *Asset:* Bitcoin (BTC)\n┃ 🥀 *Price:* $${price}\n┃ 🥀 *Currency:* USD\n┃\n┗━━━━━━━━━━━━━━━━┛\n*WRONG TURN 6 | STANYTZ INDUSTRIES* ✔️`;
            await sock.sendMessage(jid, { text: msg }, { quoted: m });
        } catch (e) { 
            await sock.sendMessage(jid, { text: "Failed to fetch live price." }, { quoted: m });
        }
    }
};
