module.exports = {
    name: 'mines',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const icons = ["💣", "💎", "💎", "💎", "💎", "💣", "💎", "💎", "💎"];
        const grid = icons.sort(() => Math.random() - 0.5);

        let body = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
        body += `┃  🎰 𝗪𝗧𝟲 𝗠𝗜𝗡𝗘𝗦 𝗚𝗔𝗠𝗘   ┃\n`;
        body += `┣━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
        body += `┃    | ${grid[0]} | ${grid[1]} | ${grid[2]} |\n`;
        body += `┃    | ${grid[3]} | ${grid[4]} | ${grid[5]} |\n`;
        body += `┃    | ${grid[6]} | ${grid[7]} | ${grid[8]} |\n`;
        body += `┣━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
        body += `┃ 🥀 𝗗𝗲𝘃: 𝗦𝗧𝗔𝗡𝗬𝗧𝗭\n`;
        body += `┃ 🥀 𝗟𝘂𝗰𝗸: ${Math.floor(Math.random() * 100)}%\n`;
        body += `┗━━━━━━━━━━━━━━━━━━━━━━━━┛`;

        await sock.sendMessage(m.key.remoteJid, { text: body, contextInfo: forwardedContext }, { quoted: m });
    }
};
