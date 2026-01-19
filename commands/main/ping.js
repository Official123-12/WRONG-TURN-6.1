module.exports = {
    name: 'ping',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const start = Date.now();
        const end = Date.now();
        let body = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
        body += `┃  ⚡ ᴘɪɴɢ ʀᴇꜱᴜʟᴛꜱ   ┃\n`;
        body += `┣━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
        body += `┃ 🥀 ꜱᴘᴇᴇᴅ: ${end - start}ms\n`;
        body += `┃ 🥀 ꜱᴛᴀᴛᴜꜱ: ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ\n`;
        body += `┃ 🥀 ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\n`;
        body += `┗━━━━━━━━━━━━━━━━━━━━━━━━┛`;

        await sock.sendMessage(m.key.remoteJid, { text: body, contextInfo: forwardedContext });
    }
};
