const axios = require('axios');
module.exports = {
    name: 'deepthink',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const query = args.join(" ");
        if (!query) return m.reply("Provide a topic for deep analysis.");
        try {
            const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(query)}?system=Perform a deep, logical, and step-by-step analytical thought process on the following topic.`);
            let resMsg = `╭─── • 🥀 • ───╮\n`;
            resMsg += `   ᴅ ᴇ ᴇ ᴘ  ᴛ ʜ ɪ ɴ ᴋ  \n`;
            resMsg += `╰─── • 🥀 • ───╯\n\n`;
            resMsg += `${res.data}\n\n`;
            resMsg += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            await sock.sendMessage(m.key.remoteJid, { text: resMsg, contextInfo: forwardedContext });
        } catch (e) { m.reply("Thinking process failed."); }
    }
};
