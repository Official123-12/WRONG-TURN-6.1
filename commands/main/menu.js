const { createVCard } = require('../../lib/helpers');

module.exports = {
    name: 'menu',
    category: 'Main',
    async execute(m, sock, commands) {
        // Send VCard first
        const vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n' + 
                      'FN:WRONG TURN 6 ✔️\n' + 
                      'ORG:STANYTZ;\n' + 
                      'TEL;type=CELL;type=VOICE;waid=255712345678:+255 712 345 678\n' + 
                      'END:VCARD';
        
        await sock.sendMessage(m.chat, { contacts: { displayName: 'WRONG TURN 6', contacts: [{ vcard }] } });

        let menuText = `┏━━━━ 『 WRONG TURN 6 』 ━━━━┓\n`;
        menuText += `┃ 🥀 *Developer:* STANYTZ\n`;
        menuText += `┃ 🥀 *Prefix:* Multi\n`;
        menuText += `┃ 🥀 *Theme:* Obsidian Red\n`;
        menuText += `┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;

        const categories = [...new Set(commands.map(cmd => cmd.category))];

        categories.forEach(cat => {
            menuText += `┏━━━〔 *${cat.toUpperCase()}* 〕━━━┓\n`;
            const cmds = commands.filter(c => c.category === cat);
            cmds.forEach(c => {
                menuText += `┃ 🥀 .${c.name}\n`;
            });
            menuText += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;
        });

        menuText += `_©SINCE 2024 STANYTZ INDUSTRIES_`;

        await sock.sendMessage(m.chat, { 
            text: menuText,
            contextInfo: {
                externalAdReply: {
                    title: "W R O N G  T U R N  6",
                    body: "System Active: 24/7",
                    thumbnailUrl: "https://telegra.ph/file/your-image-link.jpg",
                    sourceUrl: "https://github.com/stanytz",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        });
    }
};
