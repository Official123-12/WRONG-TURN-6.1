/**
 * 🥀 WRONG TURN 6 - LUXURY MAINFRRAME
 * 🥀 STYLE: AESTHETIC 20090 | VERTICAL
 */

module.exports = {
    name: 'menu',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;
        const pushName = m.pushName || "User";
        
        // Runtime Calculation
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        // Categorize Commands
        const categories = {};
        commands.forEach(cmd => {
            if (cmd.category) {
                const cat = cmd.category.toUpperCase();
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(cmd.name);
            }
        });

        // Build Luxury Typography Menu
        let menuBody = `*W R O N G  T U R N  6*  ✔️\n`;
        menuBody += `_S y s t e m   A r m e d_\n\n`;

        menuBody += `*U S E R* : ${pushName}\n`;
        menuBody += `*U P T I M E* : ${hours}h ${minutes}m\n`;
        menuBody += `*E N G I N E* : AngularSockets\n\n`;

        const sortedCats = Object.keys(categories).sort();
        for (const cat of sortedCats) {
            menuBody += `🥀  *${cat}*\n`;
            menuBody += `───────────────\n`;
            categories[cat].sort().forEach(name => {
                menuBody += `   ◦  .${name}\n`;
            });
            menuBody += `\n`;
        }

        menuBody += `*𓆩  STANYTZ INDUSTRIES  𓆪*`;

        await sock.sendMessage(from, {
            text: menuBody,
            contextInfo: {
                externalAdReply: {
                    title: "WRONG TURN 6 ✔️",
                    body: "SYSTEM VERIFIED BY STANYTZ",
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
