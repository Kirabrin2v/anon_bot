const module_name = "шанс"
const help = "Показывает вероятность события"

const structure = {
	описание: {
		_type: "text",
		_description: "Описание ситуации, шанс для которой нужно вычислить"
	}
}

const ConfigParser = require('configparser');

const path = require("path")

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const phrases = {}
phrases["шанс"] = JSON.parse(config.get("phrases", "шанс"))

function random_choice(array) {
	return array[Math.floor(Math.random() * array.length)]
}

function random_number (min_num, max_num) {
	return Math.floor(Math.random() * (max_num - min_num + 1)) + min_num;
}

function cmd_processing(sender, args) {
	try {
		if (args.length == 0 || args[0] == "help") {
			answ = "Возможные аргументы: [*Описание события, вероятность которого нужно определить*]"
			return {type: "answ",
					content: {
						message: answ,
						recipient: sender
					}}
		} else {
			let phrase = random_choice(phrases["шанс"])
			answ = `${phrase}, шанс ${args.join(" ")} - ${random_number(0, 101)}%`
		}
		return {type: "answ",
				content: {
					recipient: sender,
					message: answ,
					send_in_private_message: false}}

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

function diagnostic_eval (eval_expression) {
	try {
		return eval(eval_expression)
	} catch (error) {
		return error
	}
}

module.exports = {module_name, cmd_processing, diagnostic_eval, help, structure}
