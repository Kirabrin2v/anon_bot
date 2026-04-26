const mineflayer = require("mineflayer");
const maps = require("mineflayer-maps");

let bot = null

function init(config) {
    if (bot) {return bot}

    bot = mineflayer.createBot(config)
    bot.loadPlugin(maps.inject)
    bot.on('resourcePack', (url, hash) => {
        console.log("Ресурспак")
        bot.denyResourcePack()
    })

    bot.on('end', function kicked(reason) {
        console.log("Закончил " + reason)
        console.log(1)
        process.exit(-1);
    })

    bot.on('kicked', (reason, loggedIn) => {
        console.log(reason, loggedIn)
    })

    return bot
}

function get_bot() {
    if (!bot) {throw new Error("Bot not initialized")}
    return bot
}

module.exports = { init, get_bot }
