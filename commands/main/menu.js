module.exports = {
    name: 'menu',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        const uptime = Math.floor(process.uptime() / 3600) + "h " + Math.floor((process.uptime() % 3600) / 60) + "m";

        let menu = `┏━━━━━━━━━━━━━━━━━━━━┓\n`;
        menu += `┃   ᴡ ʀ ᴏ ɴ ɢ  ᴛ ᴜ ʀ ɴ  ʙ ᴏ ᴛ  \n`;
        menu += `┗━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
        
        menu += `┌───  🥀  ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ\n`;
        menu += `│\n`;
        menu += `│ 🥀 ᴜꜱᴇʀ: ${m.pushName}\n`;
        menu += `│ 🥀 ᴜᴘᴛɪᴍᴇ: ${uptime}\n`;
        menu += `│ 🥀 ᴅᴇᴠ: ꜱᴛᴀɴʏᴛ𝗭\n`;
        menu += `│ 🥀 ᴠᴇʀꜱɪᴏɴ: 𝟼.𝟼.𝟶\n`;
        menu += `│\n`;
        menu += `└──────────────────────┘\n\n`;

        const cats = {};
        commands.forEach(c => {
            if (!cats[c.category]) cats[c.category] = [];
            cats[c.category].push(c.name);
        });

        for (const [cat, cmds] of Object.entries(cats)) {
            menu += `┏━━━〔 🥀 *${cat.toUpperCase()}* 〕━━━┓\n`;
            cmds.sort().forEach(n => menu += `┃  ◦ .${n}\n`);
            menu += `┗━━━━━━━━━━━━━━━━━━┛\n\n`;
        }

        menu += `_© 𝟮𝟬𝟮𝟲 ꜱᴛᴀɴʏᴛᴢ ɪɴᴅᴜꜱᴛʀɪᴇꜱ_  🥀🥂`;

        await sock.sendMessage(from, { 
            text: menu, 
            contextInfo: {
                ...forwardedContext,
                externalAdReply: {
                    title: "ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 ✔️",
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
