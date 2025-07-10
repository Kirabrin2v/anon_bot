const module_name = "alias"
const help = "Изменяет то, как бот к Вас обращается"

const reg_nickname = String.raw`([А-яA-Za-z0-9~!@#$^*\-_=+ёЁ]{1,16})`;

const structure = {
    alias: {
    	_type: "nick",
    	_description: "Псевдоним, по которому бот будет к Вам обращаться"
    }
  
};

const ConfigParser = require('configparser');

const path = require("path")

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const phrases = {}
phrases["warn_use_cmd"] = config.get("phrases", "warn_use_cmd")

const permanent_memory = new ConfigParser();
permanent_memory.read(path.join(__dirname, "permanent_memory.ini"))

var informed_users = JSON.parse(permanent_memory.get("informed_users", "rules_set_nick"))

const reg_normal_nick = new RegExp("^[A-zА-яЁё0-9!@#$^*_\\-=]{1,16}$")

var wait_confirm_set_nick = {}

var actions = []

function set_new_nick(sender, nick) {
	actions.push({type: "update_stats",
					content: {
						nickname: sender,
						key:"name",
						value: nick
								}})
	const answ = "Ник успешно изменён"
	actions.push({type: "answ",
				content: {
					recipient: sender,
					message: answ
				}})
}

function cmd_processing(sender, args, parameters) {
	try {
		const rank = parameters.rank_sender
		let answ;
		let actions = []
		if (args.length == 0 || args[0] == "help") {
			answ = "Возможные аргументы: [Ваш псевдоним]"

		} else {
			if (rank >= 2) {
				const nick = args[0]
				if (informed_users.includes(sender)) {
					set_new_nick(sender, nick)
				} else {
					if (nick.match(reg_normal_nick)) {
						answ = phrases["warn_use_cmd"]
						wait_confirm_set_nick[sender] = nick
						actions.push({type: "wait_data",
								module_name: module_name,
								content: {type: "message",
											sender: sender}})
					} else {
						answ = "Ник должен быть меньше 17 символов и не содержать специальных символов"
					}
				}
			} else {
				answ = "Смена ника доступна со звания Стажёр"
			}
		}

	if (answ) {
		actions.push({type: "answ",
					content: {
						message: answ,
						recipient: sender
					}})
	}	

	return actions;

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

function message_processing (sender, message, type_chat) {
	if (wait_confirm_set_nick[sender]) {
		if (["0k", "ok", "оk", "oк", "да", "хорошо"].includes(message.toLowerCase())) {
			set_new_nick(sender, wait_confirm_set_nick[sender])
			informed_users.push(sender)
			permanent_memory.set("informed_users", "rules_set_nick", JSON.stringify(informed_users))
			permanent_memory.write(path.join(__dirname, "permanent_memory.ini"))
		} else {
			delete wait_confirm_set_nick[sender]
			actions.push({type: "answ",
						content: {
							recipient: sender,
							message: "Я ожидал другой ответ :<"
						}})
		}
	}
}

function get_actions() {
	return actions.splice(0)
}

module.exports = {module_name, cmd_processing, message_processing, get_actions, help, structure}
