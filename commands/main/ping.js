module.exports = {
    name: 'ping',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const start = Date.now();
        const jid = m.key.remoteJid;
        const pinging = await sock.sendMessage(jid, { text: 'Testing...' }, { quoted: m });
        const end = Date.now();

        let body = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
        body += `┃  ⚡ 𝗣𝗜𝗡𝗚 𝗥𝗘𝗦𝗨𝗟𝗧𝗦   ┃\n`;
        body += `┣━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
        body += `┃ 🥀 𝗦𝗽𝗲𝗲𝗱: ${end - start}ms\n`;
        body += `┃ 🥀 𝗦𝘁𝗮𝘁𝘂𝘀: 𝗢𝗽𝗲𝗿𝗮𝘁𝗶𝗼𝗻𝗮𝗹\n`;
        body += `┃ 🥀 𝗩𝗲𝗿𝘀𝗶𝗼𝗻: 𝟲.𝟲.𝟬\n`;
        body += `┃ 🥀 𝗗𝗲𝘃: 𝗦𝗧𝗔𝗡𝗬𝗧𝗭\n`;
        body += `┗━━━━━━━━━━━━━━━━━━━━━━━━┛`;

        await sock.sendMessage(jid, { text: body, edit: pinging.key, contextInfo: forwardedContext });
    }
};
