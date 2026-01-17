module.exports = {
  name: 'menu',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const vcard = 'BEGIN:VCARD\nVERSION:3.0\nFN:WRONG TURN 6 ✔️\nORG:STANYTZ;\nEND:VCARD';
    
    await sock.sendMessage(from, { contacts: { displayName: 'STANYTZ', contacts: [{ vcard }] } });

    let menu = `┏━━━━ 『 *WRONG TURN 6* 』 ━━━━┓\n`;
    menu += `┃ 🥀 *Developer:* STANYTZ\n`;
    menu += `┃ 🌷 *Theme:* Obsidian Red\n`;
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;

    const cats = {};
    global.commands.forEach(c => {
      if (!cats[c.category]) cats[c.category] = [];
      cats[c.category].push(c.name);
    });

    for (const [category, cmds] of Object.entries(cats)) {
      menu += `┏━━━〔 *${category.toUpperCase()}* 〕━━━┓\n`;
      cmds.forEach(name => menu += `┃ 🥀 .${name}\n`);
      menu += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;
    }

    await sock.sendMessage(from, { 
      text: menu,
      contextInfo: { externalAdReply: { title: "STANYTZ BOT ACTIVE", body: "WRONG TURN 6", mediaType: 1, thumbnailUrl: "https://files.catbox.moe/59ays3.jpg" }}
    });
  }
};
