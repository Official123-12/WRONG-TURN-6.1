module.exports = {
    name: 'owner',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        
        let msg = `╭─── • 🥀 • ───╮\n`;
        msg += `   ꜱʏꜱᴛᴇᴍ  ᴏᴡɴᴇʀ  \n`;
        msg += `╰─── • 🥀 • ───╯\n\n`;
        msg += `⚘  *ɴᴀᴍᴇ* : ꜱᴛᴀɴʏᴛᴢ\n`;
        msg += `⚘  *ʀᴏʟᴇ* : ᴄᴏʀᴇ ᴅᴇᴠᴇʟᴏᴘᴇʀ\n`;
        msg += `⚘  *ᴄᴏɴᴛᴀᴄᴛ* : 𝟶𝟼𝟷𝟾𝟼𝟼𝟾𝟻𝟶𝟸🇹🇿\n`;
        msg += `⚘  *ɢɪᴛʜᴜʙ* : ꜱᴛᴀɴʏᴛᴢ-ᴅᴇᴠ\n\n`;
        msg += `_ʀᴇᴀᴄʜ ᴏᴜᴛ ꜰᴏʀ ꜱʏꜱᴛᴇᴍ ᴜᴘᴅᴀᴛᴇꜱ_`;

        await sock.sendMessage(from, { 
            text: msg, 
            contextInfo: forwardedContext 
        }, { quoted: m });
    }
};
