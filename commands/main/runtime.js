module.exports = {
    name: 'runtime',
    async execute(m, sock) {
        const from = m.key.remoteJid;
        
        const seconds = process.uptime();
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const min = Math.floor((seconds % 3600) / 60);
        const sec = Math.floor(seconds % 60);
        
        const uptime = `${d}d ${h}h ${min}m ${sec}s`;
        const msg = `WRONG TURN 6 ✔️\nUptime: ${uptime}\nDeveloper: STANYTZ`;
        
        await sock.sendMessage(from, { text: msg }, { quoted: m });
    }
};
