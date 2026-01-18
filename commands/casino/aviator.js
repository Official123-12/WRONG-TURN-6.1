module.exports = {
    name: 'aviator',
    async execute(m) {
        const mult = (Math.random() * 5 + 1).toFixed(2);
        m.reply(`🚀 *AVIATOR PREDICTOR*\n\n┃ 📊 *Next Fly:* ${mult}x\n┃ 🛡️ *Accuracy:* 88%\n┗━━━━━━━━━━━━┛\n*DEV: STANYTZ*`);
    }
};
