const axios = require('axios');
module.exports = {
    name: 'iplookup',
    async execute(m, sock, commands, args) {
        const jid = m.key.remoteJid;
        if (!args[0]) return sock.sendMessage(jid, { text: "Provide an IP Address." }, { quoted: m });
        try {
            const res = await axios.get(`http://ip-api.com/json/${args[0]}`);
            const d = res.data;
            if (d.status === 'fail') return sock.sendMessage(jid, { text: "IP Not Found." }, { quoted: m });
            let txt = `┏━━━━ 『 *IP INVESTIGATOR* 』 ━━━━┓\n┃\n` +
                      `┃ 🥀 *IP:* ${d.query}\n┃ 🥀 *ISP:* ${d.isp}\n┃ 🥀 *City:* ${d.city}\n` +
                      `┃ 🥀 *Country:* ${d.country}\n┃ 🥀 *Lat/Lon:* ${d.lat}, ${d.lon}\n┃\n` +
                      `┗━━━━━━━━━━━━━━━━━┛\n*WRONG TURN 6 | STANYTZ INDUSTRIES* ✔️`;
            await sock.sendMessage(jid, { text: txt }, { quoted: m });
        } catch (e) { 
            await sock.sendMessage(jid, { text: "Database lookup failed." }, { quoted: m });
        }
    }
};
