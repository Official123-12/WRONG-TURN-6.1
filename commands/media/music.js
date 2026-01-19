
const axios = require('axios');
module.exports = {
    name: 'music',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        const query = args.join(" ");
        if (!query) return sock.sendMessage(from, { text: "What song are you looking for?" });

        try {
            const search = await axios.get(`https://api.popcat.xyz/ytsearch?q=${encodeURIComponent(query)}`);
            const video = search.data[0];
            const res = await axios.get(`https://api.dhammasepun.me/api/ytmp3?url=${video.url}`);
            
            let caption = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
            caption += `┃  🎵 𝗠𝗨𝗦𝗜𝗖 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥   ┃\n`;
            caption += `┣━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
            caption += `┃ 🥀 𝗧𝗶𝘁𝗹𝗲: ${video.title}\n`;
            caption += `┃ 🥀 𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻: ${video.duration}\n`;
            caption += `┃ 🥀 𝗩𝗲𝗿𝘀𝗶𝗼𝗻: 𝟲.𝟲.𝟬\n`;
            caption += `┃ 🥀 𝗗𝗲𝘃: 𝗦𝗧𝗔𝗡𝗬𝗧𝗭\n`;
            caption += `┗━━━━━━━━━━━━━━━━━━━━━━━━┛`;

            await sock.sendMessage(from, { 
                audio: { url: res.data.result.download_url }, 
                mimetype: 'audio/mp4',
                fileName: `${video.title}.mp3`,
                contextInfo: { 
                    ...forwardedContext,
                    externalAdReply: {
                        title: video.title,
                        body: "WRONG TURN BOT ✔️",
                        mediaType: 1,
                        thumbnailUrl: video.thumbnail,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: m });
        } catch (e) { sock.sendMessage(from, { text: "Music not found." }); }
    }
};
