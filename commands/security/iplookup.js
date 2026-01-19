const axios = require('axios');
module.exports = {
    name: 'iplookup',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        if (!args[0]) return sock.sendMessage(from, { text: "Provide an IP address." }, { quoted: m });

        try {
            const res = await axios.get(`http://ip-api.com/json/${args[0]}`);
            const d = res.data;
            
            let body = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
            body += `┃  🌐 𝗜𝗣 𝗜𝗡𝗩𝗘𝗦𝗧𝗜𝗚𝗔𝗧𝗢𝗥  ┃\n`;
            body += `┣━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
            body += `┃ 🥀 𝗧𝗮𝗿𝗴𝗲𝘁: ${d.query}\n`;
            body += `┃ 🥀 𝗜𝗦𝗣: ${d.isp}\n`;
            body += `┃ 🥀 𝗖𝗶𝘁𝘆: ${d.city}\n`;
            body += `┃ 🥀 𝗥𝗲𝗴𝗶𝗼𝗻: ${d.regionName}\n`;
            body += `┃ 🥀 𝗧𝗶𝗺𝗲𝘇𝗼𝗻𝗲: ${d.timezone}\n`;
            body += `┣━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
            body += `┃ 𝗕𝗼𝘁: 𝗪𝗥𝗢𝗡𝗚 𝗧𝗨𝗥𝗡 𝗕𝗢𝗧\n`;
            body += `┃ 𝗗𝗲𝘃: 𝗦𝗧𝗔𝗡𝗬𝗧𝗭\n`;
            body += `┗━━━━━━━━━━━━━━━━━━━━━━━━┛`;

            await sock.sendMessage(from, { text: body, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) {
            sock.sendMessage(from, { text: "Failed to fetch IP data." });
        }
    }
};
