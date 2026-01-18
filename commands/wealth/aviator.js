module.exports = {
    name: "aviator",
    async execute(sock, msg, args) {
        const crash = (Math.random() * 3 + 1.2).toFixed(2);
        await sock.sendMessage(msg.key.remoteJid, { text: `✈️ *AVIATOR AI PREDICTION:*\n\nNext crash: *${crash}x*\n\n_Powered by WRONG TURN 6_` });
    }
};
