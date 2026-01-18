module.exports = {
    name: 'runtime',
    async execute(m, sock) {
        const up = process.uptime();
        const h = Math.floor(up / 3600);
        const m1 = Math.floor((up % 3600) / 60);
        const s = Math.floor(up % 60);
        const msg = `┏━━『 *WRONG TURN 6* 』━━┓\n┃ 🥀 *Uptime:* ${h}h ${m1}m ${s}s\n┃ 🥀 *Developer:* STANYTZ\n┗━━━━━━━━━━━━━━━┛`;
        m.reply(msg);
    }
};
