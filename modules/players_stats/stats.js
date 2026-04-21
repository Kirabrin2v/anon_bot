const sqlite = require("better-sqlite3");

const path = require("path");

const text = require(path.join(__dirname,  '../text/text.js'))
const logging = require(path.join(__dirname, "../logging/logging.js"))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

//const quotes = require(path.join(__dirname), "../quotes/quotes.js")
const ConfigParser = require("configparser")
const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const phrases = {};
phrases["donate"] = JSON.parse(config.get("phrases", "donate"))

const db = new sqlite(path.join(__dirname, "players_stats.db"));

const MODULE_NAME = "stats"
const HELP = "Показывает статистику игроков в боте"
const INTERVAL_CHECK_ACTIONS = 500
const STRUCTURE = {
  top: {
    "type_stat": {
      "номер_страницы": {
        _type: "int",
        _default: 1
      },
      _type: "string",
      _description: "Вид статистики, по которому нужно сгенерировать топ. Доступные: rank, messages, cmds, donate, casino"
    },
    _aliases: ["топ"],
    _description: "Покажет топ по выбранному типу статистики"
  },
  nick: {
  	_type: "nick",
    _optional: true,
    _description: "Ник игрока, чью сатистику нужно посмотреть"
  },
  add: {
  	nick: {
  		_type: "nick",
  		_description: "Ник игрока, которого нужно добавить. Важен регистр"
  	},
  	_aliases: ["добавить", "+"],
  	_description: "Добавить нового игрока в белый список бота"
  },
  delete: {
  	nick: {
  		_type: "nick",
  		_description: "Ник игрока, которого нужно удалить. Важен регистр"
  	},
  	_aliases: ["del", "remove", "удалить", "-"],
  	_description: "Ограничить игроку доступ к боту"
  },
  edit: {
  	nick: {
  		key: {
  			new_value: {
  				action: {
  					_type: "string",
  					_default: "equare",
  					_optional: true,
  					_description: "Добавить новое значение к текущему(add) или сделать текущее значение равным новому(equare)"
  				},
  				_type: "string",
  				_description: "Новое значение для выбранного поля"
  			},
  			_type: "string",
  			_description: "Названия поля статистики"
  		},
  		_type: "nick",
  		_description: "Ник игрока, статистику которого нужно отредактировать"
  	},
  	_aliases: ["изменить", "редактировать"],
  	_description: "Редактирование статистики игрока"
  }
}

const stats_table_names = ["nickname", "rank", "messages", "cmd", "donate", "casino", "name", "warns"]

const global_config = new ConfigParser();
global_config.read(path.join(__dirname, "config.ini"))
const price_TCA = Number(global_config.get("TESLA", "price_TCA"))

const ranks = {1: "Подопытный", 2: "Стажёр", 3: "Исследователь", 4: "Учёный", 5: "Безумный учёный", 6: "Химер Роковой"}
const price_donate = [0, 40000, 100000, 500000, 1000000]


function cash_player(stat) {
	players_stats[stat.nickname] = {"rank": stat.rank, "messages": 0,//logging.get_count_players_messages(stat.nickname),
															"cmds": stat.cmds, "donate": stat.donate, "casino": stat.casino,
															"name": stat.name, "credit": stat.name, "warns": stat.warns, 
															//"rating_quotes": get_rating_quote[stat.nickname],
															 "echo": stat.echo, "twinks": JSON.parse(stat.twinks)}
}

const players_stats = {}
const all_elements = db.prepare(`SELECT * FROM stats`).all();
all_elements.forEach(elem => cash_player(elem))

function substitute_text(pattern, values) {
	return pattern.replace(/\{([^}]+)\}/g, (match, key) => values[key]);
	
}

function random_choice(array) {
	return array[Math.floor(Math.random() * array.length)]
}

function stats_to_text(key, value) {
	if (key === "rank") {
		key = "Звание";
		value = ranks[value]
	} else if (key === "messages") {
		key = "Сообщения";
	} else if (key === "cmds") {
		key = "Команды"; 
	} else if (key === "donate") {
		key = "Задоначено";
		value = new Intl.NumberFormat('ru-RU').format(value) + "$";
	} else if (key === "casino") {
		key = "Выигрыш в казино";
		value = new Intl.NumberFormat('ru-RU').format(value) + "$";
	} else if (key === "name") {
		key = "Псевдоним";
	} else if (key === "rating_quotes") {
	 	key = "Рейтинг цитат"
	 	if (!value) {
	 		value = "Цитат нет"
	 	}
	 } else {
		key = undefined;
	}


	return [key, value];
}


class StatsModule extends BaseModule {
	constructor () {
		super(MODULE_NAME, HELP, STRUCTURE, INTERVAL_CHECK_ACTIONS)
	}

