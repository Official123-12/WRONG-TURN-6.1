module.exports = {
    name: 'ping',
    async execute(m, sock) {
        const start = Date.now();
        await sock.sendMessage(m.key.remoteJid, { text: 'Testing Latency...' }, { quoted: m });
        const end = Date.now();
        
        const responseTime = end - start;
        const pingMsg = `┏━━━━ 『 *WRONG TURN 6* 』 ━━━━┓\n` +
                        `┃ 🥀 *Speed:* ${responseTime}ms\n` +
                        `┃ 🥀 *Status:* High Performance\n` +
                        `┃ 🥀 *Developer:* STANYTZ\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━┛`;
        
        await sock.sendMessage(m.key.remoteJid, { text: pingMsg }, { quoted: m });
    }
};
