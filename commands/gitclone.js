module.exports = {
    name: 'gitclone',
    async execute(m, sock, commands, args) {
        const from = m.key.remoteJid;
        if (!args[0]) return sock.sendMessage(from, { text: "Provide GitHub Repo link." }, { quoted: m });
        try {
            let regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i;
            if (!regex.test(args[0])) return sock.sendMessage(from, { text: "Invalid GitHub URL." }, { quoted: m });
            let [_, user, repo] = args[0].match(regex);
            repo = repo.replace(/.git$/, '');
            let url = `https://api.github.com/repos/${user}/${repo}/zipball`;
            await sock.sendMessage(from, { 
                document: { url }, 
                fileName: `${repo}.zip`, 
                mimetype: 'application/zip',
                caption: `WRONG TURN 6 ✔️\nDeveloper: STANYTZ`
            }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: "Failed to clone repository." }, { quoted: m });
        }
    }
};
