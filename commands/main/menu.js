module.exports = {
    name: 'menu',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;
        
        // 1. Send Verified VCard first
        const vcard = 'BEGIN:VCARD\n' +
                      'VERSION:3.0\n' +
                      'FN:WRONG TURN 6 ✔️\n' + // Blue Tick
                      'ORG:STANYTZ;\n' +
                      'TEL;type=CELL;type=VOICE;waid=255518558502:255618558502\n' + // Weka namba yako hapa
                      'END:VCARD';

        await sock.sendMessage(from, { 
            contacts: { 
                displayName: 'STANYTZ', 
                contacts: [{ vcard }] 
            } 
        });

        // 2. Build the Menu Header
        let menu = `┏━━━━ 『 *WRONG TURN 6* 』 ━━━━┓\n`;
        menu += `┃ 🥀 *Developer:* STANYTZ\n`;
        menu += `┃ 🌷 *Theme:* Obsidian Red\n`;
        menu += `┃ 🥀 *Commands:* ${commands.length}\n`;
        menu += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;

        // 3. Group Commands by Category (Folders)
        const cats = {};
        commands.forEach(c => {
            if (!cats[c.category]) cats[c.category] = [];
            cats[c.category].push(c.name);
        });

        // 4. Build Vertical Menu Body
        for (const [category, cmds] of Object.entries(cats)) {
            menu += `┏━━━〔 *${category.toUpperCase()}* 〕━━━┓\n`;
            cmds.forEach(name => {
                menu += `┃ 🥀 .${name}\n`;
            });
            menu += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;
        }

        // 5. Send Menu with Ad Reply (Thumbnail)
        await sock.sendMessage(from, { 
            text: menu,
            contextInfo: { 
                externalAdReply: { 
                    title: "WRONG TURN 6 ACTIVE", 
                    body: "STANYTZ MASTER ENGINE", 
                    mediaType: 1, 
                    thumbnailUrl: "https://files.catbox.moe/59ays3.jpg", // Logo yako
                    sourceUrl: "https://github.com/stanytz",
                    renderLargerThumbnail: true
                } 
            }
        }, { quoted: m });
    }
};