	_process(sender, args, parameters, valid_args) {
		const seniors = parameters.seniors
		const rank = parameters.rank_sender
		args = valid_args
		let send_in_private_message = true;
		let answ;

		if (!args[0] || args[0].name === "nick") {
			let nickname;
			if (args[0]) {
				nickname = args[0].value
			} else {
				nickname = sender
			}

			if (this.get_stats(nickname)) {
				send_in_private_message = false;

				answ = Object.entries(this.get_stats(nickname)).map(([key, value]) => {
					[key, value] = stats_to_text(key, value)
					if (key && value) {
						return `${key}: ${value}`
					}
				}).filter(value => value);

				answ = `Статистика игрока ${nickname}: ${answ.join(", ")}`;
			} else {
				answ = `Игрок не найден. Убедитесь, что ник указан в верном регистре`;
			}

		} else if (args[0].name === "edit" && seniors.includes(sender)) {
			const nickname = args[1].value
			const key = args[2].value
			let new_value = args[3].value
			const action = args[4].value

			if (Number(new_value)) {
				new_value = Number(new_value)
			}

			console.log(nickname, key, typeof new_value, [action])

			if (nickname && key && new_value) {
				const status = this.update_stats(nickname, key, new_value, action)
				if (status.is_ok) {
					answ = "Данные успешно обновлены"
				} else {
					answ = status.error
				}
			} else {
				answ = `Неверно введены аргументы: nickname: ${nickname}, key: ${key}, new_value: ${new_value}`
			}

		} else if (args[0].name === "top") {

			const type_stat = args[1].value
			let num_page = args[2].value

			if (stats_table_names.includes(type_stat)) {
				num_page = Number(num_page);

				const top_stats = this.get_tops(type_stat);

				answ = text.stats_split_into_pages(top_stats, 5, num_page)["answ"]
			} else {
				answ = "Статистики данного типа не существует"
			}

		} else if (args[0].name === "add" && rank >= 6) {
			const nickname = args[1].value

			const status = this.add_player(nickname)

			if (status.is_ok) {
				answ = "Игрок успешно добавлен"
			} else {
				answ = status.error
			}

		} else if (args[0].name === "delete" && rank >= 6) {
			const nickname = args[1].value

			const status = this.delete_player(nickname)

			if (status.is_ok) {
				answ = "Игрок успешно удалён"
			} else {
				answ = status.error
			}
		}

		return {
			"message": answ,
			"send_in_private_message": send_in_private_message
		}
	}

	payment_processing(nick, cash, currency, reason, price_TCA) {
		try {
			if (currency === "TCA") {cash *= price_TCA;}
			console.log(`Получено ${cash} сурвингов`)

			this.update_stats(nick, "donate", cash, "add")

			if (cash >= 10000) {
				const phrase = substitute_text(random_choice(phrases["donate"]), {"name": nick, "cash": cash})
				this.actions.push({"type": "answ", "content": {"message": phrase}})
			}
			return {"used": true}

		} catch (error) {
			this.actions.push({
				type: "error", content: {
					date_time: new Date(), 
					module_name: this.module_name,
					error: error,
					args: [nick, cash, currency, reason, price_TCA],
					sender: nick
				}
			})
			return {"used": false}
		}
	}

	get_main_account(nickname) {
		if (!players_stats[nickname]) {
			let marker_find = false;

			for (const nick in players_stats) {
				if (players_stats[nick] && players_stats[nick]["twinks"].includes(nickname)) {
					marker_find = true;
					break;
				}
			}

			if (marker_find) {
				return nickname;
			}
		} else {
			return nickname;
		}
	}

	get_stats(nickname, key) {
		nickname = this.get_main_account(nickname)

		if (!nickname) {return;}

		if (!key) {
			return players_stats[nickname]
		} else {
			return players_stats[nickname][key]
		}
	}

	get_tops(type_stat) {
		const select_message = db.prepare(`SELECT nickname, ${type_stat}
	          FROM stats
	          WHERE ? != 0 AND ? IS NOT NULL
	          ORDER BY ${type_stat} DESC`)

		const top_stat = select_message.all(type_stat, type_stat).map(elem => [elem.nickname, elem[type_stat]])
		return top_stat;
	}

	get_players() {
		const select_message = db.prepare(`SELECT nickname
																				FROM stats
																				WHERE rank > 0`)
		const nicks = select_message.all().map(elem => elem.nickname)
		return nicks;
	}

	add_player(nickname) {
		try {
			if (this.get_stats(nickname)) {
				return this.update_stats(nickname, "rank", 1)
			}

			const insertMessage = db.prepare(`INSERT INTO stats
																				(nickname)
																				VALUES (?)`)

			insertMessage.run(nickname)

			const selectMessage = db.prepare(`SELECT * FROM stats
																	WHERE nickname = ?`)

			const player = selectMessage.all(nickname)[0]

			cash_player(player)

			return {"is_ok": true}

		} catch (error) {
			return {"is_ok": false, "error": error.toString()}
		}
	}

	delete_player(nickname) {
		return this.update_stats(nickname, "rank", 0)
	}

	update_stats(nickname, key, new_value, action="equare") {
		try {
			nickname = this.get_main_account(nickname)
			if (!nickname) {return;}

			if (action === "add") {
				new_value = this.get_stats(nickname, key) + new_value
			}

			players_stats[nickname][key] = new_value

			if (typeof new_value === "object") {
				new_value = JSON.stringify(new_value)
			}

			console.log("Апдейт", nickname, key, new_value, action)

			const insertMessage = db.prepare(`UPDATE stats
												SET ${key} = ?
												WHERE nickname == ?`)

			insertMessage.run(new_value, nickname)

			let rank = this.get_stats(nickname, "rank")
			const donate = this.get_stats(nickname, "donate")

			if (key === "donate" && rank > 0 && rank !== Object.keys(ranks).length && donate >= price_donate[rank]) {
				let i;
				for (i = 0; donate >= price_donate[i]; i++) {
					// Ищем подходящий i
				}
				console.log(`UPDATE RANK ${nickname} ${rank} -> ${i}`)
				rank = i;
				console.log("RANK ", rank, typeof rank)
				this.update_stats(nickname, "rank", rank)
			}

			return {"is_ok": true}

		} catch (error) {
			return {"is_ok": false, "error": error.toString()}
		}
	}
}

module.exports = StatsModule

// module.exports = {module_name, cmd_processing, payment_processing, get_stats, get_players, get_actions, update_stats, help, structure}
