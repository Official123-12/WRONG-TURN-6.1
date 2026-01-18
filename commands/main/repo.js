module.exports = {
    name: 'repo',
    async execute(m, sock) {
        const from = m.key.remoteJid;
        const msg = `WRONG TURN 6 ✔️\nDeveloper: STANYTZ\n\nOfficial Repository: https://wrong-turn-6-1-x2z6.onrender.com\n\nGive us a star if you like this engine! 🥀🥂`;
        
        await sock.sendMessage(from, { text: msg }, { quoted: m });
    }
};
