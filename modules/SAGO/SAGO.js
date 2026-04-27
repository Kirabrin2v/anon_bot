const path = require('path');
const ConfigParser = require('configparser');
const sqlite = require("better-sqlite3");

const { stats_split_into_pages } = require(path.join(BASE_DIR, "utils", "text.js"))
const { random_choice } = require(path.join(BASE_DIR, "utils", "random.js"))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))
const bus = require(path.join(BASE_DIR, "event_bus.js"));

const MODULE_NAME = "grief"
const HELP = "Логи установленных кроватей"
const STRUCTURE = {
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

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const permanent_memory = new ConfigParser();
permanent_memory.read(path.join(__dirname, "permanent_memory.ini"))

const db = new sqlite(path.join(__dirname, "placed_beds.db"));

const phrases = {}
phrases["grief"] = JSON.parse(config.get("phrases", "grief"))
phrases["grief_none_player"] = JSON.parse(config.get("phrases", "grief_none_player"))

const grief_alert = JSON.parse(permanent_memory.get("informed_users", "grief_alert"))


class GriefModule extends BaseModule {
	constructor () {
        super(MODULE_NAME, HELP, STRUCTURE)
	    
	    this.last_placed_bed = {}
	    this.last_triggered_nick;
		this.timer_send_alert_grief = 0;
		this.NUMS_IN_PAGE = 5;


		bus.on("block_placed", (obj) => {
			const block = obj.block
			if (block.name === "bed") {
				const nick = obj.nick
				let rank = this.ModuleManager.call_module("stats").get_stats(nick, "rank")
				if (rank === 5) {rank = 0;}
				if (!rank) {rank = 0;}
				this.placed_bed_processing(nick, rank, obj.old_block.position)
			}
		})
    }

    add_block_to_bd(nickname, position) {
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

	get_placed_beds(nickname='') {
		const select_message = db.prepare(`SELECT nickname, x, y, z, date_time
										FROM logs
										WHERE nickname == ?
										OR ? == '' 
										ORDER BY date_time DESC
										LIMIT 500`)

		const placed_beds = select_message.all(nickname, nickname)

		return placed_beds
	}

	placed_bed_processing(nick, rank, position) {
		let answ;
		const now = Date.now();
		console.log("Кровать установлена:", nick, rank, position)
		if (!this.last_placed_bed || (this.last_placed_bed.nick === nick && (now - this.last_placed_bed.time  < 1000)))  {return;}

		this.add_block_to_bd(nick, position)

		this.last_placed_bed = {"nick": nick, "time": new Date().getTime()}

		const [x, y, z] = [position.x, position.y, position.z];

		if (rank <= 2 && (this.timer_send_alert_grief < now ||
		 (this.last_triggered_nick && nick && this.last_triggered_nick !== nick && this.timer_send_alert_grief - 120000 < now))) {
			this.timer_send_alert_grief = now + 240000;
			if (nick) {
				if (rank === 0 && !grief_alert.includes(nick)) {
					grief_alert.push(nick)
					console.log(grief_alert)
					permanent_memory.set("informed_users", "grief_alert", JSON.stringify(grief_alert))
					permanent_memory.write(path.join(__dirname, "permanent_memory.ini"))	
					const answ = "Если Вы используете кровати для разрушения, то имейте в виду: 1) Гриферство в Эндер-мире наказуемо баном. 2)В каждую постройку была вложена частичка души такого же человека, как и Вы. Сообщение сгенерировано автоматически."
					 
					this.actions.push({
						type: "answ", 
						content: {
							recipient: nick, 
							message: answ, 
							send_in_private_message: true
						}
					})
				}
				this.last_triggered_nick = nick;
				answ = `${nick}(${x}, ${y}, ${z}), ${random_choice(phrases["grief"])}`;
			} else {
				answ = `(${x}, ${y}, ${z}). ${random_choice(phrases["grief_none_player"])}`;
			}
			this.actions.push({
				type: "answ", 
				content: {
					message: answ, 
					prefix: "[САГО]"
				}
			})
		}
	}

	_process(sender, args) {
		let nick, num_page;
		if (args[0].name === "all") {
			nick = ""

			if (args[1]) {
				num_page = Number(args[1])
			}

		} else if (args[0].name === "nick") {
			nick = args[1].value
			if (!nick) {
				return "Вы не указали ник игрока"
			}
			num_page = args[2].value
		}

		const beds = this.get_placed_beds(nick)
		if (beds.length !== 0) {
			const beds_text = beds.map((elem) => {
				let nick = elem.nickname
				if (!nick) {
					nick = "Неизвестно"
				}
				return [nick, `x:${elem.x} y:${elem.y} z:${elem.z}`]
			})

			const split_into_pages = stats_split_into_pages(beds_text, this.NUMS_IN_PAGE, num_page)

			if (split_into_pages["is_ok"]) {
				const start_index = split_into_pages["index_first_element"]
				const end_index = split_into_pages["index_last_element"]

				const start_date = beds[start_index].date_time.replace(" ", "T")
				const end_date = beds[end_index].date_time.replace(" ", "T")
				const date_text = `${start_date} - ${end_date}`
				return {
					message: split_into_pages["answ"],
					prefix: `[${date_text} ant.fld]`
				}
			} else {
				return split_into_pages["answ"]
			}

		} else {
			return "Подходящих записей не было найдено"
		}
	}
}


module.exports = GriefModule