module.exports = {
    name: 'menu',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        const uptime = Math.floor(process.uptime() / 3600) + "h " + Math.floor((process.uptime() % 3600) / 60) + "m";

        let menu = `*W R O N G  T U R N  B O T*  ✔️\n`;
        menu += `_S y s t e m   O p e r a t i o n a l_\n\n`;
        
        menu += `⚘  *U S E R* : ${m.pushName}\n`;
        menu += `⚘  *U P T I M E* : ${uptime}\n`;
        menu += `⚘  *C H A N N E L* : Verified\n\n`;

        const cats = {};
        commands.forEach(c => {
            if (!cats[c.category]) cats[c.category] = [];
            cats[c.category].push(c.name);
        });

        for (const [category, cmds] of Object.entries(cats)) {
            menu += `🥀  *${category.toUpperCase()}*\n`;
            menu += `───────────────\n`;
            cmds.sort().forEach(name => {
                menu += `   ◦  .${name}\n`;
            });
            menu += `\n`;
        }

        menu += `*𓆩  STANYTZ INDUSTRIES  𓆪*`;

        await sock.sendMessage(from, { 
            text: menu, 
            contextInfo: {
                ...forwardedContext,
                externalAdReply: {
                    title: "WRONG TURN MAINFRRAME",
                    body: "STANYTZ MASTER ENGINE",
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    thumbnailUrl: "https://files.catbox.moe/59ays3.jpg"
                }
            }
        }, { quoted: m });
    }
};
