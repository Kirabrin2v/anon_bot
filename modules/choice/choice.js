const ConfigParser = require('configparser');

const path = require("path")

const { random_choice } = require(path.join(__dirname, "..", "..", "utils", "random.js"))
const { BaseModule } = require(path.join(__dirname, "../base.js"))
 

const MODULE_NAME = "выбери"
const HELP = "Помогает определиться с выбором"
const INTERVAL_CHECK_ACTIONS = 500
const STRUCTURE = {
	variant1: {
		или: {
			variant2: {
				_type: "string",
				_description: "Второй возможный вариант"
			},
			_description: "Разделитель между вариантами"
		},
		_type: "string",
		_description: "Первый возможный вариант"
	}
}

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))
const permanent_memory = new ConfigParser();
permanent_memory.read(path.join(__dirname, "permanent_memory.ini"))

const phrases = {}
phrases["warn_use_cmd"] = config.get("phrases", "warn_use_cmd")
phrases["выбери"] = JSON.parse(config.get("phrases", "выбери"))


const informed_users = JSON.parse(permanent_memory.get("informed_users", "rules_set_nick"))


class ChoiceModule extends BaseModule {
	constructor () {
		super(MODULE_NAME, HELP, STRUCTURE, INTERVAL_CHECK_ACTIONS)
	}

	_process(sender, args, cmd_parameters) {
		let answ;
		let send_in_private_message = true;

		if (informed_users.includes(sender)) {
			const variant = random_choice([args[0].value, args[2].value])
			const phrase = random_choice(phrases["выбери"])
			answ = `${phrase} - ${variant}`
			send_in_private_message = false;

		} else {
			answ = phrases["warn_use_cmd"]
			this.actions.push({
				type: "wait_data",
				module_name: this.module_name,
				content: {
					type: "message",
					sender: sender
				}
			})
		}

		if (answ) {
			return {
				message: answ,
				send_in_private_message
			}
		}
	}

	message_processing(sender, message) {
		if (["0k", "ok", "оk", "oк", "да", "хорошо"].includes(message.toLowerCase())) {
			informed_users.push(sender)
			permanent_memory.set("informed_users", "rules_set_nick", JSON.stringify(informed_users))
			permanent_memory.write(path.join(__dirname, "permanent_memory.ini"))

			this.actions.push({type: "answ",
						content: {
							recipient: sender,
							message: "Ура! Повторите свою команду"
						}})

		} else {
			this.actions.push({type: "answ",
						content: {
							recipient: sender,
							message: "Я ожидал другой ответ :<"
						}})
		}
	}
}

module.exports = ChoiceModule