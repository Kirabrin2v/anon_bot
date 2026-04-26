const path = require("path");
const ConfigParser = require('configparser');

const { BaseModule } = require(path.join(__dirname, "..", "base.js"))
const { get_bot } = require(path.join(BASE_DIR, 'init.js'))
const { reg_full_nickname } = require(path.join(BASE_DIR, "./regex.js"))

const MODULE_NAME = "entities"

const config = new ConfigParser();
config.read("txt/config.ini")

const bot_username = config.get("VARIABLES", "active_nick")
const bot = get_bot()


class EntitiesModule extends BaseModule {
    constructor () {
        super(MODULE_NAME)
    }

    get_players(only_on_loc=false) {
        let players = Object.keys(bot.players)
        if (only_on_loc) {
            players = players.filter((nick) => {
                return bot.players[nick] && bot.players[nick].displayName.text !== ''
            })
        }
        return players
    }

    get_players_and_distance(bot, start_point=bot.entity.position, max_distance=512, ignore_bot=true) {
        const players = Object.entries(bot.players)

        let players_and_distances = players.map(([_nick, info]) => {
            const username = info.username;
            const entity = info.entity;

            if (username.match(reg_full_nickname) && entity && (!ignore_bot || username !== bot_username)) {
                const distance = Number(start_point.distanceTo(entity.position).toFixed(2));
                if (distance <= max_distance) {
                    return [username, distance];
                }
            }
        })
        players_and_distances = players_and_distances.filter((value) => value !== undefined)
        players_and_distances = players_and_distances.sort((player1, player2) => player1[1] - player2[1])

        return players_and_distances
    }
}

module.exports = EntitiesModule