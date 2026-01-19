/**
 * 🥀 WRONG TURN 6 - LUXURY INTERFACE
 * 🥀 STYLE: VERTICAL SMALL-CAPS
 * 🥀 LOGO: EXTERNAL AD REPLY (LARGE)
 */

module.exports = {
    name: 'menu',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        
        // 1. Runtime Logic (Uptime)
        const uptimeSeconds = process.uptime();
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptimeStr = `${hours}ʜ ${minutes}ᴍ`;

        // 2. Identify User & Developer
        const pushName = m.pushName || "ꜱᴜʙꜱᴄʀɪʙᴇʀ";
        const devName = "ꜱᴛᴀɴʏᴛᴢ"; // Developer identity remains fixed

        // 3. Command Categorization
        const categories = {};
        commands.forEach(cmd => {
            const cat = cmd.category ? cmd.category.toUpperCase() : 'ɢᴇɴᴇʀᴀʟ';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(cmd.name);
        });

        // 4. Build Menu Body (Small Caps Fonts)
        let menuBody = `╭─── • 🥀 • ───╮\n`;
        menuBody += `  ᴡ ʀ ᴏ ɴ ɢ  ᴛ ᴜ ʀ ɴ  𝟼 \n`;
        menuBody += `╰─── • 🥀 • ───╯\n\n`;

        menuBody += `┌  🥀  *ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ*\n`;
        menuBody += `│  ᴜꜱᴇʀ: ${pushName}\n`;
        menuBody += `│  ᴜᴘᴛɪᴍᴇ: ${uptimeStr}\n`;
        menuBody += `│  ᴅᴇᴠ: ${devName}\n`;
        menuBody += `│  ᴠᴇʀꜱɪᴏɴ: 𝟼.𝟼.𝟶\n`;
        menuBody += `└──────────────\n\n`;

        const sortedCats = Object.keys(categories).sort();
        for (const cat of sortedCats) {
            menuBody += `╭──〔 *${cat}* 〕\n`;
            categories[cat].sort().forEach(name => {
                menuBody += `│ ◦ .${name}\n`;
            });
            menuBody += `╰──────────────\n\n`;
        }

        menuBody += `_© 𝟮𝟬𝟮𝟲 ꜱᴛᴀɴʏᴛᴢ ɪɴᴅᴜꜱᴛʀɪᴇꜱ_`;

        // 5. Send with LARGE LOGO and Newsletter Masking
        await sock.sendMessage(from, { 
            text: menuBody, 
            contextInfo: {
                ...forwardedContext, // Newsletter forwarding info
                externalAdReply: {
                    title: "ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 : ᴍᴀɪɴꜰʀᴀᴍᴇ",
                    body: "ꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ",
                    mediaType: 1,
                    renderLargerThumbnail: true, // Hii ndio inafanya Logo iwe kubwa
                    thumbnailUrl: "https://files.catbox.moe/59ays3.jpg", // Logo yako
                    sourceUrl: "https://whatsapp.com/channel/stanytz",
                    showAdAttribution: true 
                }
            }
        }, { quoted: m });
    }
};
