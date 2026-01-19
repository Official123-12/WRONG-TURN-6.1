const os = require('os');

module.exports = {
    name: 'stats',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        
        const ramTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const ramFree = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        const platform = os.platform().toUpperCase();
        const cpu = os.cpus()[0].model.split(' ')[0];

        let res = `╭─── • 🥀 • ───╮\n`;
        res += `   ꜱʏꜱᴛᴇᴍ  ꜱᴛᴀᴛꜱ   \n`;
        res += `╰─── • 🥀 • ───╯\n\n`;
        msg += `⚘  *ᴘʟᴀᴛꜰᴏʀᴍ* : ${platform}\n`;
        msg += `⚘  *ᴄᴘᴜ* : ${cpu}\n`;
        msg += `⚘  *ʀᴀᴍ* : ${ramFree}ɢʙ / ${ramTotal}ɢʙ\n`;
        msg += `⚘  *ᴄᴍᴅꜱ* : ${commands.length}\n`;
        msg += `⚘  *ʟɪʙ* : ᴀɴɢᴜʟᴀʀꜱᴏᴄᴋᴇᴛꜱ\n\n`;
        msg += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;

        await sock.sendMessage(from, { text: msg, contextInfo: forwardedContext }, { quoted: m });
    }
};
