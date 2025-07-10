const module_name = "кто"
const help = "Определит, кто есть кто"

const structure = {
	text: {
		_type: "text",
		_description: "Текст, описывающий игрока, по которому его можно опознать. Бот попытается угадать загаданного игрока"
	}
}

const ConfigParser = require('configparser');

const path = require("path")

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const phrases = {}
phrases["кто"] = JSON.parse(config.get("phrases", "кто"))

function random_choice(array) {
	return array[Math.floor(Math.random() * array.length)]
}

function cmd_processing(sender, args, parameters) {
	try {
		const players_on_loc = parameters.players_on_loc
		let answ;
		let send_in_private_message = true;
		if (args.length == 0 || args[0] == "help") {
			answ = "Возможные аргументы: [текст, описывающий, кого нужно выбрать]. Выбирает из находящихся рядом игроков подходящего под описание"
		} else {
			if (players_on_loc.length > 1) {
				let username = random_choice(players_on_loc)
				let phrase = random_choice(phrases["кто"])
				send_in_private_message = false;
				answ = `${phrase}, ${args.join(" ")} - ${username}`
			} else {
				answ = "Никто"
			}
		}
		console.log("Ансв", answ, send_in_private_message)
		return {type: "answ",
					content: {
						message: answ,
						send_in_private_message: send_in_private_message,
						recipient: sender
					}}
	} catch (error) {
		return {type: "error",
				content: {
					date_time: new Date(),
					module_name: module_name,
					error: error,
					args: args, 
					sender: sender}}
	}
	
}

module.exports = {module_name, cmd_processing, help, structure}