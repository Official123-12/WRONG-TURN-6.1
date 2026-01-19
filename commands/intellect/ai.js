const axios = require('axios');
module.exports = {
    name: 'ai',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        const query = args.join(" ");
        if (!query) return sock.sendMessage(from, { text: "ʜᴏᴡ ᴄᴀɴ ɪ ᴀꜱꜱɪꜱᴛ ʏᴏᴜ ᴛᴏᴅᴀʏ?" });

        try {
            const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(query)}?system=You are WRONG TURN 6 AI developed by STANYTZ. Be helpful and professional.`);
            let resMsg = `╭─── • 🥀 • ───╮\n`;
            resMsg += `   ᴀ ɪ  ᴇ ɴ ɢ ɪ ɴ ᴇ   \n`;
            resMsg += `╰─── • 🥀 • ───╯\n\n`;
            resMsg += `${res.data}\n\n`;
            resMsg += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(from, { text: resMsg, contextInfo: forwardedContext }, { quoted: m });
        } catch (e) { m.reply("AI Server Busy."); }
    }
};
