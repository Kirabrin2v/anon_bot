const module_name = "выбери"
const help = "Помогает определиться с выбором"

const structure = {
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


const ConfigParser = require('configparser');

const path = require("path")

const { random_choice } = require(path.join(__dirname, "..", "..", "utils", "random.js"))
 
const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const phrases = {}
phrases["warn_use_cmd"] = config.get("phrases", "warn_use_cmd")
phrases["выбери"] = JSON.parse(config.get("phrases", "выбери"))

const permanent_memory = new ConfigParser();
permanent_memory.read(path.join(__dirname, "permanent_memory.ini"))

var informed_users = JSON.parse(permanent_memory.get("informed_users", "rules_set_nick"))


let actions = [] 

function cmd_processing(sender, args, cmd_parameters, valid_args) {
	args = valid_args
	let answ;

	if (informed_users.includes(sender)) {
		const variant = random_choice([args[0].value, args[2].value])
		const phrase = random_choice(phrases["выбери"])
		answ = `${phrase} - ${variant}`

	} else {
		answ = phrases["warn_use_cmd"]
		actions.push({
			type: "wait_data",
			module_name: module_name,
			content: {
				type: "message",
				sender: sender
			}
		})
	}

	if (answ) {
		return {
			type: "answ",
			content: {
				message: answ,
				recipient: sender
			}
		}
	}
}

function message_processing(sender, message, type_chat) {
	if (["0k", "ok", "оk", "oк", "да", "хорошо"].includes(message.toLowerCase())) {
		informed_users.push(sender)
		permanent_memory.set("informed_users", "rules_set_nick", JSON.stringify(informed_users))
		permanent_memory.write(path.join(__dirname, "permanent_memory.ini"))

		actions.push({type: "answ",
					content: {
						recipient: sender,
						message: "Ура! Повторите свою команду"
					}})

	} else {
		actions.push({type: "answ",
					content: {
						recipient: sender,
						message: "Я ожидал другой ответ :<"
					}})
	}
}


function diagnostic_eval(eval_expression) {
	try {
		return eval(eval_expression)
	} catch (error) {
		return error
	}
}

function get_actions() {
	return actions.splice(0)
}

module.exports = {module_name, get_actions, message_processing, cmd_processing, diagnostic_eval, structure, help}