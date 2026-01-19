const { doc, getDoc } = require('firebase/firestore');
module.exports = {
    name: 'active',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        const snap = await getDoc(doc(db, "ACTIVITY", from));
        if (!snap.exists()) return m.reply("No activity recorded yet.");

        const activity = snap.data();
        let list = `*ACTIVE MEMBERS* ✔️\n\n`;
        Object.keys(activity).forEach(u => list += `• @${u.split('@')[0]}\n`);
        
        await sock.sendMessage(from, { text: list, mentions: Object.keys(activity), contextInfo: forwardedContext });
    }
};
