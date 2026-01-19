module.exports = {
    name: 'menu',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        const uptime = Math.floor(process.uptime() / 3600) + "ʜ " + Math.floor((process.uptime() % 3600) / 60) + "ᴍ";
        
        let menuBody = `╭─── • 🥀 • ───╮\n`;
        menuBody += `  ᴡ ʀ ᴏ ɴ ɢ  ᴛ ᴜ ʀ ɴ  𝟼 \n`;
        menuBody += `╰─── • 🥀 • ───╯\n\n`;

        menuBody += `┌  🥀  *ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ*\n`;
        menuBody += `│  ᴜꜱᴇʀ: ${m.pushName}\n`;
        menuBody += `│  ᴜᴘᴛɪᴍᴇ: ${uptime}\n`;
        menuBody += `│  ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\n`;
        menuBody += `│  ᴍᴏᴅᴇ: ᴘᴜʙʟɪᴄ\n`;
        menuBody += `└──────────────\n\n`;

        const cats = {};
        commands.forEach(c => {
            if (!cats[c.category]) cats[c.category] = [];
            cats[c.category].push(c.name);
        });

        const sortedCats = Object.keys(cats).sort();
        for (const cat of sortedCats) {
            menuBody += `╭──〔 *${cat.toUpperCase()}* 〕\n`;
            cats[cat].sort().forEach(n => {
                menuBody += `│ ◦ .${n}\n`;
            });
            menuBody += `╰──────────────\n\n`;
        }

        menuBody += `_© 𝟮𝟬𝟮𝟲 ꜱᴛᴀɴʏᴛᴢ ɪɴᴅᴜꜱᴛʀɪᴇꜱ_`;

        await sock.sendMessage(from, { 
            text: menuBody, 
            contextInfo: {
                ...forwardedContext,
                externalAdReply: {
                    title: "ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 : ᴍᴀɪɴꜰʀᴀᴍᴇ",
                    body: "ꜱʏꜱᴛᴇᴍ ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ",
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    thumbnailUrl: "https://files.catbox.moe/59ays3.jpg",
                    showAdAttribution: true 
                }
            }
        }, { quoted: m });
    }
};
