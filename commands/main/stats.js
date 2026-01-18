const os = require('os');

module.exports = {
    name: 'stats',
    async execute(m, sock) {
        const from = m.key.remoteJid;
        
        const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
        const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
        const cpuModel = os.cpus()[0].model;
        
        const msg = `WRONG TURN 6 ✔️\nDeveloper: STANYTZ\n\nPlatform: ${os.platform()}\nRAM: ${totalMem}GB\nFree RAM: ${freeMem}GB\nCPU: ${cpuModel}`;
        
        await sock.sendMessage(from, { text: msg }, { quoted: m });
    }
};
