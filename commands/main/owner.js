module.exports = {
    name: 'owner',
    async execute(m, sock) {
        const from = m.key.remoteJid;
        
        // Verified VCard
        const vcard = 'BEGIN:VCARD\n' +
                      'VERSION:3.0\n' +
                      'FN:STANYTZ ✔️\n' +
                      'ORG:WRONG TURN 6;\n' +
                      'TEL;type=CELL;type=VOICE;waid=255712345678:255712345678\n' + 
                      'END:VCARD';

        await sock.sendMessage(from, { 
            contacts: { 
                displayName: 'STANYTZ', 
                contacts: [{ vcard }] 
            } 
        });

        const msg = `WRONG TURN 6 ✔️\nDeveloper: STANYTZ\nRole: Lead Architect\nGitHub: github.com/stanytz`;
        
        await sock.sendMessage(from, { text: msg }, { quoted: m });
    }
};
