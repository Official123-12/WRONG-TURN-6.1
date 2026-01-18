module.exports = {
    name: 'promote',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;
        const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid[0] || m.message.extendedTextMessage?.contextInfo?.participant;
        if (!target) return sock.sendMessage(from, { text: "Tag the user to promote." });

        await sock.groupParticipantsUpdate(from, [target], "promote");
        const quote = "With great power comes great responsibility. ✔️";
        await sock.sendMessage(from, { text: `🛡️ @${target.split('@')[0]} is now an Admin.\n\n_${quote}_\n\nDeveloper: STANYTZ`, mentions: [target] });
    }
};
