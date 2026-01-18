module.exports = {
    name: 'menu',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;
        const pushName = m.pushName || "User";
        
        // Runtime
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        const categories = {};
        commands.forEach(cmd => {
            if (cmd.category) {
                const cat = cmd.category.toUpperCase();
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(cmd.name);
            }
        });

        let menuBody = `*W R O N G  T U R N  6*  ✔️\n`;
        menuBody += `_S y s t e m   A r m e d_\n\n`;

        menuBody += `🥀  *U S E R* : ${pushName}\n`;
        menuBody += `🥀  *U P T I M E* : ${hours}h ${minutes}m\n`;
        menuBody += `🥀  *E N G I N E* : AngularSockets\n\n`;

        for (const [category, cmds] of Object.entries(categories)) {
            menuBody += `⚚  *${category}*\n`;
            menuBody += `───────────────\n`;
            cmds.sort().forEach(name => {
                menuBody += `   ◦  .${name}\n`;
            });
            menuBody += `\n`;
        }

        menuBody += `*𓆩  STANYTZ INDUSTRIES  𓆪*`;

        await sock.sendMessage(from, {
            text: menuBody,
            contextInfo: {
                externalAdReply: {
                    title: "W R O N G  T U R N  6  ✔️",
                    body: "SYSTEM OPERATIONAL",
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    thumbnailUrl: "https://files.catbox.moe/59ays3.jpg",
                    sourceUrl: "https://github.com/stanytz",
                    showAdAttribution: true
                },
                forwardingScore: 999,
                isForwarded: true
            }
        }, { quoted: m });
    }
};
