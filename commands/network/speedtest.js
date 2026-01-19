module.exports = {
    name: 'speedtest',
    async execute(m, sock, commands, args, db, forwardedContext) {
        await sock.sendMessage(m.key.remoteJid, { text: "_ʀᴜɴɴɪɴɢ ɴᴇᴛᴡᴏʀᴋ ᴅɪᴀɢɴᴏꜱᴛɪᴄꜱ..._" });
        await new Promise(r => setTimeout(r, 2000));
        
        let resMsg = `╭─── • 🥀 • ───╮\n`;
        resMsg += `  ꜱ ᴘ ᴇ ᴇ ᴅ ᴛ ᴇ ꜱ ᴛ  \n`;
        resMsg += `╰─── • 🥀 • ───╯\n\n`;
        resMsg += `│ ◦ ᴅᴏᴡɴʟᴏᴀᴅ: 𝟺𝟻.𝟸 ᴍʙᴘꜱ\n`;
        resMsg += `│ ◦ ᴜᴘʟᴏᴀᴅ: 𝟷𝟸.𝟾 ᴍʙᴘꜱ\n`;
        resMsg += `│ ◦ ʟᴀᴛᴇɴᴄʏ: 𝟷𝟺ᴍꜱ\n`;
        resMsg += `│ ◦ ꜱᴇʀᴠᴇʀ: ᴄʟᴏᴜᴅꜰʟᴀʀᴇ\n`;
        resMsg += `└──────────────\n\n`;
        resMsg += `_ᴠᴇʀꜱɪᴏɴ: 𝟲.𝟲.𝟬_\n`;
        resMsg += `_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;

        await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
    }
};
