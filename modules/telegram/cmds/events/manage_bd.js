const sqlite = require("better-sqlite3");

const path = require("path");

const fs = require("fs")

const db = new sqlite(path.join(__dirname, "events.db"));

const { date_to_text } = require(path.join(BASE_DIR,  "utils", "text.js"))

function add_new_event(event_date, event_name, organizers=[], description) {
	const insertMessage = db.prepare(`INSERT INTO events
									(event_date, event_name, organizers, description)
									VALUES (?, ?, ?, ?)`)
	
	if (description === "") {
		description = undefined
	}

	insertMessage.run(date_to_text(event_date), event_name, JSON.stringify(organizers), description)
}

function subscribe(event_id, tg_id) {
	const check_exists_event = db.prepare(`SELECT * FROM events
										WHERE ID = ? AND
										is_active = 1`)

	if (!check_exists_event.get(event_id)) {
		return {"is_ok": false, "message_error": "События с указанным айди не сущуествует"}
	}

	const check_exists_subscriber = db.prepare(`SELECT * FROM subscribers
												WHERE event_id = ? AND
												tg_id = ?`)

	if (check_exists_subscriber.get(event_id, tg_id)) {
		return {"is_ok": false, "message_error": "Вы уже подписаны на это событие"}
	}

	const insertMessage = db.prepare(`INSERT INTO subscribers
									(event_id, tg_id)
									VALUES (?, ?)`)

	insertMessage.run(event_id, tg_id)
	return {"is_ok": true}
}

function unsubscribe(event_id, tg_id) {
	if (tg_id) {
		const deleteMessage = db.prepare(`DELETE FROM subscribers
									WHERE event_id = ? AND
									tg_id = ?`)
		deleteMessage.run(event_id, tg_id)

	} else {
		const deleteMessage = db.prepare(`DELETE FROM subscribers
									WHERE event_id = ?`)
		deleteMessage.run(event_id)

	}
}



function deactivate_unused_events() {
	try {
		const ids_deactivate = []
		const events = db.prepare(`SELECT ID, event_date FROM events WHERE is_active = 1`).all()

		const date_now = new Date()

		events.forEach((dict) => {
			const event_date = dict.event_date
			const ID = dict.ID
			if (Date.parse(event_date) - date_now < 600000) {
				unsubscribe(ID)
				ids_deactivate.push(ID)
			}
		})

		ids_deactivate.forEach((ID) => {
			const updateMessage = db.prepare(`UPDATE events
											SET is_active = 0
											WHERE ID = ?`)
			updateMessage.run(ID)
		})

	} catch (error) {
		console.log(error)
	}
}

function get_events() {
	const events = db.prepare(`SELECT ID, event_date, event_name, organizers, description
						FROM events
						WHERE is_active = 1`).all()
	events.map((event) => {
		event.organizers = JSON.parse(event.organizers)
	})
	return events
}

function get_subscribers(event_id) {
	return db.prepare(`SELECT tg_id FROM subscribers WHERE event_id = ?`).all(event_id).map((obj) => obj.tg_id)
}

function get_logs_alert(event_id, tg_id) {
	return db.prepare(`SELECT * FROM logs_alert
						WHERE event_id = ? AND
						tg_id = ?`).all(event_id, tg_id)
}

function add_logs_alert(event_id, tg_id) {
	const date_time = date_to_text(new Date())
	const insertMessage = db.prepare(`INSERT INTO logs_alert
									(date_time, event_id, tg_id)
									VALUES (?, ?, ?)`)

	insertMessage.run(date_time, event_id, tg_id)
}

function check_actions_from_txt() {
	try {
		const action = fs.readFileSync(path.join(__dirname, "manage_events.txt"), 'utf-8').replace("\n", "").split(" ")
		if (action.length < 2) {return;}
		const [type, ...rest] = action
		const parameters = JSON.parse(rest.join(" "))
		console.log(main(type, parameters))
		fs.writeFileSync(path.join(__dirname, "manage_events.txt"), "", 'utf-8')

	} catch (error) {
		console.log(error)
	}
}

function main(type, parameters) {
	try {

		deactivate_unused_events()
		if (type === "get_events") {
			return {"is_ok": true, "events": get_events()}

		} else if (type === "get_subscribers") {
			return {"is_ok": true, "subscribers": get_subscribers(parameters.event_id)}

		} else if (type === "get_logs") {
			return {"is_ok": true, "logs": get_logs_alert(parameters.event_id, parameters.tg_id)}

		} else if (type === "add_logs") {
			add_logs_alert(parameters.event_id, parameters.tg_id)
			return {"is_ok": true}

		} else if (type === "add") {
			const date = new Date(Date.parse(parameters.event_date))
			if (!date.getDate()) {return {"is_ok": false, "message_error": "Invalid date"}}

			console.log(date)
			add_new_event(date, parameters.event_name, parameters.organizers, parameters.description)
			return {"is_ok": true}

		} else if (type === "subscribe") {
			return subscribe(parameters.event_id, parameters.tg_id)
		
		} else if (type === "unsubscribe") {
			unsubscribe(parameters.event_id, parameters.tg_id)
			return {"is_ok": true}
		}

	} catch (error) {
		console.log(error)
		return {"is_ok": false, "message_error": "Возникла непредвиденная ошибка"}
	}
}

setInterval(check_actions_from_txt, 1000)

module.exports = {main, deactivate_unused_events}
