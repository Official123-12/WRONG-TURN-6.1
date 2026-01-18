const { doc, setDoc } = require('firebase/firestore');
module.exports = {
    name: 'countryblock',
    async execute(m, sock, commands, args, db) {
        const from = m.key.remoteJid;
        if (!args[0]) return sock.sendMessage(from, { text: "Usage: .countryblock 1,44 (comma separated codes)" });

        const codes = args[0].split(',');
        await setDoc(doc(db, "GROUPS", from), { bannedCodes: codes }, { merge: true });
        await sock.sendMessage(from, { text: `🛡️ WRONG TURN 6 will now remove users joining from: +${codes.join(', +')}\n\nDeveloper: STANYTZ` });
    }
};
