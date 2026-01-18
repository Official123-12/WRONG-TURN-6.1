module.exports = {
    name: 'aviator',
    async execute(m, sock) {
        const jid = m.key.remoteJid;
        const mult = (Math.random() * 5 + 1).toFixed(2);
        const res = `🚀 *AVIATOR PREDICTOR*\n\n┃ 📊 *Next Fly:* ${mult}x\n┃ 🛡️ *Accuracy:* 88%\n┗━━━━━━━━━━━━┛\n*WRONG TURN 6 | STANYTZ INDUSTRIES* ✔️`;
        await sock.sendMessage(jid, { text: res }, { quoted: m });
    }
};
