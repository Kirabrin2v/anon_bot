const ConfigParser = require("configparser");
const TelegramBot = require("node-telegram-bot-api");
const path = require("path")
const sqlite = require("better-sqlite3");

const { date_to_text } = require(path.join(BASE_DIR,  "utils", "text.js"))
const { ModuleManager, CommandManager } = require(path.join(__dirname, "module_manager.js"))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))
const bus = require(path.join(BASE_DIR, "event_bus.js"))


const MODULE_NAME = "telegram"
const INTERVAL_CHECK_ACTIONS = 10

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const player_settings_object = new ConfigParser();
player_settings_object.read(path.join(__dirname, "player_settings.ini"))


const logs_db = new sqlite(path.join(__dirname, "logs.db"));


class TelegramModule extends BaseModule {
	constructor () {
		super(MODULE_NAME, undefined, undefined, INTERVAL_CHECK_ACTIONS)

		bus.on("modules_load", () => {
			ModuleManager.load_modules(
				ModuleManager.find_modules(
					path.join(__dirname, "cmds")
				),
				this
			)
			this.start()
		});

		this.seniors = JSON.parse(config.get("VARIABLES", "seniors"))
		this.masters = JSON.parse(config.get("VARIABLES", "masters"))

		this.access_lvls = JSON.parse(config.get("VARIABLES", "access_lvls"))
		this.seniors.forEach(tg_chat_id => {
			Object.keys(this.access_lvls).forEach(cmd_name => {
					this.access_lvls[cmd_name].at(-1).push(tg_chat_id) // У seniors высший уровень доступа ко всем командам
				})
		})

		this.player_settings = {} 
		// Инициализация типов данных
		player_settings_object.sections().forEach(tg_id => {
			this.player_settings[tg_id] = {}
			player_settings_object.keys(tg_id).forEach(parameter => {
				if (["chat_on", "whitelist_on", "blacklist_on", "filter_on"].includes(parameter)) {
					this.player_settings[tg_id][parameter] = player_settings_object.get(tg_id, parameter) === "true" // boolean

				} else if (["whitelist_nicks", "blacklist_nicks", "allowed_chats"].includes(parameter)) {
					this.player_settings[tg_id][parameter] = JSON.parse(player_settings_object.get(tg_id, parameter)) // list

				} else {
					this.player_settings[tg_id][parameter] = player_settings_object.get(tg_id, parameter) // string
				}
			})
		})

		this.access_cmds = {} // Ключ - айди, значение - список доступных серверных команд
		for (const tg_id in this.player_settings) {
			this.access_cmds[tg_id] = JSON.parse(config.get("VARIABLES", "base_server_cmds"))
		}

		this.tg = new TelegramBot(config.get("VARIABLES", "tg_key"), {
		  polling: {
		    interval: 300,
		    autoStart: true
		  }
		});
		this.tg.deleteWebHook()

		setInterval(() => this.update_player_settings(), 10000)
	}

	start() {
		this.tg.on("callback_query", query => {
			const tg_id = query.from.id
			if (!this.seniors.includes(tg_id) && !this.masters.includes(tg_id)) {return}

			const data = query.data
			const [_action, id, page] = data.split(":")

			this.actions.push({
				type: "module_request",
				module_recipient: "цитата",
				module_sender: this.module_name,
				content: {
					type: "request",
					tg_id,
					cmd: "quote",
					args: [
						id,
						page
					]
				}
			})
		})
		console.log("Telegram started")
		this.tg.on("text", async msg => {
			const full_name = msg.chat.first_name + " " + msg.chat.last_name
			this.log_tg_messages("accept", msg.chat.id, msg.text, full_name, msg.chat.username)
			this.tg_message_processing(msg.chat.id, msg.text, msg)
			
		})
	}

