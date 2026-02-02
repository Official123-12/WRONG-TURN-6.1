const fonts = {'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ꜰ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'s','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ'};

const kishuwa = (text) => text?.toString().toLowerCase().split('').map(char => fonts[char] || char).join('') || '';

const newsContext = (title = 'ᴡʀᴏɴɢ ᴛᴜʀɴ 𝟼 🥀') => ({
    forwardingScore: 999, isForwarded: true,
    forwardedNewsletterMessageInfo: { 
        newsletterJid: '120363404317544295@newsletter', 
        serverMessageId: 1, 
        newsletterName: title 
    }
});

module.exports = { kishuwa, newsContext };
