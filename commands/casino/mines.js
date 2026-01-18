module.exports = {
    name: 'mines',
    async execute(m, sock) {
        const jid = m.key.remoteJid;
        const icons = ["💣", "💎", "💎", "💎", "💎", "💣", "💎", "💎", "💎"];
        const grid = icons.sort(() => Math.random() - 0.5);
        let res = `🎰 *WT6 MINES GAME*\n\n` +
                  `| ${grid[0]} | ${grid[1]} | ${grid[2]} |\n` +
                  `| ${grid[3]} | ${grid[4]} | ${grid[5]} |\n` +
                  `| ${grid[6]} | ${grid[7]} | ${grid[8]} |\n\n` +
                  `*WRONG TURN 6 | STANYTZ INDUSTRIES* ✔️`;
        await sock.sendMessage(jid, { text: res }, { quoted: m });
    }
};