	escapeMarkdownV2(text) {
	  return text.replace(/([\\_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
	}

	prepare_broadcast_message(text) {
	  return text
	    .replace(/\\n/g, '\n')
	    .replace(/\\/g, '\\\\')
	    .replace(/([#+\-=|{}.!])/g, '\\$1')
	    ;
	}

	send_message_tg(
		tg_id,
		message,
		keyboard,
		is_document = false,
		parse_mode = null,
	) {
		this.log_tg_messages("send", tg_id, message)
		const parameters = {}
		if (parse_mode !== null) {
			parameters.parse_mode = parse_mode
		}
		if (keyboard) {
			parameters.reply_markup = keyboard
		}
		console.log([message, parse_mode], parameters)

		if (is_document) {
			this.tg.sendDocument(tg_id, message)
		} else {
			this.tg.sendMessage(
				tg_id,
				message.slice(0, 4096),
				parameters
			)
		}
	}

	async broadcast_messages(module_obj, recipients, message, prefix, delay_ms = 50) {
	    if (!Array.isArray(recipients)) {
	        return {
	            sent: 0,
	            failed: 0,
	            errors: []
	        }
	    }

	    let sent = 0
	    let failed = 0
	    const errors = []

	    prefix = this.escapeMarkdownV2(`[${prefix}]`)
	    message = this.prepare_broadcast_message(message)
	    message = `${prefix}\n\n${message}`

	    for (let i = 0; i < recipients.length; i++) {
	        const tg_id = recipients[i]

	        try {
	            await this.send_message_tg(tg_id, message, undefined, false, 'MarkdownV2')
	            sent++
	        } catch (err) {
	            failed++
	            errors.push({
	                tg_id,
	                error: err
	            })
	        }

	        // анти-флуд задержка
	        if (i !== recipients.length - 1 && delay_ms > 0) {
	            await new Promise(res => setTimeout(res, delay_ms))
	        }
	    }

	    return {
	        sent,
	        failed,
	        errors
	    }
	}


	log_tg_messages(type_message, tg_id, message, full_name, username) {
	    tg_id = Number(tg_id)
	    if (!tg_id) return
	    username = username ?? "unknown"

	    const tableName = `dialogue_${tg_id}`

	    const check_exists_user = logs_db.prepare(`
	        SELECT 1 FROM users WHERE tg_id = ?
	    `)

	    // всегда гарантируем таблицу
	    const createTable = logs_db.prepare(`
	        CREATE TABLE IF NOT EXISTS "${tableName}" (
	            ID INTEGER PRIMARY KEY AUTOINCREMENT,
	            date_time TEXT NOT NULL,
	            type_message TEXT NOT NULL,
	            message TEXT NOT NULL
	        )
	    `)
	    createTable.run()

	    if (!check_exists_user.get(tg_id)) {
	        const insertUser = logs_db.prepare(`
	            INSERT INTO users (tg_id, tg_username)
	            VALUES (?, ?)
	        `)
	        insertUser.run(tg_id, username)
	    }

	    const insertMessage = logs_db.prepare(`
	        INSERT INTO "${tableName}" (date_time, type_message, message)
	        VALUES (?, ?, ?)
	    `)

	    insertMessage.run(date_to_text(new Date()), type_message, message)
	}


	tg_message_processing(tg_id, message, msg_obj) {
		let answ;
		let server_cmd;
		if (message[0] === "/") {
			let cmd = message.split(/\s+/)[0].replace("/", "")
			let args = message.split(/\s+/).slice(1)
			console.log("Команда", cmd, "Аргументы", args)
			const module_name = ModuleManager.get_module_name(cmd)
			if (module_name) {
				ModuleManager.modules[module_name].cmd_processing(tg_id, args, cmd, msg_obj)
			
			} else if (
				CommandManager._findKey(
					ModuleManager.modules["server"].structure,
					cmd
				)
			) {
				args = [cmd].concat(args)
				cmd = "server"
				ModuleManager.modules["server"].cmd_processing(tg_id, args, cmd, msg_obj)

			} else if (
				CommandManager._findKey(
					ModuleManager.modules["chat"].structure,
					cmd
				)
			) {
				args = [cmd].concat(args)
				cmd = "chat"
				ModuleManager.modules["chat"].cmd_processing(tg_id, args, cmd, msg_obj)

			} else if (this.seniors.includes(tg_id) || this.masters.includes(tg_id) || (this.access_cmds[tg_id] && this.access_cmds[tg_id].includes(cmd))) {
                    server_cmd = "/" + cmd + " " + args.join(" ")

            } else {
				answ = `Команды ${cmd} не существует`
			}
		} else if (this.seniors.includes(tg_id) && message.split(" ")[0] === "cmd") {
			const args = message.split(" ").slice(1)
			if (args.length > 0) {
				if (args[0] === "js" && args[1]) {
			 		this.actions.push({
			 			type: "js",
			 			module_name: this.module_name,
			 			content: {
			 				tg_id,
			 				js: args.slice(1).join(" ")
				 		}
					})
				}
			}
		} else if (this.player_settings[tg_id]) {
			bus.emit(
				"telegram_authorized_message",
				{
					tg_id,
					message,
					msg_obj
				}
			)
		} else {
			answ = "Я - ТГ-часть anon_bot'a. Чтобы общаться со мной, используй следующий синтаксис: '/{команда} [аргументы]'. Все права на команды выдаются лично @Kirabriin"
		}
		if (server_cmd) {
			this.actions.push({
					type: "cmd",
					content: {
						module_sender: this.module_name,
						cmd: server_cmd,
						identifier: tg_id
					}
				})
		}
		console.log([tg_id, answ])
		if (!answ) {return;}
		this.send_message_tg(tg_id, answ)
	}

	server_answ_processing(cmd, server_answ, values, identifier, is_confirmed) {
		console.log(cmd, server_answ, identifier, is_confirmed)
		if (is_confirmed) {
			this.send_message_tg(identifier, `Ответ сервера на команду '${cmd}':\n\n${server_answ}`)

		} else {
			if (this.seniors.includes(identifier) || this.masters.includes(identifier)) {
				this.send_message_tg(identifier, `Неподтверждённый ответ сервера на команду '${cmd}':\n\n${server_answ}`)
			} else {
				this.send_message_tg(identifier, `Ответ от сервера на команду ${cmd} не был получен. Повторите попытку`)
			}
		}
	}

	send_processing_quotes_message(tg_id, prepared_quotes, _last_quote_id) {
		if (prepared_quotes.length !== 0) {
			
			this.send_message_tg(tg_id, "Выберите, что сделать со ")
		}
	}

	module_dialogue(module_recipient, module_sender, json_cmd) {
		if (json_cmd.prepared_quotes) {

			const last_prepared_quote_id = json_cmd.old_data.prepared_quote_id
			const tg_id = json_cmd.old_data.tg_id
			const prepared_quotes = json_cmd.prepared_quotes
			this.send_processing_quotes_message(tg_id, prepared_quotes, last_prepared_quote_id)
		} else {
			let tg_id;
			if (json_cmd.type === "answ") {
				tg_id = json_cmd.old_data.tg_id
			} else if (json_cmd.type === "request") {
				tg_id = json_cmd.tg_id
			}

			if (tg_id) {
				let message;
				if (json_cmd.name === "execute_js") {
					if (json_cmd.is_ok) {
						message = "Команда успешно выполнена"
					} else {
						message = `Во время выполнения возникла ошибка:\n${json_cmd.message_error}`
					}
				} else {
					message = json_cmd.message
				}
				if (message) {
					if (json_cmd.type_content === "message") {
						this.send_message_tg(tg_id, message, json_cmd.keyboard)
					}
					 else if (json_cmd.type_content === "file") {
						this.tg.sendDocument(tg_id, message)
					}
				}
			}
		}
	}

	send_message(message) {
		this.seniors.forEach(tg_chat_id => {
			this.tg.sendMessage(tg_chat_id, message.slice(0, 4096))
		})
	}

	jsonToConfigParser(jsonData) {
	    const config = new ConfigParser();
	    
	    // Проходим по всем секциям JSON
	    Object.entries(jsonData).forEach(([section, values]) => {
	        config.addSection(section);
	        
	        // Добавляем все ключи секции
	        Object.entries(values).forEach(([key, value]) => {
	            // Преобразуем массивы и объекты в строки при необходимости
	            const stringValue = typeof value === "object" 
	                ? JSON.stringify(value) 
	                : String(value);
	            config.set(section, key, stringValue);
	        });
	    });
	    
	    return config;
	}

	update_player_settings() {
		const config_object = this.jsonToConfigParser(this.player_settings)
		config_object.write(path.join(__dirname, "player_settings.ini"))
	}

}


module.exports = TelegramModule
