module.exports = {
    name: 'demote',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;
        const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
        if (!target) return sock.sendMessage(from, { text: "Tag the user to demote." });

        await sock.groupParticipantsUpdate(from, [target], "demote");
        const quote = "The ego must fall for the system to rise. ✔️";
        await sock.sendMessage(from, { text: `🛡️ @${target.split('@')[0]} has been demoted.\n\n_${quote}_\n\nDeveloper: STANYTZ`, mentions: [target] });
    }
};
