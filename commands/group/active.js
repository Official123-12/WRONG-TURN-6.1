const { doc, getDoc } = require('firebase/firestore');
module.exports = {
    name: 'active',
    async execute(m, sock, commands, args, db) {
        const from = m.key.remoteJid;
        const snap = await getDoc(doc(db, "ACTIVITY", from));
        if (!snap.exists()) return sock.sendMessage(from, { text: "No activity data found." });

        const activity = snap.data();
        let list = `📊 *WRONG TURN 6 ACTIVE MEMBERS*\n\n`;
        Object.keys(activity).forEach(u => {
            list += `• @${u.split('@')[0]}\n`;
        });
        list += `\nDeveloper: STANYTZ`;
        await sock.sendMessage(from, { text: list, mentions: Object.keys(activity) });
    }
};
