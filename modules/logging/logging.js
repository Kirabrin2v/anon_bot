const sqlite = require("better-sqlite3");

const path = require("path");

const module_name = "logging"

console.log(path.join(__dirname), "logs.db")
const db = new sqlite(path.join(__dirname, "logs.db"));

const { date_to_text } = require(path.join(__dirname,  '../text/text.js'))

function get_count_players_messages(nickname) {
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
		add_error_to_logs(new Date(), module_name, error.toString(), error.stack, [])
	}
}

function add_msg_to_players_logs(date_time, location_bot, type_chat, nickname, message, full_message, message_json) {
	try {
		date_time = date_to_text(date_time)

		const insertMessage = db.prepare(`INSERT INTO players_logs (
		date_time, location, type_chat, nickname, message, full_message)
		VALUES (@date_time, @location, @type_chat, @nickname, @message, @full_message)`);
		const info = insertMessage.run({
			date_time: date_time,
			location: location_bot,
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
		add_error_to_logs(new Date(), module_name, error.toString(), error.stack, [type_chat, nickname, message, full_message])
	}
}

function add_msg_to_server_logs(date_time, type_sender, message, message_json) {
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
		add_error_to_logs(new Date(), module_name, error.toString(), error.stack, [type_sender, message])
	}
}

function add_msg_to_script_logs(date_time, type_message, message) {
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
		add_error_to_logs(new Date(), module_name, error.toString(), error.stack, [type_message, message])
	}
}

function add_error_to_logs(date_time, module_name, short_error, full_error, args, sender) {
	try {
		console.log("Ошибка:", module_name, short_error, args, sender)
		args = (args).join(";\n\n")
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

module.exports = {module_name, add_msg_to_players_logs, add_msg_to_server_logs, add_msg_to_script_logs, add_error_to_logs, get_count_players_messages}