/**
 * 🥀 WRONG TURN 6 - ARMED MENU
 * 🥀 THEME: OBSIDIAN RED / ELITE BLACK
 * 🥀 STYLE: BOX BORDER FRAME | VERTICAL
 */

module.exports = {
    name: 'menu',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;

        // 1. GROUP COMMANDS BY CATEGORY
        const categories = {};
        commands.forEach(cmd => {
            const cat = cmd.category ? cmd.category.toUpperCase() : 'GENERAL';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(cmd.name);
        });

        // 2. BUILD THE ELITE BOX MENU
        let menuBody = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
        menuBody += `┃  *W R O N G  T U R N  6*  ✔️\n`;
        menuBody += `┗━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;

        menuBody += `┌───  🥀  *S Y S T E M  I N F O*\n`;
        menuBody += `│\n`;
        menuBody += `│  🥀 *User:* @${m.sender.split('@')[0]}\n`;
        menuBody += `│  🥀 *Developer:* STANYTZ\n`;
        menuBody += `│  🥀 *Lib:* AngularSockets\n`;
        menuBody += `│  🥀 *Status:* Operational\n`;
        menuBody += `│\n`;
        menuBody += `└────────────────────────┘\n\n`;

        // 3. CATEGORIES LOOP (STRICTLY VERTICAL)
        for (const [category, cmds] of Object.entries(categories)) {
            menuBody += `┏━━━━━━ 〔 *${category}* 〕 ━━━━━━┓\n`;
            cmds.sort().forEach(name => {
                menuBody += `┃  🥀  .${name}\n`; // Kila command kwenye mstari wake
            });
            menuBody += `┗━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
        }

        menuBody += `_© 2026 STANYTZ INDUSTRIES_  🥀🥂`;

        // 4. SEND WITH LARGE LOGO & VERIFICATION TAG
        await sock.sendMessage(from, {
            text: menuBody,
            mentions: [m.sender],
            contextInfo: {
                externalAdReply: {
                    title: "WRONG TURN 6 ✔️", // Fake Blue Tick
                    body: "SYSTEM VERIFIED BY STANYTZ",
                    mediaType: 1,
                    previewType: 0,
                    renderLargerThumbnail: true,
                    thumbnailUrl: "https://files.catbox.moe/59ays3.jpg",
                    sourceUrl: "https://whatsapp.com/channel/0029Vb7fzu4EwEjmsD4Tzs1p"
                },
                forwardingScore: 999,
                isForwarded: true
            }
        }, { quoted: m });
    }
};
