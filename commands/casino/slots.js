module.exports = {
    name: 'slots',
    async execute(m) {
        const items = ["🍎", "🍐", "🍇", "🍒", "💎"];
        const a = items[Math.floor(Math.random()*5)];
        const b = items[Math.floor(Math.random()*5)];
        const c = items[Math.floor(Math.random()*5)];
        m.reply(`🎰 *SLOTS*\n\n[ ${a} | ${b} | ${c} ]\n\n${a==b&&b==c ? "JACKPOT! 🏆" : "LOST! ❌"}\n*STANYTZ CASINO*`);
    }
};
