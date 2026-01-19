const axios = require('axios');
module.exports = {
    name: 'iplookup',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        if (!args[0]) return sock.sendMessage(from, { text: "ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀɴ ɪᴘ ᴀᴅᴅʀᴇꜱꜱ." });

        try {
            const res = await axios.get(`http://ip-api.com/json/${args[0]}?fields=66846719`);
            const d = res.data;
            if (d.status !== 'success') return m.reply("ɪɴᴠᴀʟɪᴅ ɪᴘ ᴛᴀʀɢᴇᴛ.");

            let resMsg = `╭─── • 🥀 • ───╮\n`;
            resMsg += `  ɪ ᴘ  ᴛ ᴀ ʀ ɢ ᴇ ᴛ  \n`;
            resMsg += `╰─── • 🥀 • ───╯\n\n`;
            resMsg += `│ ◦ ɪᴘ: ${d.query}\n`;
            resMsg += `│ ◦ ɪꜱᴘ: ${d.isp}\n`;
            resMsg += `│ ◦ ᴄɪᴛʏ: ${d.city}\n`;
            resMsg += `│ ◦ ʀᴇɢɪᴏɴ: ${d.regionName}\n`;
            resMsg += `│ ◦ ᴛɪᴍᴇᴢᴏɴᴇ: ${d.timezone}\n`;
            resMsg += `│ ◦ ᴄᴏᴏʀᴅꜱ: ${d.lat}, ${d.lon}\n`;
            resMsg += `└──────────────\n\n`;
            resMsg += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;

            await sock.sendMessage(from, { text: resMsg, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) { m.reply("ʟᴏᴏᴋᴜᴘ ꜰᴀɪʟᴇᴅ."); }
    }
};
