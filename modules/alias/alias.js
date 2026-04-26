const ConfigParser = require('configparser');
const path = require("path");

const { reg_full_nickname } = require(path.join(BASE_DIR, "regex.js"))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const MODULE_NAME = "alias"
const HELP = "Изменяет то, как бот к Вас обращается"
const INTERVAL_CHECK_ACTIONS = 1000
const STRUCTURE = {
    alias: {
    	_type: "nick",
    	_description: "Псевдоним, по которому бот будет к Вам обращаться"
    }
  
};


const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))
const permanent_memory = new ConfigParser();
permanent_memory.read(path.join(__dirname, "permanent_memory.ini"))

const phrases = {}
phrases["warn_use_cmd"] = config.get("phrases", "warn_use_cmd")

const informed_users = JSON.parse(permanent_memory.get("informed_users", "rules_set_nick"))

const wait_confirm_set_nick = {}


class AliasModule extends BaseModule {
	constructor () {
        super(MODULE_NAME, HELP, STRUCTURE, INTERVAL_CHECK_ACTIONS)
    }

    set_new_nick(sender, nick) {
		this.actions.push({
			type: "update_stats",
			content: {
				nickname: sender,
				key:"name",
				value: nick
			}
		})
		const answ = "Ник успешно изменён"
		this.actions.push({
			type: "answ",
			content: {
				recipient: sender,
				message: answ
			}
		})
	}

	_process(sender, args, parameters) {
		const rank = parameters.rank_sender
		let answ;
		if (args.length === 0 || args[0] === "help") {
			answ = "Возможные аргументы: [Ваш псевдоним]"

		} else {
			if (rank >= 2) {
				const nick = args[0]
				if (informed_users.includes(sender)) {
					this.set_new_nick(sender, nick)
				} else {
					if (nick.match(reg_full_nickname)) {
						answ = phrases["warn_use_cmd"]
						wait_confirm_set_nick[sender] = nick
						this.actions.push({
							type: "wait_data",
							module_name: this.module_name,
							content: {
								type: "message",
								sender: sender
							}
						})
					} else {
						answ = "Ник должен быть меньше 17 символов и не содержать специальных символов"
					}
				}
			} else {
				answ = "Смена ника доступна со звания Стажёр"
			}
		}

		if (answ) {
			return answ
		}	
	}

	message_processing(sender, message) {
		if (wait_confirm_set_nick[sender]) {
			if (["0k", "ok", "оk", "oк", "да", "хорошо"].includes(message.toLowerCase())) {
				this.set_new_nick(sender, wait_confirm_set_nick[sender])
				informed_users.push(sender)
				permanent_memory.set("informed_users", "rules_set_nick", JSON.stringify(informed_users))
				permanent_memory.write(path.join(__dirname, "permanent_memory.ini"))
			} else {
				delete wait_confirm_set_nick[sender]
				this.actions.push({
					type: "answ",
					content: {
						recipient: sender,
						message: "Я ожидал другой ответ :<"
					}
				})
			}
		}
	}
}



module.exports = AliasModule
