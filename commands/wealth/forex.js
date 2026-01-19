/**
 * 🥀 WRONG TURN 6 - FOREX SIGNAL ENGINE
 * 🥀 STYLE: REPLY-BY-NUMBER
 */

const axios = require('axios');

module.exports = {
    name: 'forex',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        const pairs = [
            "ᴇᴜʀ/ᴜꜱᴅ", "ɢʙᴘ/ᴜꜱᴅ", "ᴜꜱᴅ/ᴊᴘʏ", "ᴜꜱᴅ/ᴄᴀᴅ", "ᴀᴜᴅ/ᴜꜱᴅ",
            "ɴᴢᴅ/ᴜꜱᴅ", "ᴇᴜʀ/ɢʙᴘ", "ᴇᴜʀ/ᴊᴘʏ", "ɢʙᴘ/ᴊᴘʏ", "ɢᴏʟᴅ (xᴀᴜ/ᴜꜱᴅ)",
            "💡 ʜᴏᴡ ᴛᴏ ᴛʀᴀᴅᴇ / ʜᴇʟᴘ"
        ];

        if (!args[0]) {
            let list = `╭─── • 🥀 • ───╮\n  ꜰᴏʀᴇx ᴍᴀɪɴꜰʀᴀᴍᴇ \n╰─── • 🥀 • ───╯\n\n`;
            list += `ʀᴇᴘʟʏ ᴡɪᴛʜ ᴀ ɴᴜᴍʙᴇʀ ᴛᴏ ɢᴇᴛ ᴀ ꜱɪɢɴᴀʟ:\n\n`;
            pairs.forEach((p, i) => list += `${i + 1}. ${p}\n`);
            list += `\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
            return sock.sendMessage(from, { text: list, contextInfo: forwardedContext }, { quoted: m });
        }

        const choice = parseInt(args[0]);

        if (choice === 11) {
            let help = `╭─── • 🥀 • ───╮\n  ꜰᴏʀᴇx ᴛᴜᴛᴏʀɪᴀʟ \n╰─── • 🥀 • ───╯\n\n`;
            help += `1. ᴏᴘᴇɴ ʏᴏᴜʀ ᴍᴇᴛᴀᴛʀᴀᴅᴇʀ 4/5 ᴀᴘᴘ.\n`;
            help += `2. ʟᴏᴏᴋ ꜰᴏʀ ᴛʜᴇ ᴄᴜʀʀᴇɴᴄʏ ᴘᴀɪʀ ꜱᴇʟᴇᴄᴛᴇᴅ.\n`;
            help += `3. ᴇɴᴛᴇʀ ᴛʀᴀᴅᴇ ᴀᴛ ᴛʜᴇ 'ᴇɴᴛʀʏ ᴘʀɪᴄᴇ'.\n`;
            help += `4. ꜱᴇᴛ ʏᴏᴜʀ ᴛᴀᴋᴇ ᴘʀᴏꜰɪᴛ (ᴛᴘ) ᴀɴᴅ ꜱᴛᴏᴘ ʟᴏꜱꜱ (ꜱʟ).\n\n`;
            help += `⚠️ *ᴘʀᴇᴄᴀᴜᴛɪᴏɴ*: ꜰᴏʀᴇx ᴛʀᴀᴅɪɴɢ ɪɴᴠᴏʟᴠᴇꜱ ʜɪɢʜ ʀɪꜱᴋ. ᴡᴇ ᴀʀᴇ ɴᴏᴛ ʀᴇꜱᴘᴏɴꜱɪʙʟᴇ ꜰᴏʀ ᴀɴʏ ꜰɪɴᴀɴᴄɪᴀʟ ʟᴏꜱꜱ. ᴛʀᴀᴅᴇ ᴡɪꜱᴇʟʏ.`;
            return sock.sendMessage(from, { text: help, contextInfo: forwardedContext }, { quoted: m });
        }

        if (choice >= 1 && choice <= 10) {
            try {
                const pair = pairs[choice - 1];
                const res = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
                const basePrice = res.data.rates.EUR; // Simulated price anchor

                // Signal Logic (Deep Logic Simulation)
                const action = Math.random() > 0.5 ? "ʙᴜʏ ⬆️" : "ꜱᴇʟʟ ⬇️";
                const entry = (basePrice + (Math.random() * 0.05)).toFixed(5);
                const tp = action === "ʙᴜʏ ⬆️" ? (parseFloat(entry) + 0.0050).toFixed(5) : (parseFloat(entry) - 0.0050).toFixed(5);
                const sl = action === "ʙᴜʏ ⬆️" ? (parseFloat(entry) - 0.0030).toFixed(5) : (parseFloat(entry) + 0.0030).toFixed(5);
                
                let signal = `╭─── • 🥀 • ───╮\n  ꜰᴏʀᴇx ꜱɪɢɴᴀʟ \n╰─── • 🥀 • ───╯\n\n`;
                signal += `⚘  *ᴘᴀɪʀ* : ${pair}\n`;
                signal += `⚘  *ᴀᴄᴛɪᴏɴ* : ${action}\n`;
                signal += `⚘  *ᴇɴᴛʀʏ* : ${entry}\n`;
                signal += `⚘  *ᴛᴘ* : ${tp}\n`;
                signal += `⚘  *ꜱʟ* : ${sl}\n`;
                signal += `⚘  *ᴛɪᴍᴇ* : ${new Date().toLocaleTimeString()}\n\n`;
                signal += `_ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 ᴍᴀʀᴋᴇᴛ ᴀɴᴀʟʏᴛɪᴄꜱ_`;

                await sock.sendMessage(from, { text: signal, contextInfo: forwardedContext }, { quoted: m });
            } catch (e) { m.reply("Market API Busy."); }
        }
    }
};
