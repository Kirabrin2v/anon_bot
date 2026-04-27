const ConfigParser = require('configparser');
const path = require("path")

const { random_choice, random_number } = require(path.join(BASE_DIR, "utils", "random.js"))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const MODULE_NAME = "шанс"
const HELP = "Показывает вероятность события"

const STRUCTURE = {
	описание: {
		_type: "text",
		_description: "Описание ситуации, шанс для которой нужно вычислить"
	}
}

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const phrases = {}
phrases["шанс"] = JSON.parse(config.get("phrases", "шанс"))

class ChanceModule extends BaseModule {
	constructor () {
        super(MODULE_NAME, HELP, STRUCTURE)
    }

    _process(sender, args) {
		const phrase = random_choice(phrases["шанс"])
		const answ = `${phrase}, шанс ${args[0].value} - ${random_number(0, 101)}%`

		return {
			message: answ,
			send_in_private_message: false
		}
	}
}


module.exports = ChanceModule
