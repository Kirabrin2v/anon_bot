const ConfigParser = require('configparser');
const path = require("path")

const { random_choice } = require(path.join(BASE_DIR, "utils", "random.js"))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const MODULE_NAME = "кто"
const HELP = "Определит, кто есть кто"

const STRUCTURE = {
	text: {
		_type: "text",
		_description: "Текст, описывающий игрока, по которому его можно опознать. Бот попытается угадать загаданного игрока"
	}
}


const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const phrases = {}
phrases["кто"] = JSON.parse(config.get("phrases", "кто"))


class WhoModule extends BaseModule {
	constructor () {
        super(MODULE_NAME, HELP, STRUCTURE)
    }

	_process(sender, args, parameters) {
		const players_on_loc = parameters.players_on_loc
		let answ;

		if (players_on_loc.length > 1) {
			const username = random_choice(players_on_loc)
			const phrase = random_choice(phrases["кто"])
			answ = `${phrase}, ${args.join(" ")} - ${username}`
		} else {
			answ = "Никто"
		}
		return answ
	}    
}


module.exports = WhoModule