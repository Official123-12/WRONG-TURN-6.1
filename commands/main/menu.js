module.exports = {
    name: 'menu',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;

        // Group commands by their category (folder name)
        const categories = {};
        commands.forEach(cmd => {
            const cat = cmd.category ? cmd.category.toUpperCase() : 'GENERAL';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(cmd.name);
        });

        // Strictly Vertical Obsidian Red Styling
        let menuBody = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
        menuBody += `┃   *W R O N G  T U R N  6*  ✔️\n`;
        menuBody += `┗━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;

        menuBody += `┌───  🥀  *S Y S T E M  I N F O*\n`;
        menuBody += `│\n`;
        menuBody += `│  🥀 *User:* @${m.key.remoteJid.split('@')[0]}\n`;
        menuBody += `│  🥀 *Lib:* AngularSockets\n`;
        menuBody += `│  🥀 *Dev:* STANYTZ\n`;
        menuBody += `│\n`;
        menuBody += `└────────────────────────┘\n\n`;

        // Sort categories and commands vertically
        const sortedCats = Object.keys(categories).sort();
        for (const cat of sortedCats) {
            menuBody += `┏━━━━━━ 〔 *${cat}* 〕 ━━━━━━┓\n`;
            categories[cat].sort().forEach(name => {
                menuBody += `┃  🥀  .${name}\n`;
            });
            menuBody += `┗━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
        }

        menuBody += `_© 2026 STANYTZ INDUSTRIES_  🥀🥂`;

        await sock.sendMessage(from, {
            text: menuBody,
            mentions: [m.key.remoteJid],
            contextInfo: {
                externalAdReply: {
                    title: "WRONG TURN 6 ✔️",
                    body: "SYSTEM ARMED",
                    mediaType: 1,
                    previewType: 0,
                    renderLargerThumbnail: true,
                    thumbnailUrl: "https://files.catbox.moe/59ays3.jpg",
                    sourceUrl: "https://github.com/stanytz"
                },
                forwardingScore: 999,
                isForwarded: false
            }
        }, { quoted: m });
    }
};
