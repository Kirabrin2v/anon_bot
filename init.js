const mineflayer = require("mineflayer");
const maps = require("mineflayer-maps");

let bot = null

function init(config) {
    if (bot) {return bot}

    bot = mineflayer.createBot(config)
    bot.loadPlugin(maps.inject)

    return bot
}

function get_bot() {
    if (!bot) {throw new Error("Bot not initialized")}
    return bot
}

module.exports = { init, get_bot }
