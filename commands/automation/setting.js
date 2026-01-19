/**
 * 🥀 WRONG TURN 6 - SETTINGS DASHBOARD
 * 🥀 STYLE: VERTICAL PREMIUM
 */

const { doc, getDoc } = require('firebase/firestore');

module.exports = {
    name: 'settings',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        
        // Owner Check (Person who paired)
        const ownerId = sock.user.id.split(':')[0];
        if (!m.sender.startsWith(ownerId)) return;

        // Fetch Data from Firebase
        const snap = await getDoc(doc(db, "SETTINGS", "GLOBAL"));
        const s = snap.exists() ? snap.data() : { 
            autoAI: true, autoType: true, autoRecord: true, 
            autoStatus: true, antiLink: true, antiPorn: true, 
            antiScam: true, antiDelete: true, antiViewOnce: true, 
            forceJoin: true, mode: "public" 
        };

        let body = `╭─── • 🥀 • ───╮\n`;
        body += `  ꜱʏꜱᴛᴇᴍ ꜱᴇᴛᴛɪɴɢꜱ  \n`;
        body += `╰─── • 🥀 • ───╯\n\n`;

        body += `ʀᴇᴘʟʏ ᴡɪᴛʜ ᴀ ɴᴜᴍʙᴇʀ ᴛᴏ ᴛᴏɢɢʟᴇ:\n\n`;
        
        body += `𝟷. ᴀᴜᴛᴏ ᴀɪ ᴄʜᴀᴛ : ${s.autoAI ? '✅' : '❌'}\n`;
        body += `𝟸. ᴀᴜᴛᴏ ᴛʏᴘɪɴɢ : ${s.autoType ? '✅' : '❌'}\n`;
        body += `𝟹. ᴀᴜᴛᴏ ʀᴇᴄᴏʀᴅɪɴɢ : ${s.autoRecord ? '✅' : '❌'}\n`;
        body += `𝟺. ᴀᴜᴛᴏ ꜱᴛᴀᴛᴜꜱ : ${s.autoStatus ? '✅' : '❌'}\n`;
        body += `𝟻. ᴀɴᴛɪ ʟɪɴᴋ : ${s.antiLink ? '✅' : '❌'}\n`;
        body += `𝟼. ᴀɴᴛɪ ᴘᴏʀɴ : ${s.antiPorn ? '✅' : '❌'}\n`;
        body += `𝟽. ᴀɴᴛɪ ꜱᴄᴀᴍ : ${s.antiScam ? '✅' : '❌'}\n`;
        body += `𝟾. ᴀɴᴛɪ ᴅᴇʟᴇᴛᴇ : ${s.antiDelete ? '✅' : '❌'}\n`;
        body += `𝟿. ᴀɴᴛɪ ᴠɪᴇᴡ-ᴏɴᴄᴇ : ${s.antiViewOnce ? '✅' : '❌'}\n`;
        body += `𝟷𝟶. ꜰᴏʀᴄᴇ ᴊᴏɪɴ : ${s.forceJoin ? '✅' : '❌'}\n`;
        body += `𝟷𝟷. ʙᴏᴛ ᴍᴏᴅᴇ : *${s.mode?.toUpperCase()}*\n\n`;

        body += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;

        await sock.sendMessage(from, { 
            text: body, 
            contextInfo: {
                ...forwardedContext,
                externalAdReply: {
                    title: "WRONG TURN 6 AUTOMATION",
                    body: "OWNER CONTROL PANEL",
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    thumbnailUrl: "https://files.catbox.moe/59ays3.jpg"
                }
            }
        }, { quoted: m });
    }
};
