const sqlite = require("better-sqlite3");
const path = require("path");

const db = new sqlite(path.join(__dirname, "logs.db"));
const { date_to_text } = require(path.join(BASE_DIR,  "utils", "text.js"))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))
const bus = require(path.join(BASE_DIR, "event_bus.js"))

const MODULE_NAME = "logging"




class LoggingModule extends BaseModule {
	constructor () {
		super(MODULE_NAME)

		bus.on("player_message", (obj) => {
			this.add_msg_to_players_logs(
				obj.date_time,
				obj.bot_location,
				obj.type_chat,
				obj.sender,
				obj.message,
				obj.raw_message,
				obj.message_json
			)
		})

		bus.on("server_message", (obj) => {
			this.add_msg_to_server_logs(
				obj.date_time,
				obj.sender,
				obj.message,
				obj.message_json
			)
		})

		bus.on("error", (obj) => {
			this.add_error_to_logs(
				obj.date_time,
				obj.module_name,
				obj.short_error,
				obj.full_error,
				obj.args,
				obj.sender
			)
		})
	}

	get_count_players_messages(nickname) {
		try {
			let count_messages;
			if (nickname) {
				const selectMessage = db.prepare(`SELECT count(message)
												FROM players_logs
												WHERE nickname == ?`)
				count_messages = selectMessage.all(nickname)

			} else {
				const selectMessage = db.prepare(`SELECT count(message)
												FROM players_logs`)
				count_messages = selectMessage.all()
			}

			return count_messages[0]['count(message)']
		} catch (error) {
			this.add_error_to_logs(new Date(), this.module_name, error.toString(), error.stack, [])
		}
	}

	add_msg_to_players_logs(date_time, bot_location, type_chat, nickname, message, full_message, message_json) {
		try {
			date_time = date_to_text(date_time)

			const insertMessage = db.prepare(`INSERT INTO players_logs (
			date_time, location, type_chat, nickname, message, full_message)
			VALUES (@date_time, @location, @type_chat, @nickname, @message, @full_message)`);
			const info = insertMessage.run({
				date_time: date_time,
				location: bot_location,
				nickname: nickname,
				type_chat: type_chat,
				message: message,
				full_message: full_message
			})

			if (message_json) {
				const ID = info.lastInsertRowid
				const insertMessage_json  = db.prepare(`INSERT INTO players_logs_json 
															(ID, date_time, nickname, message)
															VALUES (?, ?, ?, ?)`)
				insertMessage_json.run(ID, date_time, nickname, message_json)

				const insertMessage_json_2 = db.prepare(`INSERT INTO players_and_server_json 
														(date_time, sender, message)
														VALUES (?, ?, ?)`)
				insertMessage_json_2.run(date_time, nickname, message_json)
			}
		} catch (error) {
			this.add_error_to_logs(new Date(), this.module_name, error.toString(), error.stack, [type_chat, nickname, message, full_message])
		}
	}

	get_players_messages(nickname, parameters = {}) {
		try {
			const {
				limit = 50,
				offset = 0,
				order_desc = true,
				type_chat = null,
				location = null,
				date_from = null,
				date_to = null,
				exclude_old = true,
				only_message = false
			} = parameters

			let query = `
				SELECT *
				FROM players_logs
				WHERE 1 = 1
			`

			const values = []

			if (nickname) {

				// Один ник
				if (typeof nickname === "string") {
					query += ` AND nickname == ?`
					values.push(nickname)
				}

				// Несколько ников
				else if (Array.isArray(nickname) && nickname.length > 0) {
					const placeholders = nickname
						.map(() => "?")
						.join(", ")

					query += `
						AND nickname IN (${placeholders})
					`

					values.push(...nickname)
				}
			}

			// Фильтры

			if (type_chat) {
				query += ` AND type_chat == ?`
				values.push(type_chat)
			}

			if (location) {
				query += ` AND location == ?`
				values.push(location)
			}

			if (date_from) {
				query += ` AND date_time >= ?`
				values.push(date_from)
			}

			if (date_to) {
				query += ` AND date_time <= ?`
				values.push(date_to)
			}

			if (exclude_old) {
				query += ` AND is_old == 0`
			}

			// Сортировка

			query += `
				ORDER BY ID ${order_desc ? "DESC" : "ASC"}
				LIMIT ?
				OFFSET ?
			`

			values.push(limit)
			values.push(offset)

			const selectMessage = db.prepare(query)

			let messages = selectMessage.all(...values)

			if (only_message) {
				messages = messages.map(msg => msg.message)
			}

			return messages

		} catch (error) {
			this.add_error_to_logs(
				new Date(),
				this.module_name,
				error.toString(),
				error.stack,
				[nickname, JSON.stringify(parameters)]
			)
		}
	}

	add_msg_to_server_logs(date_time, type_sender, message, message_json) {
		try {
			date_time = date_to_text(date_time)

			const insertMessage = db.prepare(`INSERT INTO server_logs (
			date_time, type_sender, message)
			VALUES (@date_time, @type_sender, @message)`)
			insertMessage.run({
				date_time: date_time,
				type_sender: type_sender,
				message: message
			})

			if (message_json) {
				const insertMessage_json = db.prepare(`INSERT INTO players_and_server_json 
														(date_time, sender, message)
														VALUES (?, ?, ?)`)
				insertMessage_json.run(date_time, type_sender, message_json)
			}

		} catch (error) {
			this.add_error_to_logs(new Date(), this.module_name, error.toString(), error.stack, [type_sender, message])
		}
	}

	add_msg_to_script_logs(date_time, type_message, message) {
		try {
			date_time = date_to_text(date_time)

			const insertMessage = db.prepare(`INSERT INTO script_logs (
				date_time, type_message, message)
				VALUES (@date_time, @type_message, @message)`)
			insertMessage.run({
				date_time: date_time,
				type_message: type_message,
				message: message
			})
		} catch (error) {
			this.add_error_to_logs(new Date(), this.module_name, error.toString(), error.stack, [type_message, message])
		}
	}

	add_error_to_logs(date_time, module_name, short_error, full_error, args, sender) {
		try {
			console.log("Ошибка:", module_name, short_error, args, sender)
			if (args) {
				args = (args).join(";\n\n")
			}
			date_time = date_to_text(date_time)

			const insertMessage = db.prepare(`INSERT INTO error_logs (
				date_time, module_name, short_error, full_error, args, sender)
				VALUES (@date_time, @module_name, @short_error, @full_error, @args, @sender)`)
			insertMessage.run({
				date_time: date_time,
				module_name: module_name,
				short_error: short_error,
				full_error: full_error,
				args: args,
				sender: sender
			})
		} catch (error) {
			console.log("Ошибка добавления ошибки в базу данных", [module_name, short_error, full_error], error)
		}
	}
}

module.exports = LoggingModule