module.exports = {
    name: "forex",
    async execute(sock, msg, args) {
        const signal = `📉 *NEURAL FOREX SIGNAL* 📉\n\nPair: *XAUUSD (Gold)*\nAction: *SELL*\nEntry: 2045.00\nTP: 2030.00\nSL: 2055.00\n\n_Risk: High. Use proper lot size._`;
        await sock.sendMessage(msg.key.remoteJid, { text: signal });
    }
};
