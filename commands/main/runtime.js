module.exports = {
    name: 'runtime',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        
        const uptimeSeconds = process.uptime();
        const days = Math.floor(uptimeSeconds / (24 * 3600));
        const hours = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);

        let res = `╭─── • 🥀 • ───╮\n`;
        res += `   ꜱʏꜱᴛᴇᴍ ʀᴜɴᴛɪᴍᴇ  \n`;
        res += `╰─── • 🥀 • ───╯\n\n`;
        res += `🥀  ${days}ᴅ ${hours}ʜ ${minutes}ᴍ ${seconds}ꜱ\n\n`;
        res += `_ʙᴏᴛ ɪꜱ ꜱᴛᴀʙʟᴇ ᴏɴ ʀᴇɴᴅᴇʀ_`;

        await sock.sendMessage(from, { text: res, contextInfo: forwardedContext }, { quoted: m });
    }
};
