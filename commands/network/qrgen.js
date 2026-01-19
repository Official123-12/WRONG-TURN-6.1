module.exports = {
    name: 'qrgen',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const text = args.join(" ");
        if (!text) return m.reply("ᴘʀᴏᴠɪᴅᴇ ᴛᴇxᴛ ᴏʀ ᴀ ᴜʀʟ.");
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(text)}`;
        
        await sock.sendMessage(m.key.remoteJid, { 
            image: { url }, 
            caption: `*ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 ǫʀ ɢᴇɴᴇʀᴀᴛᴏʀ*\n\nᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ`,
            contextInfo: forwardedContext 
        }, { quoted: m });
    }
};
