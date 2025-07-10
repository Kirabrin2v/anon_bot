const path = require('path');

const ConfigParser = require('configparser');

const text = require(path.join(__dirname,  '../text/text.js'))

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const permanent_memory = new ConfigParser();
permanent_memory.read(path.join(__dirname, "permanent_memory.ini"))

const sqlite = require("better-sqlite3");
const db = new sqlite(path.join(__dirname, "placed_beds.db"));

const phrases = {}
phrases["grief"] = JSON.parse(config.get("phrases", "grief"))
phrases["grief_none_player"] = JSON.parse(config.get("phrases", "grief_none_player"))

const module_name = "SAGO"
const help = "Логи установленных кроватей"

const structure = {
	all: {
		номер_страницы: {
			_type: "int",
			_default: 1
		},
		_description: "Показывает логи всех установленных кроватей"
	},
	nick: {
		nick: {
			номер_страницы: {
				_type: "int",
				_default: 1
			},
			_type: "nick",
			_description: "Ник игрока, логи которого нужно посмотреть"
		},
		_description: "Показывает логи установленных выбранным игроком кроватей"
	}
}

const grief_alert = JSON.parse(permanent_memory.get("informed_users", "grief_alert"))

var last_placed_bed = {}
var last_triggered_nick;

var timer_send_alert_grief = 0;

const nums_in_page = 5;

function random_choice(array) {
	return array[Math.floor(Math.random() * array.length)]
}

function add_block_to_bd(nickname, position) {
	const insertMessage = db.prepare(`INSERT INTO logs (
	nickname, date_time, x, y, z)
	VALUES (@nickname, datetime('now', '+3 hours'), @x, @y, @z)`);
	insertMessage.run({
	  nickname: nickname,
	  x: position.x,
	  y: position.y,
	  z: position.z
	});
	
}

function get_placed_beds(nickname='') {
	const select_message = db.prepare(`SELECT nickname, x, y, z, date_time
									FROM logs
									WHERE nickname == ?
									OR ? == '' 
									ORDER BY date_time DESC
									LIMIT 500`)

	let placed_beds = select_message.all(nickname, nickname)

	//console.log(placed_beds.reverse())
	return placed_beds
}


function placed_bed_processing (nick, rank, position) {
	try {
		let answs = []
		console.log("Получено:", nick, rank, position)
		if (last_placed_bed == {} || (last_placed_bed.nick == nick && (new Date().getTime() - last_placed_bed.time  < 1000)))  return;
		console.log(new Date().getTime() - last_placed_bed.time);

		add_block_to_bd(nickname=nick, position=position)

		last_placed_bed = {"nick": nick, "time": new Date().getTime()}
		console.log(position, nick)

		let [x, y, z] = [position.x, position.y, position.z];

		if (rank <= 2 && (timer_send_alert_grief < new Date().getTime() ||
		 (last_triggered_nick && nick && last_triggered_nick != nick && timer_send_alert_grief - 120000 < new Date().getTime()))) {
			timer_send_alert_grief = new Date().getTime() + 240000;
			if (nick) {
				if (rank == 0 && !grief_alert.includes(nick)) {
					grief_alert.push(nick)
					console.log(grief_alert)
					permanent_memory.set("informed_users", "grief_alert", JSON.stringify(grief_alert))
					permanent_memory.write(path.join(__dirname, "permanent_memory.ini"))	
					let answ = "Если Вы используете кровати для разрушения, то имейте в виду: 1) Гриферство в Эндер-мире наказуемо баном. 2)В каждую постройку была вложена частичка души такого же человека, как и Вы. Сообщение сгенерировано автоматически."
					 
					answs.push({"type": "answ", "content": {"recipient": nick, "message": answ, "send_in_private_message": true}})
				}
				last_triggered_nick = nick;
				var answ = `${nick}(${x}, ${y}, ${z}), ${random_choice(phrases["grief"])}`;
			} else {
				var answ = `(${x}, ${y}, ${z}). ${random_choice(phrases["grief_none_player"])}`;
			}
			answs.push({"type": "answ", "content": {"message": answ, "prefix": "САГО"}})

			return answs
		}
	} catch (error) {
		return {"type": "error", "content": {"date_time": new Date(), "module_name": module_name, "error": error, "args": [nick, rank, position]}}
	}


}

function cmd_processing (sender, args) {
	try {
		let nick, num_page;
		if (args[0] == "all") {
			nick = ""

			if (args[1]) {
				num_page = Number(args[1])
			}

		} else if (args[0] == "nick") {
			nick = args[1]
			if (!nick) {
				return {"type": "answ", "content": {"recipient": sender, "message": "Вы не указали ник игрока"}}
			}

			if (args[2]) {
				num_page = Number(args[2])
			}

		} else {
			return {"type": "answ", "content": {"recipient": sender, "message": "Выберите один из режимов: [nick, all]"}}
		} 

		let beds = get_placed_beds(nick)
		if (beds.length != 0) {
			let beds_text = beds.map((elem) => {
				let nick = elem.nickname
				if (!nick) {
					nick = "Неизвестно"
				}
				return [nick,  `x:${elem.x} y:${elem.y} z:${elem.z}`]
			})
			console.log("num_page", num_page)
			let split_into_pages = text.stats_split_into_pages(beds_text, nums_in_page, num_page)

			if (split_into_pages["is_ok"]) {
				start_index = split_into_pages["index_first_element"]
				end_index = split_into_pages["index_last_element"]
				console.log(start_index, end_index)
				let start_date = beds[start_index].date_time.replace(" ", "T")
				let end_date = beds[end_index].date_time.replace(" ", "T")
				let date_text = `${start_date} - ${end_date}`
				return {"type": "answ", "content": {"recipient": sender, "message": split_into_pages["answ"], "prefix": date_text + " ant.fld"}}
			} else {
				return {"type": "answ", "content": {"recipient": sender, "message": split_into_pages["answ"]}}
			}

		} else {
			return {"type": "answ", "content": {"recipient": sender, "message": "Подходящих записей не было найдено"}}
		}
	} catch (error) {
		return {"type": "error", "content": {"date_time": new Date(), "module_name": module_name, "error": error, "args": args,  "sender": sender}}
	}
}

function diagnostic_eval (eval_expression) {
	try {
		return eval(eval_expression)
	} catch (error) {
		return error
	}
}


module.exports = {module_name, cmd_processing, placed_bed_processing, diagnostic_eval, help, structure}