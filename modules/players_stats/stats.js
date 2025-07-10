const sqlite = require("better-sqlite3");

const path = require("path");

const text = require(path.join(__dirname,  '../text/text.js'))

const logging = require(path.join(__dirname, "../logging/logging.js"))

//const quotes = require(path.join(__dirname), "../quotes/quotes.js")
const ConfigParser = require("configparser")
const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

var phrases = {};
phrases["donate"] = JSON.parse(config.get("phrases", "donate"))

const db = new sqlite(path.join(__dirname, "players_stats.db"));

const module_name = "stats"
const help = "Показывает статистику игроков в боте"

const structure = {
  top: {
    "тип_статистики": {
      "номер_страницы": {
        _type: "int",
        _default: 1
      },
      _type: "string",
      _description: "Вид статистики, по которому нужно сгенерировать топ. Доступные: rank, messages, cmds, donate, casino"
    },
    _description: "Покажет топ по выбранному типу статистики"
  },
  nick: {
  	_type: "nick",
    _optional: true,
    _description: "Ник игрока, чью сатистику нужно посмотреть"
  }
}

const stats_table_names = ["nickname", "rank", "messages", "cmd", "donate", "casino", "name", "warns"]

const ranks = {1: "Подопытный", 2: "Стажёр", 3: "Исследователь", 4: "Учёный", 5: "Безумный учёный"}
const price_donate = [0, 40000, 100000, 500000, 1000000]

var actions = []

var players_stats = {}
let all_elements = db.prepare(`SELECT * FROM stats`).all();
all_elements.forEach(elem => players_stats[elem.nickname] = {"rank": elem.rank, "messages": logging.get_count_players_messages(elem.nickname),
															"cmds": elem.cmds, "donate": elem.donate, "casino": elem.casino,
															"name": elem.name, "credit": elem.name, "warns": elem.warns, 
															//"rating_quotes": get_rating_quote[elem.nickname],
															 "echo": elem.echo, "twinks": JSON.parse(elem.twinks)})

function substitute_text(pattern, values) {
	return pattern.replace(/\{([^}]+)\}/g, (match, key) => values[key]);
	
}

function random_choice(array) {
	return array[Math.floor(Math.random() * array.length)]
}

function get_main_account(nickname) {
	if (!players_stats[nickname]) {
		let marker_find = false;
		for (var nick in players_stats) {
			if (players_stats[nick] && players_stats[nick]["twinks"].includes(nickname)) {
				marker_find = true;
				break;
			}
		}
		if (marker_find) {
			return nick
		} 
	} else {
		return nickname;
	}
}

function get_stats(nickname, key) {
	try {
		nickname = get_main_account(nickname)
		if (!nickname) return;

		if (!key) {
			return players_stats[nickname]

		} else {
			return players_stats[nickname][key]
		}
	} catch (error) {
		return;
	}

}

function get_tops(type_stat) {
    let select_mesasge = db.prepare(`SELECT nickname, ${type_stat}
          FROM stats
          WHERE ? != 0 AND ? IS NOT NULL
          ORDER BY ${type_stat} DESC`)
    let top_stat = select_mesasge.all(type_stat, type_stat).map(elem => [elem.nickname, elem[type_stat]])
    return top_stat;

}

function update_stats(nickname, key, new_value, action="equare") {
	try {
		nickname = get_main_account(nickname)
		if (!nickname) return;

		if (action == "add") {
			new_value = get_stats(nickname, key) + new_value
		}
		players_stats[nickname][key] = new_value

		if (typeof new_value == "object") {
			new_value = JSON.stringify(new_value)
		}
		console.log("Апдейт",nickname, key, new_value, action)

		const insertMessage = db.prepare(`UPDATE stats
											SET ${key} = ?
											WHERE nickname == ?`)


		insertMessage.run(new_value, nickname)
		let rank = get_stats(nickname, "rank")
		let donate = get_stats(nickname, "donate")
		if (key == "donate" && rank != Object.keys(ranks).length && donate >= price_donate[rank]) {
			var i;
			for (i = 0; donate >= price_donate[i]; i++) {}
			console.log(`UPDATE RANK ${nickname} ${rank} -> ${i}`)
			rank = i;
			console.log("RANK ", rank, typeof rank)
			update_stats(nickname, "rank", rank)
			
		}

	} catch (error) {
		actions.push({
			type: "error",
			content: {
				date_time: new Date(),
				module_name: module_name,
				error: error,
				args: [nickname, key, new_value, action]
			}	
		})
	}
}

