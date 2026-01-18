module.exports = {
    name: 'alive',
    async execute(m, sock) {
        const from = m.key.remoteJid;
        const text = `WRONG TURN 6 ✔️\nDeveloper: STANYTZ\n\nStatus: Online and Monitoring\nEngine: AngularSockets\nType .menu to see all commands.`;
        
        await sock.sendMessage(from, { 
            image: { url: 'https://files.catbox.moe/59ays3.jpg' }, 
            caption: text 
        }, { quoted: m });
    }
};
