/**
 * 🥀 WRONG TURN 6 - SUPREME HUB
 * 🥀 THEME: LUXURY VERTICAL (NO TICKS)
 * 🥀 LOGO: LARGE THUMBNAIL ENABLED
 */

const { doc, getDoc } = require('firebase/firestore');

module.exports = {
    name: 'menu',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        const pushName = m.pushName || "ꜱᴜʙꜱᴄʀɪʙᴇʀ";

        // 1. FETCH CONFIG KUTOKA FIREBASE (Prefix & Mode)
        const setSnap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const config = setSnap.exists() ? setSnap.data() : { prefix: ".", mode: "public" };
        
        const currentPrefix = config.prefix || ".";
        const currentMode = config.mode ? config.mode.toUpperCase() : "PUBLIC";
        const totalCommands = commands.length;

        // 2. UPTIME CALCULATION
        const uptimeSeconds = process.uptime();
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptimeStr = `${hours}ʜ ${minutes}ᴍ`;

        // 3. CATEGORIZE COMMANDS
        const categories = {};
        commands.forEach(cmd => {
            const cat = cmd.category ? cmd.category.toUpperCase() : 'ɢᴇɴᴇʀᴀʟ';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(cmd.name);
        });

        // 4. BUILD LUXURY MENU BODY (FONTS ZA KISHUWA)
        let menuBody = `╭─── • 🥀 • ───╮\n`;
        menuBody += `  ᴡ ʀ ᴏ ɴ ɢ  ᴛ ᴜ ʀ ɴ  𝟼 \n`;
        menuBody += `╰─── • 🥀 • ───╯\n\n`;

        menuBody += `┌  🥀  *ꜱʏꜱᴛᴇᴍ  ɪɴꜰᴏ*\n`;
        menuBody += `│  ᴜꜱᴇʀ: ${pushName}\n`;
        menuBody += `│  ᴍᴏᴅᴇ: ${currentMode}\n`;
        menuBody += `│  ᴘʀᴇꜰɪx: [ ${currentPrefix} ]\n`;
        menuBody += `│  ᴛᴏᴛᴀʟ: ${totalCommands} ᴄᴍᴅꜱ\n`;
        menuBody += `│  ᴜᴘᴛɪᴍᴇ: ${uptimeStr}\n`;
        menuBody += `│  ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ\n`;
        menuBody += `└──────────────\n\n`;

        const sortedCats = Object.keys(categories).sort();
        for (const cat of sortedCats) {
            menuBody += `╭── • *${cat}* •\n`;
            categories[cat].sort().forEach(name => {
                menuBody += `│ ◦ ${currentPrefix}${name}\n`;
            });
            menuBody += `╰──────────────\n\n`;
        }

        menuBody += `_© 𝟮𝟬𝟮𝟲 ꜱᴛᴀɴʏᴛᴢ ɪɴᴅᴜꜱᴛʀɪᴇs_`;

        // 5. SENDING THE MESSAGE WITH THE LARGE LOGO
        await sock.sendMessage(from, { 
            text: menuBody, 
            contextInfo: {
                ...forwardedContext, // Newsletter masking
                externalAdReply: {
                    title: "ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 : ᴍᴀɪɴꜰʀᴀᴍᴇ",
                    body: "ꜱʏꜱᴛᴇᴍ ᴀʀᴍᴇᴅ & ᴏᴘᴇʀᴀᴛɪᴏɴᴀʟ",
                    mediaType: 1, // Lazima iwe 1 kwa ajili ya picha
                    renderLargerThumbnail: true, // HII NDIO INAONYESHA LOGO KWA UKUBWA
                    thumbnailUrl: "https://files.catbox.moe/59ays3.jpg", // Logo yako
                    sourceUrl: "https://whatsapp.com/channel/stanytz",
                    showAdAttribution: true 
                }
            }
        }, { quoted: m });
    }
};