function stats_to_text(key, value) {
	if (key == "rank") {
		key = "Звание";
		value = ranks[value]
	} else if (key == "messages") {
		key = "Сообщения";
	} else if (key == "cmds") {
		key = "Команды"; 
	} else if (key == "donate") {
		key = "Задоначено";
		value = new Intl.NumberFormat('ru-RU').format(value) + "$";
	} else if (key == "casino") {
		key = "Выигрыш в казино";
		value = new Intl.NumberFormat('ru-RU').format(value) + "$";
	} else if (key == "name") {
		key = "Псевдоним";
	} else if (key == "rating_quotes") {
	 	key = "Рейтинг цитат"
	 	if (!value) {
	 		value = "Цитат нет"
	 	}
	 } else {
		key = undefined;
	}


	return [key, value];
}

function payment_processing(nick, cash, currency, reason, price_TCA) {
	try {
		if (currency == "TCA") cash *= price_TCA;
		console.log(`Получено ${cash} сурвингов`)
		update_stats(nick, key="donate", new_value=cash, "add")
		console.log("Обновилось")
		if (cash >= 10000) {
			let phrase = substitute_text(random_choice(phrases["donate"]), {"name": nick, "cash": cash})
			actions.push({"type": "answ", "content": {"message": phrase}})
		}
		return {"used": true}
	} catch (error) {
		console.log("Сломалось", error)
		actions.push({"type": "error", "content": {"date_time": new Date(), "module_name": module_name, "error": error,
			"args": [nick, cash, currency, reason, price_TCA],  "sender": nick}})
		return {"used": false}
	}
}

function cmd_processing (sender, args, parameters) {
	try {
		const seniors = parameters.seniors
		let send_in_private_message = true;
		if (args[0] == "help") {
			answ = "Возможные аргументы: [*nickname* - покажет ста-ку игрока в боте; top - покажет топ по указанной ста-ке]";
			
		} else if (args[0] == "edit" && seniors.includes(sender)) {
			if (args.length >= 4) {
				let [nickname, key, new_value, action] = args.slice(1)
				new_value = Number(new_value)
				if (!new_value) {
					new_value = args[3]
				}
				console.log(nickname, key,typeof new_value, [action])
				if (nickname && key && new_value) {
					update_stats(nickname, key, new_value, action)
				} else {
					answ = `Неверно введены аргументы: nickname: ${nickname}, key: ${key}, new_value: ${new_value}`
				}
			} 
			
		} else if (args[0] == "top") {
			if (args[0] == "help" || args.length == 1) {
				answ = "Возможные аргументы: [rank, messages, cmds, donate, casino] [номер страницы]"
				send_in_private_message = true;
				
			} else if (args.length >= 2) {
				let [type_stat, num_page] = args.slice(1)
				if (stats_table_names.includes(type_stat)) {
					if (num_page) {
						num_page = Number(num_page);
					} else {
						num_page = 1;
					}
					let top_stats = get_tops(type_stat);

					answ = text.stats_split_into_pages(get_tops(type_stat), nums_in_page=5, num_page=num_page)["answ"]
				} else {
					answ = "Статистики данного типа не существует"
				}
				}
			
		} else {
			let nickname;
			if (args.length > 0) {
				nickname = args[0]
			} else {
				nickname = sender
			}
			if (get_stats(nickname)) {
				send_in_private_message = false;
				console.log(get_stats(nickname))
				answ = Object.entries(get_stats(nickname)).map(([key, value]) => {
					[key, value] = stats_to_text(key, value)
					if (key && value) {
						return `${key}: ${value}`
					}
				}).filter(value => value);
				answ = `Статистика игрока ${nickname}: ${answ.join(", ")}`;
			} else {
				answ = `Игрок не найден. Убедитесь, что ник указан в верном регистре`;
			}
		}
		return {"type": "answ", "content": {"recipient": sender, "message": answ, "send_in_private_message": send_in_private_message}}
	} catch (error) {
		return {"type": "error", "content": {"date_time": new Date(), "module_name": module_name, "error": error, "args": args, "sender": sender}}
	} 
}

function get_actions() {
	return actions.splice(0)
}

module.exports = {module_name, cmd_processing, payment_processing, get_stats, get_actions, update_stats, help, structure}