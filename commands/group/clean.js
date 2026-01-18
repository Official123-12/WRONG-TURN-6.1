const { doc, getDoc } = require('firebase/firestore');
module.exports = {
    name: 'clean',
    async execute(m, sock, commands, args, db) {
        const from = m.key.remoteJid;
        const days = parseInt(args[0]) || 1; // Default 1 day
        const timeLimit = days * 86400000;
        const now = Date.now();

        const metadata = await sock.groupMetadata(from);
        const snap = await getDoc(doc(db, "ACTIVITY", from));
        const activity = snap.exists() ? snap.data() : {};
        
        let inactive = [];
        for (let p of metadata.participants) {
            const lastSeen = activity[p.id] || 0;
            if (now - lastSeen > timeLimit && !p.admin) {
                inactive.push(p.id);
                await sock.groupParticipantsUpdate(from, [p.id], "remove");
            }
        }
        await sock.sendMessage(from, { text: `🧹 Cleaned ${inactive.length} users inactive for ${days} day(s).\n\nDeveloper: STANYTZ` });
    }
};
