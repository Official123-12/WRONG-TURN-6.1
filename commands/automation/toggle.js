/**
 * 🥀 WRONG TURN 6 - TOGGLE ENGINE
 * 🥀 HANDLES REPLY-BY-NUMBER FOR SETTINGS
 */

const { doc, setDoc, getDoc } = require('firebase/firestore');

module.exports = {
    name: 'toggle',
    async execute(m, sock, commands, args, db, forwardedContext) {
        const from = m.key.remoteJid;
        const choice = args[0];
        
        if (!choice || isNaN(choice)) return;

        const settingsRef = doc(db, "SETTINGS", "GLOBAL");
        const snap = await getDoc(settingsRef);
        const s = snap.exists() ? snap.data() : {};

        // Mapping Numbers to Firebase Keys
        const menuMap = {
            "1": "autoAI",
            "2": "autoType",
            "3": "autoRecord",
            "4": "autoStatus",
            "5": "antiLink",
            "6": "antiPorn",
            "7": "antiScam",
            "8": "antiDelete",
            "9": "antiViewOnce",
            "10": "forceJoin"
        };

        const key = menuMap[choice];

        if (key) {
            const newState = !s[key];
            await setDoc(settingsRef, { [key]: newState }, { merge: true });
            
            let res = `╭─── • 🥀 • ───╮\n  ꜱʏꜱᴛᴇᴍ ᴜᴘᴅᴀᴛᴇ  \n╰─── • 🥀 • ───╯\n\n`;
            res += `🥀 *ꜰᴇᴀᴛᴜʀᴇ* : ${key.toUpperCase()}\n`;
            res += `🥀 *ꜱᴛᴀᴛᴜꜱ* : ${newState ? 'ᴀᴄᴛɪᴠᴀᴛᴇᴅ ✅' : 'ᴅᴇᴀᴄᴛɪᴠᴀᴛᴇᴅ ❌'}\n\n`;
            res += `_ᴅᴇᴠ: ꜱᴛᴀɴʏᴛᴢ_`;

            await sock.sendMessage(from, { text: res, contextInfo: forwardedContext });
        } else if (choice === "11") {
            // Special Logic for Mode (Public/Private)
            const newMode = s.mode === "public" ? "private" : "public";
            await setDoc(settingsRef, { mode: newMode }, { merge: true });
            await sock.sendMessage(from, { text: `🥀 *ꜱʏꜱᴛᴇᴍ ᴍᴏᴅᴇ* : ${newMode.toUpperCase()}`, contextInfo: forwardedContext });
        }
    }
};
