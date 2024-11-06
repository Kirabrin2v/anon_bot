const mineflayer = require("mineflayer");
const pathfinder = require('mineflayer-pathfinder');
const maps = require("mineflayer-maps");

const math = require('mathjs');

const TelegramBot = require('node-telegram-bot-api');

const childProcess = require('child_process');

const GigaChat = require('gigachat-node').GigaChat;

const { spawn } = require('child_process');

const fs = require("fs");
const sqlite = require("better-sqlite3");
const db = new sqlite("txt/players_stats.db");
const db_quotes = new sqlite("txt/quotes.db")
const { exec } = require('child_process');

const translate = require('translate-google-api');

exec('node create_backup_db.js', (error, stdout, stderr) => {
       if (error) {
           console.error(`exec error: ${error}`);
           return;
       }
    });

const GoalFollow = pathfinder.goals.GoalFollow;
const GoalNear = pathfinder.goals.GoalNear;

const Vec3 = require('vec3').Vec3

const bot_username = "anon_bot";
const bot = mineflayer.createBot({
    host: "teslacraft.org",
    port: "25565",
    maps_outputDir: "img/",
    maps_saveToFile: true,
    version: "1.12.2",
    hideErrors: true,
    username: bot_username});
bot.loadPlugin(maps.inject)

const mcData = require('minecraft-data')(bot.version)

var bot_bal_survings = 0;
var bot_bal_TCA = 0;

const reg_nickname = String.raw`([А-яA-Za-z0-9~!@#$^*\-_=+ёЁ]{1,16})`;
const reg_message = String.raw`(.{1,256})`;
const reg_me_send = new RegExp(`^\\[${reg_nickname} -> Мне\\] ${reg_message}`)
const reg_i_send = new RegExp(`^\\[Я -> ${reg_nickname}\\] ${reg_message}`)

const reg_warn = new RegExp(`^${reg_nickname} был предупреждён блюстителем ${reg_nickname}\\.\nПричина: (.*)`)
const reg_ban = new RegExp(`^${reg_nickname} был забанен на (.*) блюстителем ${reg_nickname}\\.\nПричина: (.*)`)
const reg_mute = new RegExp(`^Выдан временный мут игроку ${reg_nickname} на (.*) блюстителем ${reg_nickname}\\.\nПричина: (.*)`)
const reg_kick = new RegExp(`^${reg_nickname} был кикнут с сервера блюстителем ${reg_nickname}\\.\nПричина: (.*)`)

const reg_encrypted_ip = String.raw`[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}`;
const reg_lookup = new RegExp(`ஜ♒♒♒  ${reg_nickname} \\| ${reg_encrypted_ip}  ♒♒♒ஜ\n ` +
"Статус: (.*)\n " +
"Звание: (?:\\[([А-яA-z\. ]*)\\].*){0,1}\n" +
"(?: Клан:   (.*)\n){0,1}\n " +
"Забанен:   (.*)\n " +
"Имеет мут: (.*)\n\n " +
"Регистрация: (.*) \\(Мск\\)\n " +
"Был в сети:  (.*) \\(Мск\\)\n" +
"(?: Местонахождение: (.*)\n){0,1} " +
"История: ([0-9]{1,4}) бан.*\n         " +
"([0-9]{1,4}) кик.*\n         " +
"([0-9]{1,4}) мут.*\n         " +
"([0-9]{1,4}) варн.*\n" +
"(?: Последние предупреждения:\n(?:  (.*)\n){0,1}" +
"(?:  (.*)\n){0,1}" +
"(?:  (.*)\n){0,1}){0,1}" +
`ஜ♒♒♒  ${reg_nickname} \\| ${reg_encrypted_ip}  ♒♒♒ஜ`)

const reg_survings_send = new RegExp(`^\\$([0-9,]*\\.[0-9]*) отправлено игроку ${reg_nickname}`)
const reg_TCA_send = new RegExp(`^Вы перевели ([0-9]*) балл(?:а||ов){1,2} TCA игроку ${reg_nickname}`)

const reg_survings_accept = new RegExp(`^${reg_nickname} отправил Вам \\$([0-9,]*)\\.[0-9]*`)
const reg_survings_reason = "^Причина: (.*)"

const reg_vic_anagrams = new RegExp("\\[Викторина\\] Расшифруйте первым анаграмму (.*) , чтобы выиграть!")
const reg_vic_fast = new RegExp("\\[Викторина\\] Напечатайте первым (.*), чтобы выиграть!")
const reg_vic_example = new RegExp("\\[Викторина\\] Решите первым пример (.*), чтобы выиграть!")
const reg_vic_quest = new RegExp("\\[Викторина\\] (.*)")

reg_tca_accept = String.raw`\- ([0-9]{2}\.[0-9]{2}\.[0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}) (\+|\-)([0-9]{1,5}) TCA \([0-9]{1,5} TCA\) Передача баллов (?:от игрока|игроку) ${reg_nickname}`

reg_bal_survings = String.raw`Ваш баланс сурвингов: \$([0-9,]{1,10})\.[0-9]{0,2}`
reg_bal_TCA = String.raw`Баланс баллов TCA: ([0-9]{1,5})`

const reg_quotes = new RegExp(`"(.{1,235})" \\(C\\) ${reg_nickname}`)

var bank_auth = {}

var controllers = {"ручуп": {},
				   "ручуп3": {},
				   "зырь": {}}

const key_to_direction = {"5": "forward", "w": "forward", "2": "back", "s": "back", "1": "left", "a": "left", "3": "right", "d": "right",
						  "4": "jump", "space": "jump", "6": "sneak", "shift": "sneak", "ctrl": "sprint"}

var timer_check_cmds = 0;
var timer_send_alert_grief = 0;

var last_nick_place_bed;
var last_placed_bed = {}
var last_destroyed_bed = {}

var SOPN_veriefed_players;

games = {"wordle": {}}
waiting_start_game = {"wordle": {}}

var wait_confirm_pay = {"TCA": [], "survings": []}

var queue_waiting_data = {"lookup": [], "seen": [], "private_message": {}, "pay": [], "casino": {}, "casino2": {}, "casino3": {}}

const ConfigParser = require('configparser');
const config_settings = new ConfigParser();
const config_info = new ConfigParser();

var config_block = {"info": false, "settings": false}

config_settings.read("txt/settings.ini")
config_info.read("txt/info.ini")

const tg_channel_id = config_settings.get("VARIABLES", "tg_chat_id")
var send_msg_tg = false;
const tg = new TelegramBot(config_settings.get("VARIABLES", "tg_key"), {

  polling: {
    interval: 300,
    autoStart: true
  }

});

var payloads_GigaGpt = {}
const client = new GigaChat(
    clientSecretKey=config_settings.get("VARIABLES", "GigaGpt_key"), 
    isIgnoreTSL=true,
    isPersonal=true,
    autoRefreshToken=true
);
client.createToken();

function send_pay(nick, money, reason="") {
	cmds.push(`/pay ${nick} ${money} ${reason}`.slice(0, 255))
	cmds.push(`/pay confirm`)
	wait_confirm_pay["survings"].push({"nick": nick, "cash": money, "reason": reason})
	
}

function substitute_text(pattern, values) {
	return pattern.replace(/\{([^}]+)\}/g, (match, key) => values[key]);
	
}

function check_needed_rank(rank, needed_rank) {
	let is_ok, message_error;
	if (rank >= needed_rank) {
		is_ok = true;
	} else {
		is_ok = false;
		message_error = `Минимальное звание для использование этой команды - ${ranks[needed_rank]}. Подробнее - в cmd звания`
	}
	return {"is_ok": is_ok, "message_error": message_error}
}

function check_valid_bet(nick, bet, rank=get_stats(nick, "rank"), mode_casino) {
	bet = Number(bet)
	let is_ok = true;
	let message_error;

	coef_win = 1;

	if (mode_casino == "3") {
		coef_win = 4.5
	
	} else if (players_increased_win[nick]) {
		coef_win = players_increased_win[nick]
	} 


	let min_cash = 5000;
	let max_cash = rank_privilegies["casino_max_bet"][rank-1]
	if (!bet) {
		is_ok = false;
		message_error = "Неверно введено число";
	} else if (bet < min_cash || bet > max_cash) {
		is_ok = false;
		message_error = `Число должно находиться в диапазоне от ${min_cash}$ до ${max_cash}$`;
	} else if (bet*0.9*coef_win >= bot_bal_survings) {
		is_ok = false;
		message_error = `У бота недостаточно средств, чтобы можно было сыграть на эту ставку. Текущий баланс: ${bot_bal_survings}`;
	}
	return {"is_ok": is_ok, "message_error": message_error}
}

function wordle_transfrom_word(word, word_win) {
    let answ = "*".repeat(word.length).split('')
    let used_symbols = {}
    word = word.split('')
    word_win = word_win.split('')

    for (let i = 0; i < word.length; i++) {
        let symbol = word[i]
        if (word[i] == word_win[i]) {
            answ[i] = word[i].toUpperCase()
            if (used_symbols[symbol]) {
                used_symbols[symbol] += 1

            } else {
                used_symbols[symbol] = 1
            }
        } else if (!used_symbols[symbol]) {
            used_symbols[symbol] = 0
        }
    }

    for (let i = 0; i < word.length; i++) {
        if (answ[i] === "*" && word_win.includes(word[i]) && count(word_win, word[i]) > used_symbols[word[i]]) {
            used_symbols[word[i]] += 1
            answ[i] = word[i]

        }
    }
    return answ.join("")
}

function wordle (nick, word) {
	let word_win = games["wordle"][nick]["word"]
	let attempts = games["wordle"][nick]["attempts"]
	let history = games["wordle"][nick]["history"]
	let opponent = games["wordle"][nick]["opponent"]
	console.log(history, attempts)
	let answ;

	if (word == word_win) {
		answ = `Вы победили за ${attempts+1} попыток! Загаданное слово: ${word_win}`
		delete games["wordle"][nick]

	} else {
		attempts += 1
		if (attempts >= 6) {
			answ = `К сожалению, Вы проиграли! Загаданное слово: ${word_win}`
			delete games["wordle"][nick]

		} else {
			let transform_word = wordle_transfrom_word(word, word_win)
			history += `${attempts}. ${word}: ${transform_word} `
			answ = `Неверно! ${history}`
		}

	}
	if (games["wordle"][nick]) {
		games["wordle"][nick]["history"] = history;
		games["wordle"][nick]["attempts"] = attempts;
	}
	answs.push([`Логи игры с ${nick}: ` + answ, {"sender": opponent, "send_in_private_message": true}])
	answs.push([answ, {"sender": nick, "send_in_private_message": true}])

}

function bank_processing (nick, cmd, args) {
	if (bank_auth[nick]) {
		let is_main = bank_auth[nick]["is_main"]
		if (cmd == "auth") {
			answs.push([`Вы уже авторизованы в счёте ${bank_auth[nick]["name_bank"]}. Чтобы авторизоваться в другом счёте, сначала выйдите из этого: сmd bank logout`,
			 {"sender": nick, "send_in_private_message": true}])
		
		} else if (cmd == "снять") {
			
			if (is_main) {
				let amount = Number(args[0])
				let currency = args[1]
				if (amount) {
					if (currency) {
						currency = currency.toLowerCase()
						let name_bank = bank_auth[nick]["name_bank"]
						if (currency.includes("tca") || currency.includes("тса")) {
							let count_TCA = bank_info[name_bank]["TCA"]
							if (count_TCA >= amount) {
								if (amount <= bot_bal_TCA) {
									console.log(`Перевожу игроку ${nick} ${amount} TCA`)
									update_bank(nick, name_bank, -amount, "TCA")
									cmds.push(`/tca transfer ${nick} ${amount}`)
									cmds.push('/confirm')
									wait_confirm_pay["TCA"].push({"nick": nick, "cash": amount})
									
								
								} else {
									answs.push([`У бота на счету на данный момент недостаточно средств, чтобы выдать всю сумму. Текущий баланс бота: ${bot_bal_TCA} TCA`,
									 {"sender": nick, "send_in_private_message": true}])
								}

							} else {
								answs.push([`У Вас недостаточно средств на балансе. Количество Ваших TCA: ${count_TCA}`, {"sender": nick, "send_in_private_message": true}])
							}

						} else if (currency.includes("surv") || currency.includes("сурв")) {
							let count_survings = bank_info[name_bank]["survings"]
							if (count_survings >= amount) {
								if (amount <= bot_bal_survings) {
									console.log(`Перевожу игроку ${nick} ${amount} сурвингов`)
									update_bank(nick, name_bank, -amount, "survings")
									send_pay(nick, amount, `Вы успешно сняли со счёта ${amount}$`)

								} else {
									answs.push([`У бота на счету на данный момент недостаточно средств, чтобы выдать всю сумму. Текущий баланс бота: ${bot_bal_survings}$`,
									 {"sender": nick, "send_in_private_message": true}])
								}

							} else {
								answs.push([`У Вас недостаточно средств на балансе. Количество Ваших сурвингов: ${count_survings}`, {"sender": nick, "send_in_private_message": true}])
							}

						}

					} else {
						answs.push(["Вы не указали валюту(сурвинги/TCA)", {"sender": nick, "send_in_private_message": true}])

					}
				} else {
					answs.push(["Вы не указали количество и название валюты", {"sender": nick, "send_in_private_message": true}])

				}

			} else {
				answs.push(["Вы в гостевом режиме, поэтому не имеете права на вывод денег", {"sender": nick, "send_in_private_message": true}])
			}

		} else if (cmd == "logout") {
			delete bank_auth[nick]
			answs.push(["Вы разлогинились. Повторно пройти авторизацию: сmd bank auth [название счёта] [пароль]", {"sender": nick, "send_in_private_message": true}])
		
		} else if (cmd == "баланс") {
			let name_bank = bank_auth[nick]["name_bank"]
			let count_TCA = bank_info[name_bank]["TCA"]
			let count_survings = bank_info[name_bank]["survings"]
			answs.push([`Текущий баланс выбранного счёта: TCA: ${count_TCA}; Сурвингов: ${count_survings}`, {"sender": nick, "send_in_private_message": true}])
		
		} else if (cmd == "пополнить") {
			answs.push(["Для пополнения баланса не нужно прописывать отдельную команду, т.к. вы уже авторизованы в этом счёте. В течение текущей сессии любой перевод TCA/сурвингов будет автоматически зачислен на счёт",
			 {"sender": nick, "send_in_private_message": true}])
		
		} else {
			answs.push(["Возможные аргументы: [снять, пополнить, баланс, logout, создать]", {"sender": nick, "send_in_private_message": true}])
		}

	} else {
		if (cmd == "auth") {
			let name_bank = args[0]
			let password = args[1]
			if (name_bank && password) {
				name_bank = name_bank.toLowerCase()
				password = password.toLowerCase()
				if (bank_info[name_bank] && (bank_info[name_bank].main_password == password || bank_info[name_bank].visitor_password == password)) {
					informed_users["bank"]["auth"] = []
					informed_users["bank"]["wrong_data"] = []
					informed_users["bank"]["add"] = []

					let mode;
					if (bank_info[name_bank].main_password == password) {
						bank_auth[nick] = {"name_bank": name_bank, "is_main": true}
						mode = "владелец счёта"
					
					} else {
						bank_auth[nick] = {"name_bank": name_bank, "is_main": false}
						mode = "гость"
					}

					answs.push([`Вы успешно авторизовались как ${mode}. Авторизация актуальна следующие 10 минут. После их истечения надо будет заново авторизоваться.`,
					 {"sender": nick, "send_in_private_message": true}])
					setTimeout((nick) => {
						if (bank_auth[nick]) {
							delete bank_auth[nick]
							answs.push(["Время активности авторизации истекло. Для продолжения авторизуйтесь в банке заново", {"sender": nick, "send_in_private_message": true}])
							console.log("удалён из банка:", nick)

						}else {

						}
					}, 600000, nick)
				
				} else if (!informed_users["bank"]["wrong_data"].includes(nick)) {
					answs.push(["Название счёта или пароль введены неверно. Это сообщение при введении неправильных данных больше отправляться не будет. Если данные будут введены корректно - сообщение будет отправлено.",
					 {"sender": nick, "send_in_private_message": true}])
					informed_users["bank"]["wrong_data"].push(nick)
				}

			} else {
				informed_users["bank"]["empty_data"].push(nick)
				answs.push(["Верный синтаксис: сmd bank auth [название_счёта] [пароль]", {"sender": nick, "send_in_private_message": true}])

			}

		} else if (cmd == "пополнить" && !informed_users["bank"]["add"].includes(nick)) {
			informed_users["bank"]["add"].push(nick)
			answs.push(["Для пополнения баланса Вам нужно сначала авторизоваться с помощью команды: сmd bank auth [название счёта] [пароль]. Данное сообщение больше отправляться не будет", 
				{"sender": nick, "send_in_private_message": true}])

		} else if (!informed_users["bank"]["auth"].includes(nick)) {
			answs.push(["Вы не авторизованы, сделайте это командой: сmd bank auth [название счёта] [пароль]. Данное сообщение отправляется только 1 раз.", {"sender": nick, "send_in_private_message": true}])
			informed_users["bank"]["auth"].push(nick)
		}
	}
	
	

}

function casino (nick, cash, name_violator, symbols) {
	let win;
	console.log("Ник нарушителя", name_violator)
	if (name_violator) {
		console.log("Определено по нику")
		if (name_violator.length % 2 == 0) {
			win = 0;
		} else {
			win = 1;
		}

	} else if (symbols) {
		let [symbol_1, symbol_2, symbol_3] = symbols
		console.log("Символы в казино", symbol_1, symbol_2, symbol_3)
		if ( (symbol_1 == symbol_2 || symbol_1 == "✪" || symbol_2 == "✪") && (symbol_2 == symbol_3 || symbol_2 == "✪" || symbol_3 == "✪") && (symbol_1 == symbol_3 || symbol_1 == "✪" || symbol_3 == "✪") ) {
				win = 1;
			} else {
				win = 0;
			}

	} else {
		win = random_choice([0, 1])
		console.log("Определено рандомно", win)

	}
	if (win) {
		coef_win = 1;
		if (players_increased_win[nick] && !symbols) {
			coef_win = players_increased_win[nick]
			delete players_increased_win[nick]

		} else if (symbols) {
			coef_win = 5

		}

		let win_cash = Math.floor(cash * 0.9 * coef_win);
		update_stats(nick, key="casino", new_value=win_cash, "add")
		let phrase_win = random_choice(phrases["casino_win"])
		let phrase_win_public = substitute_text(random_choice(phrases["casino_win_public"]), {"name": nick, "cash": win_cash})
		send_pay(nick, cash+win_cash, phrase_win)

		if (win_cash >= 100000) {
			answs.push(phrase_win_public)
		} 

	} else {
		update_stats(nick, key="casino", new_value=-cash, "add")
		let phrase_lose = substitute_text(random_choice(phrases["casino_lose"]), {"cash": cash})
		if (players_increased_win[nick]) {
			delete players_increased_win[nick]
		
		} else if (random_number(1, 20) == 1 && !symbols) {
			coef_win = random_choice([1.25, 1.5, 2, 2.25, 2.5])
			players_increased_win[nick] = coef_win
			phrase_lose += ` Если выиграете следующую игру, приз умножится в ${coef_win} раз(а)!`

		}
		send_pay(nick, 0.01, phrase_lose)
	}
}

function cooldown_processing(sender, cmd) {
	if (seniors.includes(sender)) {
		return {"is_ok": true}
	}
	if (cooldown[cmd]["players"][sender]) {
		let time_end = cooldown[cmd]["players"][sender]
		if (new Date().getTime() > time_end) {
			cooldown[cmd]["players"][sender] = new Date().getTime() + cooldown[cmd]["cooldown"]
			return {"is_ok": true}
		
		} else {
			let delta_time = (time_end - new Date().getTime()) / 60000
			return {"is_ok": false, "message_error": `До возможности использования этой команды осталось минут: ${delta_time.toFixed(2)} `}
		}

	} else {
		cooldown[cmd]["players"][sender] = new Date().getTime() + cooldown[cmd]["cooldown"]
		return {"is_ok": true}

	}
}

function payment_processing(nick, cash, reason, currency="survings") {
	if (get_stats(nick) && (get_stats(nick, "warns") >= 5 || (reason && reason.toLowerCase().includes("warn")) )) {
		if (cash >= 10000) {
			let count_warns = get_stats(nick, "warns")
			let count_del_warns = Math.floor(cash / 10000)
			if (count_del_warns > count_warns) {
				count_del_warns = count_warns
			}
			let price_del_warns = count_del_warns * 10000
			let rest_of_cash = cash - price_del_warns
			let new_count_warns = count_warns - count_del_warns

			update_stats(nick, "warns", -count_del_warns, "add")
			
			let answ = `Вам было снято ${count_del_warns} варн(ов) за ${price_del_warns}$. Текущее кол-во варнов: ${new_count_warns}`
			if (currency == "TCA" || rest_of_cash < 1000) {
				answs.push([answ, {"sender": nick, "send_in_private_message": true}])
				cash = rest_of_cash;

			} else {
				send_pay(nick, rest_of_cash, `${answ}. ${rest_of_cash} - Ваша сдача`)
				return;
			}
		} 
		

	} else if (queue_waiting_data["casino"][nick] || queue_waiting_data["casino2"][nick] || queue_waiting_data["casino3"][nick]) {
		if (queue_waiting_data["casino"][nick]) {
			var mode_casino = "casino"
		
		} else if (queue_waiting_data["casino2"][nick]) {
			var mode_casino = "casino2"
		
		} else {
			var mode_casino = "casino3"
		}

		let info = queue_waiting_data[mode_casino][nick];

		let expected_cash = info["expected_cash"]
		if (expected_cash == cash) {
			let func = info["function"]
			delete queue_waiting_data[mode_casino][nick];
			func(nick, cash)
			return;

		} else if (cash >= 5000) {
			let return_cash = Math.floor(cash / 100 * 90)
			console.log(` return_cash ${return_cash} `)
			send_pay(nick, return_cash, `Ожидалась другая сумма: ${expected_cash}`)
			return;
		}
		
	} else if (reason && reason.toLowerCase().includes("casino")) {
		let info = check_valid_bet(nick, cash)
		let is_ok = info["is_ok"]
		if (is_ok) {
			casino(nick, cash)
			
		} else {
			let message_error = info["message_error"]
			answ = message_error;
			let return_cash;
			if (cash >= 5000) {
				return_cash = cash*0.9;

			} else {
				return_cash = 0.01;
			}
			send_pay(nick, return_cash, answ)
		}
		return;

	} else if (bank_auth[nick]) {
		if (currency == "TCA") {
			update_bank(nick, bank_auth[nick]["name_bank"], cash/12000, "TCA")
			answs.push([`На счёт успешно зачислено ${cash/12000} TCA`, {"sender": nick, "send_in_private_message": true}])
		
		} else {
			update_bank(nick, bank_auth[nick]["name_bank"], cash, "survings")
			answs.push([`На счёт успешно зачислено ${cash}$`, {"sender": nick, "send_in_private_message": true}])
		}

		return;
	}
	
	update_stats(nick, key="donate", new_value=cash, "add")
	if (cash >= 10000) {
		let phrase = substitute_text(random_choice(phrases["donate"]), {"name": nick, "cash": cash})
	answs.push(phrase)
	}
	
}

function update_config(key1, key2, dict) {
	if (!config_block["info"]) {
		config_block["info"] = true;
		config_info.set(key1, key2, JSON.stringify(dict))
		config_info.write("txt/info.ini")
		setTimeout(() => {
			config_block["info"] = false;
		}, 50)
		


	} else {
		setTimeout(() => {
			update_config(key1, key2, dict)
		}, 1000)
	}
}

function update_bank(nickname, name_bank, amount, currency) {
	const insertMessage = db.prepare(`INSERT INTO bank (
	date_time, name_bank, nickname, amount, currency)
	VALUES (datetime('now', '+3 hours'), @name_bank, @nickname, @amount, @currency)`);
	insertMessage.run({
	  name_bank: name_bank,
	  nickname: nickname,
	  amount: amount,
	  currency: currency
	});

	bank_info[name_bank][currency] += amount
}

function get_stats(nickname, key) {
	if (!players_stats[nickname]) {
		let marker_find = false;
		for (var nick in players_stats) {
			if (players_stats[nick] && players_stats[nick]["twinks"].includes(nickname)) {
				nickname = nick;
				marker_find = true;
				break;
			}
		}
		if (!marker_find) {
			return;
		}
	}

	if (!key) {
		return players_stats[nickname]

	} else {
		return players_stats[nickname][key]
	}

}

function update_stats(nickname, key, new_value, action="equare") {
	try {
		if (!players_stats[nickname]) {
			let marker_find = false;
			for (var nick in players_stats) {
				if (get_stats(nick) && get_stats(nick, "twinks").includes(nickname)) {
					console.log(`Обнаружен твинк ${nickname} -> ${nick}`)
					nickname = nick;
					marker_find = true;
				}
			}
			if (!marker_find) {
				return;
			}
		}
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
    } catch(err) {
		console.log(err)
	}
}

function create_new_user(nickname, rank=1, messages=0, cmds=0, donate=0, casino=0, name, credit=0, warns=0, echo=1, twinks="[]") {
	try{
		const insertMessage = db.prepare(`INSERT INTO stats VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
		insertMessage.run(nickname, rank, messages, cmds, donate, casino, name, credit, warns, echo, twinks)
		players_stats[nickname] = {"rank": rank, "messages": messages, "cmds": cmds, "donate": donate,
									"casino": casino, "name": name, "credit": credit, "warns": warns,
									"echo": echo, "twinks": twinks}
		return {"status": true};
	}	catch(err) {
		return {"status": false, "message_error": err};
	}
}

function get_tops(type_stat) {
  try {
    let stat_top = db.prepare(`SELECT nickname, ${type_stat}
          FROM stats
          WHERE ${type_stat} != 0 AND ${type_stat} IS NOT NULL
          ORDER BY ${type_stat} DESC`).all().map(elem => [elem.nickname, elem[type_stat]]);
    return stat_top;
  } catch(err) {
    console.log(err);
  }
}



function get_placed_beds(nickname="nickname", date_start=new Date(2006, 11, 17), date_end=new Date(2999, 6, 6)) {
							
	const date_start_text = date_to_text(date_start)
	const date_end_text = date_to_text(date_end)
	console.log(date_start_text, date_end_text)
	
	let placed_beds = db.prepare(`SELECT nickname, x, y, z
									FROM blocks
									WHERE type_action == 'Установка'
									AND block_name == 'bed'
									AND nickname == ${nickname}
									AND date_time BETWEEN '${date_start_text}' AND '${date_end_text}'
									ORDER BY date_time DESC`).all()
	placed_beds = placed_beds.map((elem) => {
		return [elem.nickname,  `x:${elem.x} y:${elem.y} z:${elem.z}`]})
	console.log(placed_beds)
	return placed_beds
}

function add_block_to_bd(nickname, type_action, block_name, position) {
	const insertMessage = db.prepare(`INSERT INTO blocks (
	nickname, date_time, type_action, block_name, x, y, z)
	VALUES (@nickname, datetime('now', '+3 hours'), @type_action, @block_name, @x, @y, @z)`);
	insertMessage.run({
	  nickname: nickname,
	  type_action: type_action,
	  block_name: block_name,
	  x: position.x,
	  y: position.y,
	  z: position.z
	});
	
}

function add_pay_to_bd(payer, payee, amount, currency, date_time=date_to_text(new Date), reason) {
	const insertMessage = db.prepare(`INSERT INTO money (
	date_time, payer, payee, amount, currency, reason)
	VALUES (@date_time, @payer, @payee, @amount, @currency, @reason)`);
	insertMessage.run({
	  date_time: date_time,
	  payer: payer,
	  payee: payee,
	  amount: amount,
	  currency: currency,
	  reason: reason
	  });
	  if (currency == "TCA") {
		  last_payers_TCA = db.prepare(`SELECT * FROM money WHERE payee == '${bot_username}' AND currency == 'TCA' ORDER BY id DESC LIMIT 30`).all();
	  }
}

function add_msg_to_bd(nickname, type_chat, message) {
	const insertMessage = db.prepare(`INSERT INTO messages (
	nickname, date_time, type_chat, message)
	VALUES (@nickname, datetime('now', '+3 hours'), @type_chat, @message)`);
	insertMessage.run({
	  nickname: nickname,
	  type_chat: type_chat,
	  message: message
	})
}

function get_quotes_from_author(author) {
	let quotes_by_author = quotes.filter((quote) => {
		return quote.author.toLowerCase() == author.toLowerCase();
	})
	return quotes_by_author
	
}

function update_logs_quotes(ID, nickname, add_number) {
	const insertMessage = db_quotes.prepare(`INSERT INTO logs
											(date_time, nickname, ID_quote, add_number)
											VALUES (datetime('now', '+3 hours'), ?, ?, ?)`)
	insertMessage.run(nickname, ID, add_number)
}

function update_rating_quotes(ID, num_add) {
	let rating = quotes[ID-1]["rating"]
	const insertMessage = db_quotes.prepare(`UPDATE quotes
											SET rating = ?
											WHERE ID == ?`)


	insertMessage.run(rating+num_add, ID)
	quotes[ID-1]["rating"] += num_add
	update_config("permanent_memory", "quotes_rep", quotes_rep)
}
 
function send_quote(ID) {
	let quote_info = quotes[ID-1]
	if (quote_info) {
		let author = quote_info["author"]
		let quote = quote_info["citation"]
		last_quotes_ID = ID
		answs.push(`[Цитаты Эндерчан] "${quote}" (C) ${author}`)
		if (random_number(0, 1)) {
			answs.push("Вы можете поставить свою оценку любой цитате, для этого пропишите команду 'сmd цитата rep id_цитаты +/-'. '+' - повысить рейтинг, '-' - понизить")
		}
		return {"is_ok": true, "author": author, "quote": quote}
	
	} else {
		return {"is_ok": false, "message_error": "Цитата не была найдена"}
	}
}

function send_random_quote() {
  let rand_number = random_number(0, sum_ratings_quotes-1)
  for (let i = 0; i < quotes.length; i++) {
    var quote_info = quotes[i]
    let range_start = quote_info["range_start"]
    let rating = quote_info["rating"]
    let range_end = range_start + rating
    if (rand_number >= range_start && rand_number <= range_end) {
      break;
    }
    
  }

  let ID = quote_info["ID"]
  let author = quote_info["author"]
  let quote = quote_info["citation"]
  send_quote(ID)
  return {"ID": ID, "author": author, "citation": quote}
}

function count(array, value) {
    return array.reduce((accumulator, currentValue) => {
        return currentValue === value ? accumulator + 1 : accumulator;
    }, 0);
}

function date_to_text(date) {
	const year = date.getFullYear();
    const month = String(date.getMonth()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function text_split_into_pages(text, max_len=220, num_page=1) {
	const pages = [];
	let currentPage = '';
	let currentCharCount = 0;
	let last_page = Math.ceil(text.length / max_len)
	max_len -= 7;

	const words = text.split(' ');

	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		const wordLength = word.length;

		if (currentCharCount + wordLength > max_len) {
			pages.push(currentPage.trim());
			currentPage = '';
			currentCharCount = 0;
		}

		currentPage += word + ' ';
		currentCharCount += wordLength + 1; // +1 for the space
	}

	if (currentPage.trim() !== '') {
		pages.push(currentPage.trim());
	}

	let page = pages[num_page-1];
	if (page) {
		return page + ` [${num_page}/${last_page}]`;
	} else {
		return "Такой страницы не существует";
	}
}

function top_split_into_pages(stat_top, nums_in_page=5, num_page=1, begin_text="", separator="; ", max_len=240) {
	if (!stat_top) return;
	let length_arr = stat_top.length;
	let pages = []
	let last_page = Math.ceil(length_arr / nums_in_page)
	max_len -= 7;
	
	for (let i = 0; i < length_arr; i += nums_in_page) {
		let ind_top = i
		pages.push(begin_text + stat_top.slice(i, i+nums_in_page).map((elem) => {
			ind_top++
			return `${ind_top}) ${elem.join(": ")}`;
			}).join(separator) + ` [${parseInt(i/nums_in_page) + 1}/${last_page}]`);
	}
	let answ = pages[num_page-1]
	if (answ) {
		return answ;
		
	} else {
		return "Такой страницы не существует";
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
	 } else {
		key = undefined;
	}
	return [key, value];
}

function check_nearby_players() {
	let nearby_players = get_players_on_loc()
	
	nearby_players.forEach((nick) => {
		if (!bot.players[nick]) return;
		let displayName = bot.players[nick].displayName.text
		if (!nick.match(reg_nickname) || nick == displayName || nick == bot_username) return;
		
		if (!informed_users["update"].includes(nick) && players_stats[nick] && players_stats[nick]["echo"]) {
			let advert =  fs.readFileSync("txt/advert.txt", 'utf-8');
			if (advert.length < 5) return;
			setTimeout(() => {
				answs.push([advert, {"sender": nick, "send_in_private_message": true}])}, 5000)
			informed_users["update"].push(nick)
			update_config("informed_users", "update", informed_users["update"])

		} else if (SOPN_veriefed_players && !SOPN_veriefed_players.has(nick) && location_bot && location_bot.includes("Локация Край")) {
			if (bot.players[nick]) {
				cmds.push(`/lookup ${nick}`)
				queue_waiting_data["lookup"].push({"function": check_potential_griefer, "nick": nick})
				//console.log(queue_waiting_data)
				SOPN_veriefed_players.add(nick)
			}
		}
		if (users_greetings[nick] && users_greetings[nick]["on"] && (!processed_users["greetings"][nick] || processed_users["greetings"][nick] < new Date().getTime())) {
			processed_users["greetings"][nick] = new Date().getTime() + 10800000 //3 часа
			update_config("processed_users", "greetings", processed_users["greetings"])
			answs.push(" " + users_greetings[nick]["text"])
			//console.log("Приветствие:", users_greetings[nick]["text"])
		}
	})
}

function check_potential_griefer(lookup_data) {
	let nickname = lookup_data.nickname
	let date_reg = lookup_data.date_reg;
	let [day, month, year] = date_reg.split(" ")[0].split(".").map(elem => Number(elem))
	let [hours, minutes, seconds] = date_reg.split(" ")[1].split(":").map(elem => Number(elem))
	date_reg = new Date(year, month, day, hours, minutes, seconds)
	let rank = lookup_data.rank;
	let date_now = new Date()
	let diff_days = (date_now - date_reg) / 86400000;
	let danger_player = false;


	if (rank == 1) {
		if (diff_days < 30) {
			danger_player = true;
		} 
		
	} else if (rank < 11) {
		if (diff_days < 7) {
			danger_player = true;
		}
		
	} else {
		if (diff_days < 3) {
			danger_player = true;
		} 
	}
	
	if (danger_player && (!get_stats(nickname) || players_stats[nickname]["rank"] >= 2)) {
		//console.log(`[СОПН] ${nickname}, ${random_choice(phrases["СОПН"])}`)
		answs.push(`[СОПН] ${nickname}, ${random_choice(phrases["СОПН"])}`)
		console.log(`${nickname} подозрителен - ${diff_days} дней`)
	} else {
		console.log(`${nickname} не опасен - ${diff_days} дней`)
	}
	
}

function generate_nick(vows=vow_letter, cons = con_letter, num_block=false, len_nick=random_choice([4,5,6,7,8])) {
	let nick = "";
    let vow_or_con = random_choice(["vow", "con"])
    for (let i = 0; i < len_nick; i++) {
        if (vow_or_con == "vow") {
            nick += random_choice(vows)
            vow_or_con = "con";
		} else {
            nick += random_choice(cons)
            vow_or_con = "vow";
		}
	}
    return nick.toLowerCase()
}

function calculate(expression) {
	try {
	    const result = math.evaluate(expression);
	    return {"is_ok": true, "result": result}

	} catch (error) {
		return {"is_ok": false, "message_error": error.message}
	}
}

function track_player(nickname) {
	let answ;
	let player = bot.players[nickname]
	if (player && player.entity) {
		let pos = player.entity.position
		let [x, y, z] = [pos.x, pos.y, pos.z]
		bot.lookAt(new Vec3(x, y+1.5, z))
	} else {
		clearInterval(controllers["зырь"]["timer_id"])
		controllers["зырь"] = {};
	}
	if (answ) {
		answs.push([answ, {"sender": nickname, "send_in_private_message": true}])
	}

}

function repeat_head_position(nickname) {
	let player = bot.players[nickname]
	if (player && player.entity) {
		let [yaw, pitch] = [bot.players["Herobrin2v"].entity.yaw, bot.players["Herobrin2v"].entity.pitch]
		bot.look(yaw, pitch, 1)
	} else {
		if (controllers["ручуп"]["timer_id"]) {
			clearInterval(controllers["ручуп"]["timer_id"])
			answs.push(["Я Вас не вижу. Мимикрия положения головы выключена", {"sender": nickname, "send_in_private_message": true}])
		}
		

	}
}

function control_bot(nickname) {
	let answ;
	if (seniors_online) {


		let player = bot.players[nickname]
		if (player && player.entity) {
			let current_item_id;

			if (!player.entity.heldItem) {
				current_item_id = -1
			} else {
				current_item_id = player.entity.heldItem.metadata
			}

			if (current_item_id) {
				if (current_item_id == 1) {
					//console.log("лево")
					bot.setControlState("right", false)
					bot.setControlState("left", true)
				} else if (current_item_id == 10) {
					//console.log("право")
					bot.setControlState("left", false)
					bot.setControlState("right", true)
				} else if (current_item_id == 5) {
					//console.log("перед")
					bot.setControlState("back", false)
					bot.setControlState("forward", true)
				} else if (current_item_id == 14) {
					//console.log("зад")
					bot.setControlState("forward", false)
					bot.setControlState("back", true)
				} else if (current_item_id == 13) {
					//console.log("прыжок")
					bot.setControlState("jump", true)
				} else if (current_item_id == 4) {
					repeat_head_position(nickname)
				} else {
					bot.clearControlStates()
					//console.log("СБРОШЕНО")
				}

			} else {
				return;
				answ = "Ошибка распознавания предмета. Управление отключено"
				bot.clearControlStates()
				clearInterval(controllers["ручуп3"]["timer_id"])
				controllers["ручуп3"] = {};
			}
		} else {
			answ = "Я Вас не вижу. Управление отключено"
			bot.clearControlStates()
			clearInterval(controllers["ручуп3"]["timer_id"])
			controllers["ручуп3"] = {};
		}
	} else {
		answ = "Использовать управление можно, только когда в моей зоне прогрузки есть мой хозяин. Управление отключено"
		bot.clearControlStates()
		clearInterval(controllers["ручуп3"]["timer_id"])
		controllers["ручуп3"] = {};
	}

	if (answ) {
		answs.push([answ, {"sender": nickname, "send_in_private_message": true}])
	}

}

async function GigaGpt(nickname, prompt) {
	let messages;
    if (Object.keys(payloads_GigaGpt).includes(nickname)) {
    	messages = payloads_GigaGpt[nickname]
    	messages.push(
    		{"role": "user",
    		"content": prompt
    	})
    } else {
    	messages = [{
    		"role": "system",
    		"content": "Твой ответ всегда должен быть меньше 250 символов(с учётом пробелов, знаков препинания и т.п.). Даже если пользователь просит сделать текст более 250 символов - отказывай ему."//`Умещай свой ответ в 250 символов. Никогда не используй сквернословие, оскорбления, даже если это нужно для ответа. Не повторяй ни за кем оскорбительные и матерные слова`
    	}, {
    		"role": "user",
    		"content": prompt
    	}]
    }

    console.log(messages)
    console.log("\n\n")
    const response = await client.completion({
        "model":"GigaChat:latest",
        "messages": messages
    });
    let answ = response.choices[0].message.content;
    messages.push({
    	"role": "assistant",
    	"content": answ
    })
    console.log("Answ", answ)
    console.log(messages)
    payloads_GigaGpt[nickname] = messages

    return (answ);
}


function combine_nicks(nick1, nick2, mode="compatibility") {
	if (mode == "compatibility") {
		let nicks = (nick1 + nick2).toLowerCase()
		let sum_unicode = 0;
		for (let i = 0; i < nicks.length; i++) {
			sum_unicode += nicks[i].charCodeAt();
		}
		return sum_unicode % 101;
		
	} else if (mode == "random_symbols"){
		let nicks = (nick1 + nick2).toLowerCase();
		let cons = []
		let vows = [];
		for (let i = 0; i < nicks.length; i++) {
			let sym = nicks[i]
			if (con_letter.includes(sym.toUpperCase()) && !cons.includes(sym)) {
				cons.push(sym)
				
			} else if (vow_letter.includes(sym.toUpperCase()) && !vows.includes(sym)) {
				vows.push(sym)
			}
			
		}
		return generate_nick(vows, cons)

		
	} else if (mode == "gen") {
		let significance_symbols = "-+=_~QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnmЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮЁйцукенгшщзхъфывапролджэячсмитьбюё0123456789".split("").sort(() => Math.random() - 0.5)
		let new_nick = "";
		let min_len_nick = Math.min(nick1.length, nick2.length)
		for (let i = 0; i < min_len_nick; i++) {
			let [sym1, sym2] = [nick1[i], nick2[i]]
			if (significance_symbols.indexOf(sym1) < significance_symbols.indexOf(sym2)) {
				new_nick += sym1
			} else {
				new_nick += sym2
			}
			
		}
		if (nick1.length > nick2.length) {
			new_nick += nick1.slice(nick2.length)
		} else {
			new_nick += nick2.slice(nick1.length)
		}
		return new_nick.toLowerCase();
	}
}

function get_players_on_loc() {
	let players = Object.keys(bot.players)
	let players_on_loc = players.filter((nick) => {
		return bot.players[nick] && bot.players[nick].entity !== undefined
	})
	return players_on_loc
}


function get_distance_to_players(start_point=bot.entity.position, ignore_bot=true) {

	let players = Object.entries(bot.players)
	let players_and_distances = players.map(([nick, info]) => {
		let username = info.username;
		let entity = info.entity;
		if (username.match(reg_nickname) && entity && (!ignore_bot || username != bot_username)) {
			let distance = Number(start_point.distanceTo(entity.position).toFixed(2));
			
			return [username, distance];
		}
	})
	players_and_distances = players_and_distances.filter((value) => value !== undefined)
	players_and_distances = players_and_distances.sort((player1, player2) => player1[1] - player2[1])
	return players_and_distances
}

function random_number (min_num, max_num) {
	return Math.floor(Math.random() * (max_num - min_num + 1)) + min_num;
}


function random_choice(array) {
	return array[Math.floor(Math.random() * array.length)]
}

function check_update_stats() {
	let players_stats_entries = Object.entries(players_stats)
	players_stats.forEach(elem => {
		nick, stats = elem;                                                                              
		let donate = stats["donate"]
		let rank = stats["rank"]
		if (rank != Object.keys(ranks).length && donate >= price_donate[rank]) {
			update_stats(nick, "rank", rank+1)
			console.log(`Ранк обновлён у ${nick}: ${rank} -> ${rank+1}`)
		}
	})
}

function check_loc_bot() {
	let tablist = bot.tablist.header.text.split("\n")
	if (tablist.length >= 3) {
		let new_location_bot = tablist[2].split("» §b§l")[1].split(" §e§l«")[0];
		if (new_location_bot != location_bot) {
			if (location_bot) { 
				console.log(`Бот переместился с ${location_bot} на ${new_location_bot}`)
				location_bot = new_location_bot;
				if (!SOPN_veriefed_players && new_location_bot == "Классическое выживание [Локация Край]") {
					setTimeout(() => {
						SOPN_veriefed_players = new Set(get_distance_to_players().map((elem) => elem[0]))
						console.log("Первично проверенные:", SOPN_veriefed_players)
					}, 10000)
					
				}
			}
			else {

				console.log(`Бот появился на локации ${new_location_bot}`)
				tg.on('text', async msg => {
					let text = msg.text
					console.log("Сообщение из тг", [text])
					if (text[0] == "/") {
						let cmd = text.split("/")[1].split(" ")[0]
						let args = text.split(" ").slice(1)
						if (cmd == "m" || cmd == "message") {
							answs.unshift(args.join(" "))
							tg.sendMessage(msg.chat.id, "Сообщение отправлено в службу отправки сообщений");
						}
						if (cmd == "c" || cmd == "chat") {
							if (send_msg_tg) {
								send_msg_tg = false;
								tg.sendMessage(msg.chat.id, "Чат выключен");

							} else {
								send_msg_tg = true;
								tg.sendMessage(msg.chat.id, "Чат включён")
							}
						} if (cmd == "cmd") {
							cmds.push(`${args.join(" ")}`)
							tg.sendMessage(msg.chat.id, "Команда отправлена в службу отправки команд");
						} if (cmd == "js") {
							eval(args.join(" "))
							tg.sendMessage(msg.chat.id, "Команда успешно выполнена")

						}
					}
    				else {
    					answs.unshift(text)
    					tg.sendMessage(msg.chat.id, "Сообщение отправлено в службу отправки сообщений");
    				}
				})
			}
	
			location_bot = new_location_bot;		
		}
	}
	else {
		location__bot = tablist.join(" ");
	}
}


function send_answs() {
	if (!location_bot) return;
	if (answs.length > 0) {
		let answ = answs.shift()
		let info;
		let send_in_private_message;
		let send_full_message;
		if (typeof answ == "object") {
			[answ, info] = answ;
			console.log(info)
		}
		console.log("\033[36m" + answ + "\033[0m")
		answ = answ.replaceAll("\n", " ").replaceAll("\t", " ")
		if (answ[0] == "/") {
			answ = answ.replace("/", "\\")
		}

        if (info) {
        	let alias;
        	var sender = info["sender"]
            send_in_private_message = info["send_in_private_message"]
            send_full_message = info["send_full_message"]
            if (get_stats(sender)) {
            	alias = get_stats(sender, "name")
            }
		    if (!alias) {
			    alias = sender;
		    }


						    
		    answ = `${alias}, ${answ}`

        }
		add_msg_to_bd(nickname=bot_username, type_chat = 'Скрипт', message=answ)
		console.log(`${sender}'у: ${answ}`, send_full_message)
		if (send_in_private_message) {

			
				if (bot_bal_survings >= 0.01 && bot.players[sender] && bot.players[sender].entity !== undefined) {
					send_pay(sender, 0.01, answ)

				} else {
				
					bot.chat(`/m ${sender} ${answ}`.slice(0, 255))
					
				}
			

		} else if (answ.length >= 255) {

			bot.chat(`[СБС]${answ}`.slice(0, 255))

		} else {
			bot.chat(answ)
		}
	}
}

function send_cmds() {
	if (!location_bot) return;
	if (cmds.length > 0) {
		let cmd = cmds.shift()
		if (!ignore_cmds.includes(cmd.split(" ").slice(0, 3).join(" "))) {
			console.log("\033[36m" + cmd + "\033[0m")
			add_msg_to_bd(nickname=bot_username, type_chat = 'Скрипт', message=cmd)
		}
		bot.chat(cmd)
	}
}

function readWrite(file_path, new_value=undefined, save_old_data=true) {
    var data = fs.readFileSync(file_path, 'utf-8');
	if (save_old_data){
		new_value = data + new_value + "\n"
	}
	else {
		if (new_value != "") {
			new_value = new_value + "\n"
		}
	}
	if (new_value ||  new_value == "") {
		fs.writeFileSync(file_path, new_value, 'utf-8');
	}
	return data
}

async function translateText(text, toLang="ru", fromLang="auto") {
  try {
    const translated = await translate(text, {
      tld: "com",
      to: toLang,
      from: fromLang
    });
    return translated;
  } catch (error) {
    console.error('Error translating text:', error);
    throw error;
  }
}


port_keyboard_event = config_settings.get("VARIABLES", "port_keyboard_event")
const io = require("socket.io-client");
const socket = io(`http://localhost:${port_keyboard_event}`);
var date_last_pressed_key = new Date().getTime();
var seniors_afk = false;
var users_send_msg_tg = []

var seniors_online = false;

var location_bot;

var ranks = {1: "Подопытный", 2: "Стажёр", 3: "Исследователь", 4: "Учёный", 5: "Безумный учёный"}

var tesla_ranks = [undefined, "Рядовой", "Ефрейтор", "Мл. Сержант", "Сержант", "Ст. Сержант", "Прапорщик",
					"Ст. Прапорщик", "Лейтенант", "Ст. Лейтенант", "Капитан", "Майор",
					"Подполковник", "Полковник", "Генерал", "Маршал", "Император"]

// Буквы для генерации ников
vow_letter = "AEIOUY1"
con_letter = "BCDFGHJKLMNPQRSTVWXYZ"
vow_letter_ru = "АЕЁИОУЫЭЮЯ"
con_letter_ru = "БВГДЖЗЙКЛМНПРСТФХЦЧШЩ"

var quotes_rep = JSON.parse(config_info.get("permanent_memory", "quotes_rep"))
var quotes = db_quotes.prepare(`SELECT ID, citation, author, rating FROM quotes WHERE status = 1`).all()
var sum_ratings_quotes = db_quotes.prepare(`SELECT sum(rating) FROM quotes WHERE rating > 0`).all()[0]['sum(rating)']
var range_start = 0
var rating_quotes = {}
quotes.map((elem) => {
	if (rating_quotes[elem.author]) {
		rating_quotes[elem.author] += elem.rating - 5
	} else {
		rating_quotes[elem.author] = elem.rating - 5
	}
	if (elem.rating < 0) {
		elem.rating = 0
	}
	elem.range_start = range_start
	range_start += elem.rating
})
var last_quotes_ID = undefined



var players_stats = {}
let all_elements = db.prepare(`SELECT * FROM stats`).all();
all_elements.forEach(elem => players_stats[elem.nickname] = {"rank": elem.rank, "messages": elem.messages, "cmds": elem.cmds,
															"donate": elem.donate, "casino": elem.casino, "name": elem.name, 
															"credit": elem.name, "warns": elem.warns, 
															"rating_quotes": rating_quotes[elem.nickname],
															 "echo": elem.echo, "twinks": JSON.parse(elem.twinks)})

var wait_add_twink = {}

var last_payers_TCA = db.prepare(`SELECT * FROM money WHERE payee == '${bot_username}' AND currency == 'TCA' ORDER BY id DESC LIMIT 30`).all();

var bank_users = JSON.parse(config_info.get("secret_info", "bank"))
var bank_info = {}
Object.keys(bank_users).forEach(name_bank => {
	let count_TCA = db.prepare(`SELECT sum(amount) FROM bank WHERE name_bank == '${name_bank}' AND currency == 'TCA'`).all()[0]
	if (!count_TCA) {
		count_TCA = 0;
	} else {
		count_TCA = count_TCA["sum(amount)"]
	}

	let count_survings = db.prepare(`SELECT sum(amount) FROM bank WHERE name_bank == '${name_bank}' AND currency == 'survings'`).all()[0]
	if (!count_survings) {
		count_survings = 0;
	
	} else {
		count_survings = count_survings["sum(amount)"]
	}

	bank_info[name_bank] = {"TCA": count_TCA, "survings": count_survings, "main_password": bank_users[name_bank]["main_password"], "visitor_password": bank_users[name_bank]["visitor_password"]}
})


wait_confirm_cmd = ""
wait_confirm_js = ""
const seniors = ["Herobrin2v", "Rebrin", "Bellona", "Kirabrin", "test_sopn"]
var masters = Object.keys(players_stats)

var answs = []
var cmds = []

const ignore_cmds = ["/tca log", "/tca check", "/bal"]
const ignore_text = ["Лог последних операций с баллами TCA:"]

var cooldown = {"цитата": {"cooldown": 300000, "players": {}}}

var questions = {} 
fs.readFileSync("txt/questions.txt", "utf-8").split("\n").forEach(string => {
	if (!string.includes("|")) return;

	let question = string.split(" |")[0]
	let number = string.split(" |")[1].split(" ")[0]
	let answ = string.split(" |")[1].split(" ").slice(1).join(" ")
	questions[question] = {"answ": answ, "number": number}
})

var anagrams = {}
fs.readFileSync("txt/anagrams.txt", "utf-8").split("\n").forEach(string => {
	if (!string.includes(":")) return;

	let [sorted_symbols, answ] = string.split(":")
	anagrams[sorted_symbols] = answ;
})


var phrases = {}
phrases["кто"] = JSON.parse(config_info.get("phrases", "кто"))
phrases["grief"] = JSON.parse(config_info.get("phrases", "grief"))
phrases["grief_none_player"] = JSON.parse(config_info.get("phrases", "grief_none_player"))
phrases["СОПН"] = JSON.parse(config_info.get("phrases", "СОПН"))
phrases["выбери_повтор"] = JSON.parse(config_info.get("phrases", "выбери_повтор"))
phrases["donate"] = JSON.parse(config_info.get("phrases", "donate"))
phrases["casino_lose"] = JSON.parse(config_info.get("phrases", "casino_lose"))
phrases["casino_win"] = JSON.parse(config_info.get("phrases", "casino_win"))
phrases["casino_win_public"] = JSON.parse(config_info.get("phrases", "casino_win_public"))
phrases["casino_wait_cash"] = JSON.parse(config_info.get("phrases", "casino_wait_cash"))
phrases["warn_use_cmd"] = JSON.parse(config_info.get("phrases", "warn_use_cmd"))

var users_greetings = JSON.parse(config_info.get("rank_privilegies", "greetings"))

queue_waiting_data["casino2"] = JSON.parse(config_info.get("permanent_memory", "casino2"))
Object.keys(queue_waiting_data["casino2"]).forEach((nick) => {
	queue_waiting_data["casino2"][nick]["function"] = casino
})
queue_waiting_data["casino3"] = JSON.parse(config_info.get("permanent_memory", "casino3"))
Object.keys(queue_waiting_data["casino3"]).forEach((nick) => {
	queue_waiting_data["casino3"][nick]["function"] = casino
})

var processed_users = {"greetings": []}
processed_users["greetings"] = JSON.parse(config_info.get("processed_users", "greetings"))

var synonyms_cmd = {}
synonyms_cmd["шанс"] = JSON.parse(config_info.get("synonyms_cmd", "шанс"))

var informed_users = {}
informed_users["grief_alert"] = []
informed_users["выбери"] = JSON.parse(config_info.get("informed_users", "выбери"))
informed_users["nick"] = JSON.parse(config_info.get("informed_users", "nick"))
informed_users["warns"] = []
informed_users["bank"] = {"auth": [], "wrong_data": [], "add": [], "empty_data": []}
informed_users["update"] = JSON.parse(config_info.get("informed_users", "update"))

const price_donate = [0, 40000, 100000, 500000, 1000000]

var players_increased_win = {}

var rank_privilegies = {}
rank_privilegies["casino_max_bet"] = JSON.parse(config_info.get("rank_privilegies", "casino_max_bet"))

const bot_password = config_settings.get(bot_username, "bot_password")
const bot_pin = config_settings.get(bot_username, "bot_pin")
let pin_enter = false;
let password_enter = false;
bot.on('windowOpen', function wnd (window, info) {
	let title = window.title
	let slots = window.slots
	if (title == '"§4§l§nВведите Ваш пин-пароль"' && !pin_enter && !location_bot) {
		bot.chat(bot_pin)
		pin_enter = true;
		console.log("Пин-код введён")
	}
	console.log(`Окно открылось ${title}`)
})

var test;

socket.on('key_event', (data) => {
	//console.log(data)
	date_last_pressed_key = new Date().getTime()
	
	if (data.type_device == "keyboard") {
		let key = data.key
		let action = data.type_click == "down"

		if (action) {
			if (wait_confirm_js) {
				if (key == "+") {
					try {
						eval(wait_confirm_js)
						console.log("Выполнено:", wait_confirm_js)

					} catch(err) {
						console.log(err)
					}
					wait_confirm_js = ""
					console.log("Команда выполнена")

				} else if (key == "-") {
					wait_confirm_js = ""
					console.log("Команда отклонена")
				}
				
			}

			if (wait_confirm_cmd) {
				if (key == "1") {
					try {
						bot.chat(wait_confirm_cmd)
						add_msg_to_bd(nickname=bot_username, type_chat="Скрипт", message = message)
						

					} catch(err) {
						console.log(err)
					}
					wait_confirm_cmd = ""
					console.log("Сообщение отправлено")

				} else if (key == "0") {
					wait_confirm_cmd = ""
					console.log("Сообщение отклонено")
				}
				
			}

			if (controllers["ручуп"]["controller_name"]) {
				let direction_move = key_to_direction[key.toLowerCase()]

				if (direction_move) {
					bot.setControlState(direction_move, action)
				} else if (key == "") {

				}
			}

		} else {
			if (controllers["ручуп"]["controller_name"]) {
				let direction_move = key_to_direction[key.toLowerCase()]

				if (direction_move) {
					bot.setControlState(direction_move, action)
				}
			}
		}

	} else if (data.type_device == "mouse") {
		let is_scroll = data.is_scroll
		let is_move = data.is_move

		if (is_move)  {
			if (controllers["ручуп"]["controller_name"]) {
				const sensitivity = 0.1;
				let delta_x = data.delta_x / 25
				let delta_y = data.delta_y / 50
				let yaw = bot.entity.yaw - delta_x * sensitivity;
				let pitch = bot.entity.pitch - delta_y * sensitivity;
				
				if (delta_x > 15 || delta_y > 8 || delta_y < -8 || delta_x < -15) return;
				// yaw += delta_x * sensitivity;
  				// pitch -= delta_y * sensitivity;
  				pitch = Math.max(-2, Math.min(2, pitch));
  				//yaw = Math.max(-1, Math.min(6.3, yaw))
  				//console.log("yaw", yaw, delta_x)
  				//console.log("pitch", pitch, delta_y)
  				bot.look(yaw, pitch, true);
  			}

		//	console.log(delta_x, delta_y)
		}
		else if (is_scroll) {
			let pos = data.pos
			let direction = data.direction.y

			if (controllers["ручуп"]["controller_name"]) {
				let cur_slot = bot.quickBarSlot
				let new_slot = cur_slot - direction

				if (new_slot < 0) {
					new_slot = 8

				} else if (new_slot > 8) {
					new_slot = 0
				}

				bot.setQuickBarSlot(new_slot)
			}

		} else {
			let button = data.button
			let pos_cursor = data.position
			let is_pressed = data.is_pressed
			if (controllers["ручуп"]["controller_name"]) {
				if (button == "1") {
					if (is_pressed) {
						bot.swingArm('right')
					}
				} 
				if (button == "3") {
					if (is_pressed) {
						bot.activateItem()
					} else {
						bot.deactivateItem()
					}
				}
			}
			//console.log(data)
		}
	}
	
	

});

bot.on('resourcePack', () => {
	bot.denyResourcePack()
	console.log("РесурсПак отклонён")
	
})

fs.watchFile("txt/cmd.txt", (curr, prev) => {
  console.log("Файл изменился");
  if (curr.mtime > prev.mtime && timer_check_cmds < new Date().getTime()) {
    timer_check_cmds = new Date().getTime() + 100;
    let cmd = fs.readFileSync("txt/cmd.txt", "utf-8").replace("\n", "");
    if (cmd !== "") {
      console.log("Команда из текстового файла: ", [cmd]);
      bot.chat(cmd);
    }
  }
});

bot.on('end', function kicked(reason) {
	console.log("Закончил " + reason)
	console.log(1)
	process.exit(-1);
})

bot.on('entitySpawn', (entity) => {
	let nick = entity.username;
	if (entity.displayName == "Thrown egg") {


		let egg_id = entity.id;
		//console.log("egg id", egg_id)
		if (egg_id % 100 == 0) {
			let players_and_distances = get_distance_to_players(start_point=entity.position)
			if (players_and_distances.length == 0) return; 
			let [nick, distance] = players_and_distances[0];
			send_pay(nick, 10, reason=`Вы кинули ${egg_id}-е яйцо! Поздравляю!`)
		}
	} else if (entity.type == "player" && seniors.includes(entity.username)){
		console.log("Появился", entity.username)
		seniors_online = true;
	}

})

bot.on('entityGone', (entity) => {
	if (entity.type == "player" && seniors.includes(entity.username)) {
		console.log("Пропал", entity.username)
		seniors_online = false;
	}
})

bot.on('entityUpdate', (entity) => {
    if (entity.type === 'player' && entity.metadata[6] && entity.metadata[6].value === 57) {
      const playerName = entity.username;
      const item = bot.registry.itemsByName[entity.metadata[7].value];
      if (item) {
        console.log(`${playerName} ест ${item.name}`);
      } else {
        console.log(`${playerName} ест неизвестный предмет`);
      }
    }
  });

bot.on("blockUpdate" , function blocks (oldBlock, newBlock) {
	if (["flowing_water", "flowing_lava"].includes(oldBlock.name) || ["flowing_water", "flowing_lava"].includes(newBlock.name)) return;
	if (oldBlock.name == "air" || newBlock.name == "air") {
		if (oldBlock.name == newBlock.name) return;
		var block_position = oldBlock.position;
		var nearby_players = get_distance_to_players(start_point=block_position);
		if (typeof nearby_players == "object") {
			let criminal_nick, distance;
			for (let i = 0; i < nearby_players.length; i++) {
				[criminal_nick, distance] = nearby_players[i];
				if (bot.players[criminal_nick] && bot.players[criminal_nick].entity &&  
					(bot.players[criminal_nick].entity.equipment[0] && bot.players[criminal_nick].entity.equipment[0].name == "bed" ||
					 bot.players[criminal_nick].entity.equipment[1] && bot.players[criminal_nick].entity.equipment[1].name == "bed")) {
					break;
				
				} else {
					criminal_nick = undefined;
					distance = undefined;
				}
			}

			
			if (!distance || distance > 6) {
				criminal_nick = undefined;
			}
			if (oldBlock.name == "air") {
				var block_name = newBlock.name;
				var type_action = "Установка";
				if (block_name == "bed") {
					if (last_placed_bed.nick == criminal_nick && (new Date().getTime() - last_placed_bed.time)  < 1000)  return;
					console.log(new Date().getTime() - last_placed_bed.time);
					last_placed_bed = {"nick": criminal_nick, "time": new Date().getTime()}
					console.log(block_position, criminal_nick)
					let [x, y, z] = [block_position.x, block_position.y, block_position.z];
					if ( (!players_stats[criminal_nick] || players_stats[criminal_nick]["rank"] < 2) && (timer_send_alert_grief < new Date().getTime() ||
					 (last_nick_place_bed && criminal_nick && last_nick_place_bed != criminal_nick && timer_send_alert_grief - 120000 < new Date().getTime()))) {
						timer_send_alert_grief = new Date().getTime() + 240000;
						if (criminal_nick) {
							if (!players_stats[criminal_nick] && !informed_users["grief_alert"].includes(criminal_nick)) {
								informed_users["grief_alert"].push(criminal_nick)
								answs.push(["Если Вы используете кровати для разрушения, то имейте в виду: 1) Гриферство в Эндер-мире наказуемо баном. 2)В каждую постройку была вложена частичка души такого же человека, как и Вы. Сообщение сгенерировано автоматически.",
								 {"sender": criminal_nick, "send_in_private_message": true}])
							}
							last_nick_place_bed = criminal_nick;
							var answ = `[САГО] ${criminal_nick}(${x}, ${y}, ${z}), ${random_choice(phrases["grief"])}`;
						} else {
							var answ = `[САГО] (${x}, ${y}, ${z}). ${random_choice(phrases["grief_none_player"])}`;
						}
						answs.unshift(answ)
					}
					
					add_block_to_bd(nickname = criminal_nick, type_action=type_action, block_name=block_name, position=block_position)
				}
				
			} else if (newBlock.name == "air") {

				var block_name = oldBlock.name;
				if (block_name == "bed") {
					if (last_destroyed_bed.nick == criminal_nick && (new Date().getTime() - last_destroyed_bed.time)  < 1000)  return;
					last_destroyed_bed = {"nick": criminal_nick, "time": new Date().getTime()}
				}
				
				var type_action = "Разрушение";
			}
		
		}

	}
})



bot.on('messagestr', function msg (message, sender) {
	if (!message || !sender) return;
	if (sender == "chat") {
		const original_message = message;
		var send_in_private_message = false;
		let private_message = message.match(reg_me_send);
		if (private_message) {
			sender = private_message[1]
			message = private_message[2]
			var type_chat = "Приват";

		} else {
			var type_chat = message.split("]")[0].split("[")[1]
			sender = message.split(":")[0].split(" ").at(-1)
			message = message.split(":").slice(1).join(":")
			console.log("type_chat", type_chat)
			if (type_chat != "Пати-чат" && type_chat != "Лк" && type_chat != "Гл") {
				type_chat = undefined;
			}
			
		}
		if (!message || !sender) return;
		message = message.replace(/[c|C][m|M][d|D]/, "cmd")

		add_msg_to_bd(nickname=sender, type_chat=type_chat, message=message)
		if (send_msg_tg || message.toLowerCase().includes("брин") || message.toLowerCase().includes("brin")) {
			console.log("Сообщение отправлено")
			tg.sendMessage(tg_channel_id, `[${type_chat}] ${original_message}`);
			if (seniors_afk && !users_send_msg_tg.includes(sender) && (message.toLowerCase().includes("брин") || message.toLowerCase().includes("brin"))) {
				users_send_msg_tg.push(sender)
				send_pay(sender, 0.01, `Брин сейчас афк или его нет на сервере. Я его бот. Хотите я свяжу Вас с ним? Ответьте, написав 'да' мне(${bot_username}) в личные сообщения`)
				queue_waiting_data["private_message"][sender] = function f_name(nick, message)  {
					console.log("Принятое сообщение", [message])
					if (["да", "оk", "oк", "хорошо"].includes(message.toLowerCase())) {
						send_pay(nick, 0.01, "Хорошо. Напишите так же мне в лс сообщение, которое я отправлю хозяину в телеграм. Будьте внимательны, т.к. у Вас будет лишь одна попытка на отправку сообщения.")
						queue_waiting_data["private_message"][nick] = (nick, message) => {
							tg.sendMessage(tg_channel_id, `[REQUEST] ${nick}: ${message}`)
							send_pay(nick, 0.01, "Ваше сообщение успешно отправлено! Ожидайте ответ.")
						}
					}
				}
				
				return;

			}
		}

		console.log(`[${type_chat}]` + "\033[32m " + sender + ":\033[33m" + message + "\033[0m")

		let rank_sender = get_stats(sender, "rank")

		let spec_symbols = "";
		if (message.includes("cmd")) {
			spec_symbols = message.split("cmd")[0].split(" ").at(-1).toLowerCase()
		}
		console.log("СЕНД", spec_symbols.includes("all"), rank_sender, rank_sender >= 2)
		let send_full_message = false;
		if (spec_symbols.includes("all")) {
			if (rank_sender && rank_sender >= 2) {
				console.log("Сенд фул изменён")
				send_full_message = true;
			}
		}

		let real_sender = sender;

		if (spec_symbols.includes("<")) {
			if (seniors.includes(sender)) {
				real_sender = message.split("cmd")[0].split(" ").at(-2);
				sender = real_sender
                if (!Object.keys(players_stats).includes(sender)) {
                	console.log("Такого игрока нет:", sender)
                    return;
                }

            }
		}


		if (spec_symbols.includes("^")) {
			send_in_private_message = true;
		}

		if (seniors.includes(real_sender)) {
			if (spec_symbols.includes("*")) {
				send_in_private_message = false;
			} 
		}

		if (get_stats(sender) || seniors.includes(sender))  {
			if (sender == bot_username) return;

			update_stats(sender, "messages", 1, "add")

			if (message.toLowerCase().includes("cmd ")) {

				
				var answ;
				let spec_symbol;
				

				let warns = get_stats(sender, "warns")
				if (warns >= 5 && !informed_users["warns"].includes(sender)) {
					answs.push([`Вы достигли слишком большого количества предупреждений(${warns}), поэтому права на бота заблокированы. За снятие каждого варна переведите мне 10к сурвингов`, {"sender": sender, "send_in_private_message": true}])
					informed_users["warns"].push(sender)
					return;
				}

				update_stats(sender, "cmds", 1, "add")

				message = message.split("cmd ")[1]
				console.log("Spec", spec_symbols)
				message = message.split(" ")
				let cmd = message[0].toLowerCase()
				let args = message.slice(1)
				console.log(`cmd ${cmd} args ${args}`)
				
				if (cmd == "help") {
					if (args[0] == "help") {
						answ = "Возможные аргументы: [номер страницы]**"
					}
					else {
						let num_page;
						if (args.length > 0) {
							num_page = Number(args[0])
						}
						if (!num_page) {
							num_page = 1;
						}
						let help = {"help": "Показывает информация о всех командах и доп. инфу", "реши": "Решит любой пример", "bank": "Можно открыть 1 счёт на несколько аккаунтов", "word": "Легендарная игра 'wordle'", "цитата": "Великие цитаты обычных игроков", "greet": "Установить Приветствие", "warn": "Информация о системе предупреждений", "ручуп3": "Управление с помощью шерсти", "зырь": "Будет пилить взглядом", "gpt": "Искуственный интеллект. Ответит на любой вопрос", "шанс": "Показывает вероятность события", 
									"скрести": "Показывает совместимость людей и возможное имя их ребёнка", "casino": "Казино, в котором можно как выиграть, так и програть миллионы!",
									"nick": "Меняет ник в боте", "near": "Покажет ники ближайших игроков и расстояние до них",
									"кто": "Выбирает подходящего под описание игрока", "stats": "Показывает статистику игроков в боте",
									"выбери": "Выбирает подходящий вариант из нескольких предложенных",
									"Доп. инфа": "У каждой команды есть 'help'."}
						answ = top_split_into_pages(Object.entries(help), nums_in_page=3, num_page=num_page, "Информация о командах: ")
						send_in_private_message = true;
					}

				} else if (cmd == "echo") {
					if (true) {
						send_in_private_message = true;
						answ = "В разработке. Разработчик очень хотел спать"
					}
				} else if (cmd == "реши") {
					if (args.length == 0 || args[0] == "help") {
						send_in_private_message = true;
						answ = "Возможные аргументы: [Пример любой длины и сложности]"

					} else {
						let expression = args.join(" ")
						let info = calculate(expression)
						if (info["is_ok"]) {
							answ = `${expression} = ${info["result"]}`
						} else {
							send_in_private_message = true;
							answ = `Возникла ошибка: ${info["message_error"]}`
						}
					}

				} else if (cmd == "bank") {
					if (args.length == 0 || args[0] == "help") {
						send_in_private_message = true;
						answ = "Возможные аргументы: [auth, создать, снять, пополнить, баланс, logout]"

					} else if (args[0] == "создать") {
						let name_bank = args[1]
						let main_password = args[2]
						let visitor_password = args[3]

						send_in_private_message = true;

						if (name_bank) {
							name_bank = name_bank.toLowerCase()
							if (!bank_users[name_bank]) {
								if (main_password) {
									main_password = main_password.toLowerCase()
									if (visitor_password) {
										visitor_password = visitor_password.toLowerCase()
										bank_users[name_bank] = {"main_password": main_password, "visitor_password": visitor_password}
										bank_info[name_bank] = {"TCA": 0, "survings": 0, "main_password": main_password, "visitor_password": visitor_password}
										update_config("secret_info", "bank", bank_users)
										answ = `Счёт с названием ${name_bank} успешно создан. Для взаимодействия с ним авторизуйтесь: сmd bank auth [название_счёта] [пароль]`
									
									} else {
										answ = "Вы не указали пароль от гостевого режима, в котором пользователи могут пополнять счёт"

									}

								} else {
									answ = "Вы не указали пароль, который будет использоваться для получения доступа к счёту"
								}

							} else {
								answ = "Счёт с таким именем уже существует, придумайте другое"
							}
						
						} else {
							answ = "Верный синтаксис: создать [название счёта] [пароль от счёта] [пароль от гостевого режима]"

						}

					} else {
						bank_processing(sender, args[0], args.slice(1))
					}
					

				} else if (cmd == "цитата") {
					if (args[0] == "help") {
						send_in_private_message = true;
						answ = "Возможные аргументы: [add(предложить цитату), by(цитата определённого игрока), id(цитата с определённым айди), rep(поставить оценку цитате)]. Все цитаты предлагаются самими игроками."

					} else {
						if (args[0] == "add" || args[0] == "предложить") {
							console.log("цитата add", args)
							if (args[1]) {
								let quote = args.slice(1).join(" ")
								console.log("Предложенная цитата:", quote)

								let data = fs.readFileSync("txt/offer_quotes.txt", 'utf-8');
								let new_value = data + `${quote} (C) ${sender}` + "\n\n"
								fs.writeFileSync("txt/offer_quotes.txt", new_value, 'utf-8');
								
								send_in_private_message = true;
								answ = "Ваша цитата отправлена на проверку!"
							
							} else {
								send_in_private_message = true;
								answ = "Верный синтаксис: add [Ваша личная цитата цензурного содержания]"

							} 

						} else if (args[0] == "rep") {
							if (args.length == 1 || args[1] == "help") {
								send_in_private_message = true;
								answ = "Возможные аргументы: [id цитаты] [+(повысить рейтинг), -(понизить рейтинг), del(отменить голос)]. Пример: цитата rep 39 +. Рейтинг влияет на частоту появления цитаты в общем чате"
							
							} else if (Number(args[1])) {
								send_in_private_message = true;
								let ID = Number(args[1])
								if (ID && ID >= 1 && ID <= quotes.length) {
									if (args[2] == "+" || args[2] == "-") {
										if (!quotes_rep[sender] || !quotes_rep[sender][ID]) {
											let quote_info = quotes[ID-1]
											let author;
											if (quote_info) {
												author = quote_info["author"]
											}
											if (author && author != sender) {
												let add_rep = 1;
												if (rank_sender >= 2 && rank_sender <= 4) {
													add_rep = 2
												} else if (rank_sender > 4) {
													add_rep = 3;
												}
												if (args[2] == "-") {
													add_rep = -add_rep
												}

												if (quotes_rep[sender]) {
													quotes_rep[sender][ID] = add_rep
												} else {
													quotes_rep[sender] = {ID: add_rep}
												}
												if (players_stats[author]) {
													if (players_stats[author]["rating_quotes"]) {
														players_stats[author]["rating_quotes"] += add_rep
													} else {
														players_stats[author]["rating_quotes"] = add_rep
													}
												}
												update_rating_quotes(ID, add_rep)
												update_logs_quotes(ID, sender, add_rep)

												send_in_private_message = true;
												answ = "Рейтинг успешно изменён"
											
											} else {
												send_in_private_message = true;
												answ = "Вы не можете поставить рейтинг самому себе"
											}

										} else {
											answ = "Вы уже оставили свой голос для этой цитаты. Выберите другую или отмените голос для этой с помощью сmd цитата rep [ID] del"
										}
									} else if (args[2] == "del") {		
										if (quotes_rep[sender] && quotes_rep[sender][ID]) {
											let add_rep = - quotes_rep[sender][ID]
											delete(quotes_rep[sender][ID])
											let quote_info = quotes[ID-1]
											let author;
											if (quote_info) {
												author = quote_info["author"]
											}
											if (author && players_stats[author]) {
												if (players_stats[author]["rating_quotes"]) {
													players_stats[author]["rating_quotes"] += add_rep

												}
											}
											update_rating_quotes(ID, add_rep)
											update_logs_quotes(ID, sender, add_rep)		

											send_in_private_message = true;
											answ = "Голос успешно удалён"
										} else {
											send_in_private_message = true;
											answ = "Вы ещё не поставили оценку этой цитате"
										}
									} else {
										answ = "Вы должны указать, что вы хотите сделать с рейтингом выбранной цитаты. Повысить(+),  понизить(-) или отменить голос(del)"
									}
								} else {
									answ = "Цитаты с данным айди не существует"
								}
								
							}

						} else if (args[0] == "by") {
							let cooldown_info = cooldown_processing(sender, cmd)
							let cooldown_end = cooldown_info["is_ok"]

							if (cooldown_end) {
								let author = args[1]
								if (author) {
									
									let quotes_by_author = get_quotes_from_author(author)
									if (quotes_by_author.length > 0) {
										let quote_info = random_choice(quotes_by_author)
										let ID = quote_info["ID"]
										let author = quote_info["author"]

										let info = send_quote(ID)
										send_in_private_message = true;
										answ = `Цитата игрока ${author} с id ${ID} была отправлена!`

									} else {
										send_in_private_message = true;
										answ = "Цитат данного автора не было найдено"
									}

								} else {
									send_in_private_message = true;
									answ = "Верный синтаксис: by [ник игрока, чью цитату хотелось бы прочитать]"
								}

							} else {
								let message_error = cooldown_info["message_error"]
								send_in_private_message = true;
								answ = message_error;
							}

						} else if (args[0] == "id") {
							let cooldown_info = cooldown_processing(sender, cmd)
							let cooldown_end = cooldown_info["is_ok"]
							if (cooldown_end) {

								let ID = Number(args[1])
								if (ID) {
									let info = send_quote(ID)

									send_in_private_message = true;
									if (info["is_ok"]) {
										let author = info["author"]
										answ = `Цитата игрока ${author} с id ${ID} была отправлена!`
									} else {
										answ = info["message_error"]
									}

								} else {
									send_in_private_message = true;
									answ = "Верный синтаксис: id [айди цитаты]"
								}

							} else {
								let message_error = cooldown_info["message_error"]
								send_in_private_message = true;
								answ = message_error;
							}

						} else {
							let cooldown_info = cooldown_processing(sender, cmd)
							let cooldown_end = cooldown_info["is_ok"]
							if (cooldown_end) {

								let quote_info = send_random_quote()
								let author = quote_info["author"]
								let ID = quote_info["ID"]

								send_in_private_message = true;
								answ = `Цитата игрока ${author} с id ${ID} была отправлена!`

							} else {
								let message_error = cooldown_info["message_error"]
								send_in_private_message = true;
								answ = message_error;
							}
						}

					}

				} else if (cmd == "greet" || cmd == "greeting") {
					if (args.length == 0 || args[0] == "help") {
						send_in_private_message = true;
						answ = "Возможные аргументы: [on, off, edit]. Приветствие будет активироваться каждый раз после перезапуска бота, как только он увидит Вас"
					} else {
						if (rank_sender >= 3) {
							if (args[0] == "edit") {
								if (args[1]) {
									let template_greet = args.slice(1).join(" ").replaceAll('"', "'")
									if (!Object.keys(users_greetings).includes(sender)) {
										users_greetings[sender] = {}
									}
									users_greetings[sender]["text"] = template_greet;

									send_in_private_message = true;
									answ = `Приветствие успешно изменено на: '${template_greet}'`

									update_config("rank_privilegies", "greetings", users_greetings)		

								} else {
									send_in_private_message = true;
									answ = "Вы не ввели шаблон приветствия"
								}

							} else if (args[0] == "on") {
								send_in_private_message = true;

								let template_greet;
								if (args[1]) {
									template_greet = args.slice(1).join(" ").replaceAll('"', "'")
								}

								if (Object.keys(users_greetings).includes(sender)) {
									if (!template_greet) {
										template_greet = users_greetings[sender]["text"]
									}

								} else {
									users_greetings[sender] = {}
									if (!template_greet) {
										template_greet = `Привет, ${sender}`
									}
								}
								users_greetings[sender]["text"] = template_greet;
								users_greetings[sender]["on"] = true;

								answ = `Приветствие включено! Текущий шаблон приветствия: '${template_greet}'`

								update_config("rank_privilegies", "greetings", users_greetings)
	
							} else if (args[0] == "off") {
								users_greetings[sender]["on"] = false;
								send_in_private_message = true;
								answ = "Приветствие выключено"

								update_config("rank_privilegies", "greetings", users_greetings)
							}

						} else {
							send_in_private_message = true;
							answ = "Минимальное звание для использования этой команды - Исследователь"
						}
					}

				} else if (cmd == "word") {
					if (args.length == 0 || args[0] == "help") {
						send_in_private_message = true;
						answ = "Возможные аргументы: [invite, info]"
					
					} else if (args[0] == "info") {
						let num_page = Number(args[1])
						if (!num_page) {
							num_page = 1;
						}
						send_in_private_message = true;
						let info = "Цель игры: угадать загаданное слово из пяти. На это даётся 6 попыток. После каждой попытки возвращается обработанное по следующему алгоритму слово: каждая буква, которая "+
						"есть в загаданном слове на той же позиции, становится заглавной. Каждая буква, которая есть в загаданном слове, но на позиции, отличной от позиции этой буквы в введённом слове, "+
						"остаётся прописной. Если буквы нет в слове - она заменяется на *"

						answ = text_split_into_pages(info, max_len=undefined, num_page=num_page)
						if (!answ) {
							answ = "Такой страницы не существует"
						} 
						

					} else if (args[0] == "invite") {
						if (args.length == 1 || args[1] == "help") {
							send_in_private_message = true;
							answ = "Возможные аргументы: [ник игрока] [слово из пяти букв]"

						} else {
							let nick = args[1]
							let word = args[2]
							if (nick && nick.match(reg_nickname)) {
								if (word) {
									if (word.length == 5) {
										send_in_private_message = true;
										answ = "Приглашение отправлено"
		
										waiting_start_game["wordle"][nick] = (nick, message) => {
											if (["0k", "ok", "oк", "ок", "да", "хорошо", "согласен", "подтвердить"].includes(message.toLowerCase())) {
												games["wordle"][nick] = {"opponent": sender, "word": word, "attempts": 0, "history": ""}
												answ = "Замечательно! Для продолжения игры отправляйте мне в лс слова из 5 букв, которые мог бы загадать Ваш оппонент"
												answs.push([answ, {"sender": nick, "send_in_private_message": true}])
												answs.push([`${nick} принял приглашение!`, {"sender": sender, "send_in_private_message": true}])
											}
										}
										answs.push([`Игрок ${sender} приглашает Вас сыграть в игру wordle. Хотите ли Вы сыграть?`, {"sender": nick, "send_in_private_message": true}])

									} else {
										send_in_private_message =  true;
										answ = "Слово должно состоять ровно из 5-ти букв!"
									}

								} else {
									send_in_private_message = true;
									answ = "Вы не указали загаданное слово. Верный синтаксис: invite [ник игрока, с которым хотите сыграть] [загаданное слово]"
								}

							} else {
								send_in_private_message = true;
								answ = "Вы не указали ник. Верный синтаксис: invite [ник игрока, с которым хотите сыграть] [загаданное слово]"
							}
						}

					} 

				} else if (cmd == "twink") {
					if (args.length == 0 || args[0] == "help") {
						send_in_private_message = true;
						answ = "Возможные аргументы: [info - более подробная информация о системе твикнво; list - список твинков; add - добавить твинк; remove - удалить твинк]"
			
					} else if (args[0] == "info") {
						let num_page = Number(args[1])
						if (!num_page) {
							num_page = 1;
						}
						send_in_private_message = true;
						let info = "Со всех добавленных твинков можно будет пользоваться ботом, будто Вы играете с основного аккаунта. Для этого перед каждой командой нужно будет ставить символ '<'. " +
						"Пример: '<сmd help'. Вся статистика добавляется на основной аккаунт. Для добавления твинка нужно будет с этого твинка подтвердить добавление"

						answ = text_split_into_pages(info, max_len=undefined, num_page=num_page)
						if (!answ) {
							answ = "Такой страницы не существует"
						} 

					} else if (args[0] == "list") {
						send_in_private_message = true;
						let twinks = get_stats(sender, "twinks")
						if (twinks.length > 0) {
							twink = twinks.join(", ")
							answ = `Ваши твинки: ${twinks}`
						
						} else {
							answ = "У Вас нет твинков"

						}

					} else if (args[0] == "add") {
						if (args.length == 1 || args[1] == "help") {

						} else {
							send_in_private_message = true;
							let nick = args[1]
							if (nick.match(reg_nickname)) {
								if (!players_stats[nick]) {
									wait_add_twink[nick] = sender;
									answ = `Запрос на привязку твинка создан. Для продолжения с указанного твинка напишите команду: 'сmd twink ${sender}'[ник укажите в верном регистре, как и должен писаться Ваш ник]`
								
								} else {
									answ = "Игрок уже есть в ВайтЛисте как основной аккаунт"

								}

							} else {
								answ = "Это не похоже на ник"
							}
						}

					} else if (args[0] == "remove") {
						answ = "Отвязка твинков пока не реализована, сейчас это делается вручную через разработчика бота"
					}

				} else if (cmd == "warn") {
					if (args.length == 0 || args[0] == "help") {
						send_in_private_message = true;
						answ = "Возможные аргументы: [count - кол-во полученных варнов; delete - снятие варнов; info - более подробная информация о варнах]"

					} else if (args[0] == "info") {
						let num_page = Number(args[1])
						if (!num_page) {
							num_page = 1;
						}
						send_in_private_message = true;
						let info = "Снятие каждого варна стоит 10к сурвингов. Если варнов меньше допустимого кол-ва, то снять можно, переведя сурвинги с причиной 'warn'. Если больше, то любой " +
						"перевод(даже в ТСА) будет направлен на снятие варнов, причину в этом случае указывать необязательно. Можно также заплатить за снятие варнов с Вашего внутреннего счёта[в этом случае " +
						"снятие одного варна стоит 20к!]: сmd delete [количество варнов]. Варны созданы для предотвращения неправильного использования бота. Варны выдаются вручную создателем бота. При " +
						"достижении 5 варнов отбирается доступ к боту."
						answ = text_split_into_pages(info, max_len=undefined, num_page=num_page)
						if (!answ) {
							answ = "Такой страницы не существует"
						} 

					} else if (args[0] == "count") {
						send_in_private_message = true;
						let count_warns = get_stats(sender, "warns")
						answ = `Количество Ваших варнов: ${count_warns}`

					} else if (args[0] == "delete") {
						send_in_private_message = true;
						if (args.length == 1 || args[0] == "help") {
							answ = "Возможные аргументы: [количество варнов, которые нужно удалить]. Стоимость удаления одного варна - 20к сурвингов. После написания команды деньги сразу же спишутся, а варны удалятся"
						
						} else {
							let count_del_warns = Number(args[1])
							if (count_del_warns && count_del_warns > 0) {
								let count_warns = get_stats(sender, "warns")
								if (count_del_warns > count_warns) {
									answ = `Вы хотите удалить слишком много варнов. Ваше текущее кол-во предупреждений: ${count_warns}`

								} else {
									let price_del_warns = count_del_warns * 20000
									console.log("price_del_warns", price_del_warns, typeof price_del_warns)
									let bal_sender = get_stats(sender, "donate")
									if (bal_sender >= price_del_warns) {
										update_stats(sender, "donate", -price_del_warns, "add")
										update_stats(sender, "warns", -count_del_warns, "add")
										answ = `Удалено варнов: ${count_del_warns}. Списано с баланса: ${price_del_warns}$. Текущее кол-во варнов: ${count_warns - count_del_warns}`

									} else {
										answ = `У Вас на счету недостаточно средств. Ваш баланс: ${bal_sender}$. Необходимо: ${price_del_warns}$`
									}
								}
							} else {
								answ = "Неверно указано количество варнов"
							}

						}
					} else if (args[0] == "give" && seniors.includes(sender)) { 

						let nick = args[1]
						let count_warns = Number(args[2])
						let reason = args.slice(3).join(" ")
						send_in_private_message = true;

						if (!nick) {
							answ = "Верный синтаксис: [ник игрока] *[количество варнов, которые нужно добавить] *[причина]"
						
						} else {
							if (!count_warns) {
								count_warns = 1;
							}

							if (Object.keys(players_stats).includes(nick)) {
								var past_count_warns = get_stats(nick, "warns")
								update_stats(nick, "warns", count_warns, "add")
							}

							let answ_intruder = `Вам были выданы предупреждения: ${count_warns}. При достижении большого кол-ва варнов будет ограничен доступ к боту. `
							if (reason) {
								answ_intruder += `Причина варна: ${reason}`
							}
							answs.push([answ_intruder, {"sender": nick, "send_in_private_message": true}])
							answ = `Данные успешно изменены. Кол-во варнов у ${nick} ${past_count_warns} -> ${past_count_warns + count_warns}`

						}

					}
				} else if (cmd == "звания") {
					send_in_private_message = true;
					answ = "Звания[цена]: Подопытный[0]; Стажёр[40к]; Исследователь[100к]; Учёный[500к]; Безумный Учёный[1кк]. Узнать задоначенную сумму: cmd stats. Чтобы задонатить - переведите сурвинги/ТСА боту"

				} else if (cmd == "gpt") {
					console.log("GPT")
					if (args.length == 0 || args[0] == "help") {
						send_in_private_message = true;
						answ = "Возможные аргументы: [Ваш промпт(запрос) для искуственного интелекта]"

					} else {
						let needed_rank = check_needed_rank(rank_sender, 2);
						console.log("needed_rank", needed_rank)
						if (needed_rank["is_ok"]) {
							let prompt = args.join(" ")
							console.log(prompt)
							GigaGpt(sender, prompt).then((answ) => answs.push([answ, {"sender": sender, "send_in_private_message": send_in_private_message, "send_full_message": send_full_message}]))
						} else {
							send_in_private_message = true;
							answ = needed_rank["message_error"]
						}
					}


				} else if (cmd == "зырь") {
					if (args[0] == "help") {
						send_in_private_message = true;
						answ = "Возможные аргументы: [Ник игрока, за которым начнётся слежка. По умолчанию это Ваш ник]*"
					} else {
						let nickname = args[0]
						if (!nickname) {
							nickname = sender;
						}
						if (rank_sender >= 2) {
							delay = 100;
						} else {
							delay = 1000;
						}
						let last_controller = controllers["зырь"]["controller_name"]
						send_in_private_message = true;
						if (!last_controller || nickname != last_controller) {
							clearInterval(controllers["зырь"]["timer_id"])
							answ = `Включена слежка за ${nickname}. Задержка: ${delay}(мс)`
							controllers["зырь"]["controller_name"] = nickname;
							controllers["зырь"]["timer_id"] = setInterval(() => track_player(nickname), delay)

						} else {
							clearInterval(controllers["зырь"]["timer_id"])
							answ = 'Вы выключили слежку'
							controllers["зырь"] = {}
						}
					}

				} else if (cmd == "ручуп" && seniors.includes(sender)) {
					let timer_id = controllers["ручуп"]["timer_id"]
					send_in_private_message = true;

					if (timer_id) {
						clearInterval(timer_id)
						controllers["ручуп"] = {};
						answ = "Управление выключено"
					} else {
						controllers["ручуп"]["controller_name"] = sender;
						controllers["ручуп"]["timer_id"] = setInterval(() => repeat_head_position(sender), 10)
					}

				} else if (cmd == "ручуп3") {
					if (!seniors.includes(sender)) {
						send_in_private_message = true;
						answ = "Функция выключена до проведения конкурса. Подробнее - https://teslacraft.org/threads/489354"
					}

					if (args[0] == "help") {
						send_in_private_message = true;
						answ = "ручуп3 позволяет управлять ботом шерстью: оранжевый[влево], лаймовый[вперёд], красный[назад], фиолетовый[вправо], зелёный[прыжок]. Для начала управления пропиши команду и возьмите нужную шерсть в руку"
					
					} else {
						let nickname;
						if (seniors.includes(sender)) {
							nickname = args[0]
						}
						if (!nickname){
							nickname = sender;
						}
						let delay;
						if (rank_sender >= 2) {
							delay = 100;
						} else {
							delay = 1000;
						}
						send_in_private_message = true;
						let last_controller = controllers["ручуп3"]["controller_name"]
						if (!last_controller || nickname != last_controller) {
							
							if (last_controller && nickname != last_controller) {
								clearInterval(controllers["ручуп3"]["timer_id"])
								answs.push([`У Вас отобрал контроль игрок ${nickname}`, {"sender": last_controller, "send_in_private_message": true}])         
							}
							answs.push([`Теперь Вы управляете ботом. Ваша задержка: ${delay}(мс). Необходимые цвета шерсти: оранжевый(←), лаймовый(↑), красный(↓), фиолетовый(→), зелёный(вверх)`,
							 {"sender": nickname, "send_in_private_message": true}])

							controllers["ручуп3"]["controller_name"] = nickname;
							controllers["ручуп3"]["timer_id"] = setInterval(() => control_bot(nickname), delay)
							
						} else {
							clearInterval(controllers["ручуп3"]["timer_id"])
							answ = "Вы выключили контроль над ботом"
							controllers["ручуп3"] = {}
						}
					}

				} else if (synonyms_cmd["шанс"].includes(cmd)) {
					if (args.length == 0 || args[0] == "help") {
						answ = "Возможные аргументы: [текст с событием, вероятность которого надо определить]"
					} else {
						let phrase = random_choice(phrases["кто"])
						answ = `${phrase}, шанс ${args.join(" ")} - ${random_number(0, 101)}%`
					}

				} else if (cmd == "nick") {
					if (args.length == 0 || args[0] == "help") {
						answ = "Возможные аргументы: [Ваш псевдоним без пробелов]. Бот будет к Вам обращаться так, как Вы указали. Доступно со звания Стажёр";
						send_in_private_message = true;

					} else {
						if (rank_sender >= 2) {
							answ = phrases["warn_use_cmd"]
							send_in_private_message = true;
							if (!informed_users["nick"].includes(sender)) {
								queue_waiting_data["private_message"][sender] = function(nick, message) {
									console.log(message.toLowerCase())
									if (["ок", "да", "хорошо", "согласен"].includes(message.toLowerCase())) {
										answ = `/m ${nick} Ура! Не подведи меня!`
										informed_users["nick"].push(nick)
										update_config("informed_users", "nick", informed_users["nick"])

										console.log("Изменено informed_users.nick")
									} else {
										answ = `/m ${nick} Я ожидал другой ответ :<`
									}
									answs.push(answ)
								}
								
							} else {
								let new_nick = args[0].replace("&", "")
								if (new_nick) {
									update_stats(sender, "name", new_nick)
									answ = "Ник успешно изменён!";
									send_in_private_message = true;
								}
								
							}
							
						} else {
							answ = "Смена ника доступна со звания Стажёр."
						}
					}

				} else if (cmd == "near") {
					players_and_distances = get_distance_to_players().map(arr => arr.join(": "))
					answ = players_and_distances.join(", ")
					
				} else if (cmd == "выбери") {
					if (args.length == 0 || args[0] == "help") {
						answ = "Пример использования: [*первый вариант*] или [*второй вариант*] или [*n-ый элемент*]. Выберет один из указанных вариантов"
						send_in_private_message = true;
					}
					if (!informed_users["выбери"].includes(sender)) {
						queue_waiting_data["private_message"][sender] = function(nick, message) {
							console.log(message.toLowerCase())
							if (["ок", "да", "хорошо", "согласен"].includes(message.toLowerCase())) {
								answ = `/m ${nick} Ура! Не подведи меня!`
								informed_users["выбери"].push(nick)
								update_config("informed_users", "выбери", informed_users["выбери"])
								config_info.write("txt/info.ini")
								console.log("Изменено informed_users.nick")
							} else {
								answ = `/m ${nick} Я ожидал другой ответ :<`
							}
							answs.push(answ)
						}
						
						answ = phrases["warn_use_cmd"]
						send_in_private_message = true;
						
					} else {
						if (args.join(" ").includes(" или ")) {
							let variants = args.join(" ").split(" или ").filter((item, index, array) => array.indexOf(item) == index)
							console.log(variants)
							if (variants.length == 1) {
								console.log("Зашло")
								answ = random_choice(phrases["выбери_повтор"])
							} else {
								answ = random_choice(variants)
							}

						} else {
							send_in_private_message = true;
							answ = "Команда должна содержать хотя бы 2 варианта, разделённых словом 'или'"
						}
					}

				} else if (cmd == "кто" || cmd == "кого" || cmd == "кем" || cmd == "кому") {
					if (args.length == 0 || args[0] == "help") {
						answ = "Пример использования: [*текст, описывающий, кого нужно выбрать*]. Выбирает из находящихся рядом игроков подходящего под описание"
						send_in_private_message = true;
					}
					let usernames = get_distance_to_players(start_point=undefined, ignore_bot=false).map(arr => arr[0])
					if (usernames.length > 1) {
						let username = random_choice(usernames)
						let phrase = random_choice(phrases["кто"])
						answ = `${phrase}, ${args.join(" ")} - ${username}`
					} else {
						answ = `никто`
					}
					
				} else if (cmd == "stats") {
					if (args[0] == "help") {
						answ = "Возможные аргументы: [nickname - покажет ста-ку игрока в боте; top - покажет топ по указанной ста-ке]";
						send_in_private_message = true;
						
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
								answ = "Неверно введены аргументы: nickname: ${nickname}, key: ${key}, new_value: ${new_value}"
							}
						} 
						
					} else if (args[0] == "top") {
						if (args[0] == "help" || args.length == 1) {
							answ = "Возможные аргументы: [rank, messages, cmds, donate, casino] [номер страницы]"
							send_in_private_message = true;
							
						} else if (args.length >= 2) {
							let [type_stat, num_page] = args.slice(1)
							if (num_page) {
								num_page = Number(num_page);
							} else {
								num_page = 1;
							}
							let top_stats = get_tops(type_stat);
							if (top_stats) {
								answ = top_split_into_pages(get_tops(type_stat), nums_in_page=5, num_page=num_page)
							} else {
								answ = "Ошибка: неправильно сформирован топ. Проверьте корректность введённой команды";
								send_in_private_message = true;
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
							answ = Object.entries(get_stats(nickname)).map(([key, value]) => {
								[key, value] = stats_to_text(key, value)
								if (key) {
									return `${key}: ${value}`
								}
							}).filter(value => value != undefined);
							answ = `Статистика игрока ${nickname}: ${answ.join(", ")}`;
						} else {
							answ = `Игрок не найден. Убедитесь, что ник указан в верном регистре`;
						}
					}
				} else if (cmd == "скрести") {
					if (args.length == 0 || args[0] == "help") {
						answ = "Узнать совместимость ников: [nick1] + [nick2]. Узнать имя ребёнка по никам: [nick1] + [nick2] ="
						send_in_private_message = true;
					} else if (args.join(" ").includes(" + "))                                                   {
						let [nick1, nick2] = args.join(" ").split(" + ")
						nick1 = nick1.split(" ").at(-1)
						nick2 = nick2.split(" ")[0]
						if (nick1, nick2) {
							if (args.at(-1) == "=") {
								args = args.slice(0, -1)
								let new_nick = combine_nicks(nick1, nick2, mod = random_choice(["random_symbols", "gen"]))
								answ = `${nick1} + ${nick2} = ${new_nick}`
								
							} else {
								let procent = combine_nicks(nick1, nick2)
								answ = `Совместимость ${nick1} и ${nick2} - ${procent}%`
							}
						} else {
							answ = "Неверно указаны ники."
							send_in_private_message = true;
						}
					}
					
				} else if (cmd == "grief") {
					if (args.length == 0 || args[0] == "help") {
						answ = "Возможные аргументы: [номер страницы] [параметры:'ключ: значение'. Доступные: year,year2, month,month2, day,day2, hours,hours2, minutes,minutes2, seconds,seconds2, nick]**. date-начало поиска, date2-конец поиска"
						send_in_private_message = true;

					} else {
						let num_page;
						num_page = Number(args[0])
						if (!num_page) {
							num_page = 1;
							
						} else {
							delete args[0]
						}
						
						if (args.length > 0) {
							let date_start = new Date(2024, 6, 20)
							let date_end = new Date()
							date_end.setMonth(date_end.getMonth() + 1)
							let nick;
							args.forEach(parametr => {
								let [key, value] = parametr.split(":")
								
								if (key && value) {
									key = key.toLowerCase()
									if (key == "nick") {
										nick = `'${value}'`;
										return;
									}
									if (key.at(-1) == "2") {
										key = key.slice(0, -1)
										if (key == "year") {
											date_end.setYear(value)
										} else if (key == "month") {
											date_end.setMonth(value)
										} else if (key == "day") {
											date_end.setDate(value)
										} else if (key == "hours") {
											date_end.setHours(value)
										} else if (key == "minutes") {
											date_end.setMinutes(value)
										} else if (key == "seconds") {
											date_end.setSeconds(value)
										} 

									} else {
										if (key == "year") {
											date_start.setYear(value)
										} else if (key == "month") {
											date_start.setMonth(value)
										} else if (key == "day") {
											date_start.setDate(value)
										} else if (key == "hours") {
											date_start.setHours(value)
										} else if (key == "minutes") {
											date_start.setMinutes(value)
										} else if (key == "seconds") {
											date_start.setSeconds(value)
										}
									}
									
								}
							})
							
							console.log(num_page, nickname)
							let nicks_and_beds = get_placed_beds(nickname=nick, date_start, date_end)
							let begin_text = `${date_to_text(date_start)} - ${date_to_text(date_end)}: `
							answ = top_split_into_pages(nicks_and_beds, nums_in_page=5, num_page=num_page, begin_text=begin_text)
							console.log(answ, typeof answ)
							send_in_private_message = true;
							
						}
					}
					
				} else if (cmd == "casino") {
					if (args.length == 0 || args[0] == "help") {
						let num_page;
						if (args[0] == "help" && args.length >= 2) {
							num_page = Number(args[1])
						} 
						if (!num_page) {
							num_page = 1;
						}
						
						send_in_private_message = true;
						let help = "Возможные аргументы: [ставка в сурвингах(целое число без '$')] [версия казино]. ТСА нужно указывать в сурвингах по курсу 1:12к Пример: если хотите сыграть на 2 ТСА, нужно написать: сmd casino 24000. После написания команды - переведите деньги. Также можно перевести деньги без написания команды, указав в причине перевода 'casino'";
						help = text_split_into_pages(help, max_len=undefined, num_page=num_page)
						if (help) {
							answ = help;
						} else {
							answ = "Данной страницы не существует";
						}
				
					} else {

						let bet = args[0];
						let mode_casino = Number(args[1])
						if (!mode_casino) {
							mode_casino = 1; 
						}

						let info = check_valid_bet(sender, bet, undefined, mode_casino)
						let is_ok = info["is_ok"];
						if (is_ok) {
							if (mode_casino == 1) {
								queue_waiting_data["casino"][sender] = {"function": casino, "expected_cash": Number(bet)}
								answ = random_choice(phrases["casino_wait_cash"])
								send_in_private_message = true;
							
							} else if (mode_casino == 2) {
								answ = random_choice(phrases["casino_wait_cash"])
								send_in_private_message = true;
								queue_waiting_data["casino2"][sender] = {"step": 1, "expected_cash": Number(bet), "function": (nick, cash) => {
									queue_waiting_data["casino2"][nick] = {"step": 2, "expected_cash": cash, "function": casino}
									update_config("permanent_memory", "casino2", queue_waiting_data["casino2"])
									answ = `Перевод в размере ${cash}$ получен. Ожидание подходящего сообщения в чате`
									answs.push([answ, {"sender": nick, "send_in_private_message": true}])
								}}

							} else if (mode_casino == 3) {
								answ = random_choice(phrases["casino_wait_cash"])
								send_in_private_message = true;
								queue_waiting_data["casino3"][sender] = {"expected_cash": Number(bet), "is_paid": false, "function": (nick, cash) => {
									answ = `Перевод в размере ${cash}$ получен. Ожидание подходящего сообщения в чате`
									answs.push([answ, {"sender": nick, "send_in_private_message": true}])
									queue_waiting_data["casino3"][nick] = {"expected_cash": Number(bet), "is_paid": true, "function": casino}
									update_config("permanent_memory", "casino3", queue_waiting_data["casino3"])

								}}
							}

						} else {
							let message_error = info["message_error"]
							answ = message_error;
							send_in_private_message = true;	
						}	
					}
					
				} else if (cmd == "js" && seniors.includes(sender)) {
					wait_confirm_js =  args.join(" ")
					send_in_private_message = true;
					answ = "Ожидаю подтверждения(кнопка +) или отклонения(кнопка -). Если вы не создатель и не тестировщик бота, то поздравляю: Вы нашли уязвимость! Подробно распишите всё создателю и он Вас отблагодарит!"
				
				} else if (cmd == "add" && seniors.includes(sender)) {
					if (args.length == 1) {
						let nickname = args[0];
						send_in_private_message = true;	
						let status_add = create_new_user(nickname);
						if (status_add["status"]) {
							answ = "Игрок успешно добавлен";

						} else {
							let message_error = status_add["message_error"]
							answ = `Ошибка: ${message_error}`;
						} 
					} else {
						send_in_private_message = true;
						answ = "Неверное количество  аргументов. Нужно указать только ник игрока в правильном регистре";
					}
					
				} else if (cmd == "тест") {
					translateText("Hello my sweet World").then( (answ) => {
						answs.push([answ, {"sender": sender, "send_in_private_message": true}])
						console.log([answ, {"sender": sender, "send_in_private_message": true}])
					})
					answ = translateText("HELLO WORLD")
					send_in_private_message = true;

				} else if (seniors.includes(sender)) {
					message = cmd + " " + args.join(" ")
					console.log("seniors cmd:", message)
					wait_confirm_cmd = message
					send_in_private_message = true;
					answ = "Ожидаю подтверждения(кнопка 1) или отклонения(кнопка 0). Если вы не создатель и не тестировщик бота, то поздравляю: Вы нашли уязвимость! Подробно распишите всё создателю и он Вас отблагодарит!"
				}

				if (answ) {
					if (spec_symbols.includes("^")) {
							send_in_private_message = true;
					}
					if (seniors.includes(sender)) {
						if (spec_symbols.includes("*")) {
							send_in_private_message = false;
						} 
					}
                	answs.push([answ, {"sender": real_sender, "send_in_private_message": send_in_private_message, "send_full_message": send_full_message}])             
				}
			}
		
		} else if (message.toLowerCase().includes("cmd ")) {
			message = message.split("cmd ")[1]
			console.log("Spec", spec_symbols)
			message = message.split(" ")
			let cmd = message[0].toLowerCase()
			let args = message.slice(1)
			console.log(`cmd ${cmd} args ${args}`)

			if (wait_add_twink[sender] && cmd == "twink") {
				let main_account = args[0]
				if (main_account == wait_add_twink[sender]) {
					let twinks = get_stats(main_account, "twinks")
					twinks.push(sender)
					answs.push([`Ваш аккаунт успешно записан как твинк ${main_account}`, {"sender": sender, "send_in_private_message": true}])
					console.log(`Все твинки: ${twinks}`)
					update_stats(main_account, 'twinks', twinks)
				}

			} else if (cmd == "bank") {
				bank_processing(sender, args[0], args.slice(1))
			}
		}

		if (private_message && !answ) {
			console.log("ПРИВАТ")
			if (typeof message == "object") {
					message = message.join(" ")
				}

			if (queue_waiting_data["private_message"][sender]) {
				let func = queue_waiting_data["private_message"][sender];
				console.log(func)
				delete queue_waiting_data["private_message"][sender]

				func(sender, message)
			
			} else {
				if (waiting_start_game["wordle"][sender]) {
					let func = waiting_start_game["wordle"][sender]
					delete waiting_start_game["wordle"][sender]
					console.log(func)
					func(sender, message)
				
				} else if (games["wordle"][sender] && message.split(" ").length == 1) {
					if (message.length == 5) {
						wordle(sender, message.toLowerCase())
					} else {
						answ = "Слово должно быть ровно из 5-ти букв!"
						answs.push([answ, {"sender": sender, "send_in_private_message": true}])
					}
				} 
			}
		} 

	} else {
		const private_message_i_send = message.match(reg_i_send)
		const lookup = message.match(reg_lookup)
		const survings_accept = message.match(reg_survings_accept)
		const survings_reason = message.match(reg_survings_reason)
		const tca_accept = message.match(reg_tca_accept)
		const survings_send = message.match(reg_survings_send)
		const tca_send = message.match(reg_TCA_send)
		const bal_TCA = message.match(reg_bal_TCA)
		const bal_survings = message.match(reg_bal_survings)
		
		const is_kick = message.match(reg_kick)
		const is_warn = message.match(reg_warn)
		const is_ban = message.match(reg_ban)
		const is_mute = message.match(reg_mute)

		const vic_anagrams = message.match(reg_vic_anagrams)
		const vic_fast = message.match(reg_vic_fast)
		const vic_example = message.match(reg_vic_example)
		const vic_quest = message.match(reg_vic_quest)

		if (private_message_i_send) {
			console.log("ТЕкст", message.split("\n"))
			message = private_message_i_send[2]
			add_msg_to_bd(nickname=bot_username, type_chat="Приват", message=message)
			
		} else {
			if (!ignore_text.includes(message) && !message.match(reg_tca_accept) && !message.match(reg_bal_survings) && !message.match(reg_bal_TCA)) {
				add_msg_to_bd(nickname=undefined, type_chat="Тесла", message=message)
			}
			if (message == "Нужно авторизоваться. Напишите в чат Ваш пароль" && !password_enter) {
				bot.chat(`/login ${bot_password}`)
				password_enter = true;
				
			} else if (lookup) {
				let nickname, online, rank, clan, active_ban, active_mute, date_reg, date_last_online, location_player,
				count_bans, count_kicks, count_mutes, count_warns, last_warn_1, last_warn_2, last_warn_3
				nickname = lookup[1]
				online = lookup[2] == "Онлайн"
				rank = tesla_ranks.indexOf(lookup[3])
				clan = lookup[4]
				active_ban = lookup[5]
				active_mute  = lookup[6]
				date_reg = lookup[7]
				date_last_online = lookup[8]
				location_player = lookup[9]
				count_bans = lookup[10]
				count_kicks = lookup[11]
				count_mutes = lookup[12]
				count_warns = lookup[13]
				last_warn_1 = lookup[14]
				last_warn_2 = lookup[15]
				last_warn_3 = lookup[16]
				
				let lookup_data = {'nickname': nickname, 'online': online, 'rank': rank, 'clan': clan, 'active_ban': active_ban,
				'active_mute': active_mute, 'date_reg': date_reg, 'date_last_online': date_last_online,
				'location_player': location_player, 'count_bans': count_bans, 'count_kicks': count_kicks, 'count_mutes': count_mutes,
				'count_warns': count_warns, 'last_warns': [last_warn_1, last_warn_2, last_warn_3]}

				if (queue_waiting_data["lookup"].length != 0 && queue_waiting_data["lookup"][0]["nick"] == nickname) {
					let func = queue_waiting_data["lookup"].shift()["function"]
					func(lookup_data)
				} else {
					console.log(lookup_data)
					console.log("Лукап никому не нужен")
				}
			} else if (survings_accept) {
				let nick = survings_accept[1]
				let donate_sum = survings_accept[2]
				console.log(donate_sum)
				queue_waiting_data["pay"].push({"function": payment_processing, "nick": nick, "donate_sum": Number(donate_sum.replaceAll(",", ""))})
				console.log(queue_waiting_data)
				
			} else if (survings_reason) {
				let info = queue_waiting_data["pay"].shift()
				if (!info) return;
				let reason = survings_reason[1]
				if (reason == "Не указана") {
					reason = undefined;
				}
				console.log("info", info)
				let func = info["function"]
				let nick = info["nick"]
				let donate_sum = info["donate_sum"]
				add_pay_to_bd(payer=nick, payee=bot_username, amount=donate_sum, currency="survings", date_time=date_to_text(new Date()), reason=reason)
				func(nick, donate_sum, reason)
			
			} else if (tca_accept) {
				let date_time = tca_accept[1]
				let [day, month, year] = date_time.split(" ")[0].split(".")
				let time = date_time.split(" ")[1]
				date_time = `${year}-${month}-${day} ${time}`
				
				let action = tca_accept[2]
				let count_TCA = tca_accept[3]
				let nickname = tca_accept[4]
				let payer, payee;
				if (action == "+") {
					payer = nickname;
					payee = bot_username;
				} else {
					count_TCA = "-" + count_TCA
					payer = bot_username;
					payee = nickname;
				}
				let flag_find = false;
				for (let i = 0; i < last_payers_TCA.length; i++) {
					info = last_payers_TCA[i]
					if ((info.payer==payer && info.date_time==date_time && info.amount==count_TCA) || action == "-") {
						flag_find = true;
						break;
					} 
				}
				if (!flag_find) {
					if (last_payers_TCA.length >= 15) {
						payment_processing(payer, count_TCA*12000, undefined, "TCA")
					} else {
						console.log("НЕДОСТАТОЧНО ПЕРЕВОДОВ ТСА")
					}
					add_pay_to_bd(payer=payer, payee=payee, amount=count_TCA, currency="TCA", date_time=date_time)
					
				}
				
					
				
			} else if (survings_send) {
				let cash = Number(survings_send[1].replaceAll(",", ""))
				let nick = survings_send[2]
				console.log(`${cash}$ отправлено игроку ${nick}`)
				let marker_find = false;

				for (let i=wait_confirm_pay["survings"].length - 1; i > -1 ; i--) {
					let info = wait_confirm_pay["survings"][i]
					if (info["nick"] == nick && info["cash"] == cash) {
						wait_confirm_pay["survings"].splice(i, 1)
						console.log("Перевод добавлен в БД")
						add_pay_to_bd(payer=bot_username, payee=info["nick"], amount=info["cash"], currency="survings", date_time=date_to_text(new Date()), reason=info["reason"])
						marker_find = true;
						break;
					}
				}

				if (!marker_find) {
					console.log("ОШИБКА. НЕСАНКЦИОНИРОВАННЫЙ ПЕРЕВОД СУРВИНГОВ")
				}

			} else if (tca_send) {
				let cash = Number(tca_send[1])
				let nick = tca_send[2]
				console.log(`${cash} TCA отправлено игроку ${nick}`)
				let marker_find = false;

				for (let i=wait_confirm_pay["TCA"].length - 1; i > -1 ; i--) {
					let info = wait_confirm_pay["TCA"][i]
					if (info["nick"] == nick && info["cash"] == cash) {
						wait_confirm_pay["TCA"].splice(i, 1)
						console.log("Перевод добавлен в БД")
						add_pay_to_bd(payer=bot_username, payee=info["nick"], amount=info["cash"], currency="TCA", date_time=date_to_text(new Date()), reason=info["reason"])
						marker_find = true;
						break;
					}
				}

				if (!marker_find) {
					console.log("ОШИБКА. НЕСАНКЦИОНИРОВАННЫЙ ПЕРЕВОД TCA")
				}

			} else if (bal_TCA) {
				bot_bal_TCA = Number(bal_TCA[1])
				
			} else if (bal_survings) {
				bot_bal_survings = Number(bal_survings[1].replace(/,/g, ""))
				
			} else if (vic_fast || vic_quest || vic_example || vic_anagrams) {
				let question;
				let answ;
				let symbol_1, symbol_2, symbol_3;
				if (vic_fast) {
					question = vic_fast[1]
					answ = vic_fast[1]

					symbol_1 = "Ⓞ"

				} else if (vic_anagrams) {
					question = vic_anagrams[1]
					sorted_symbols = question.split("").sort().join("")
					if (anagrams[sorted_symbols]) {
						answ = anagrams[sorted_symbols]
					
					} else {
						console.log("НЕИЗВЕСТНАЯ АНАГРАММА", question)
					}

					symbol_1 = "➀"

				} else if (vic_example) {
					question = vic_example[1]
					answ = calculate(question).result

					symbol_1 = "➁"

				} else if (vic_quest) {
					question = vic_quest[1]
					if (!Object.keys(questions).includes(question)) return;
					
					answ = questions[question].answ
					symbol_1 = "✪"
					
				}
				if (answ) {
					console.log("\033[36m" + `Ответ на викторину: ${answ}` + "\033[0m")
				} else {

				}

				if (Object.keys(queue_waiting_data["casino3"]).length != 0) {
					Object.keys(queue_waiting_data["casino3"]).forEach( (key) => {
						const info = queue_waiting_data["casino3"][key]
						symbol_3 = String(new Date().getMinutes() % 3).replace("0", "Ⓞ").replace("1", "➀").replace("2", "➁")
						//✪Ⓞ➀➁
						console.log("Зашло", info["is_paid"])
						if (info["is_paid"]) {
							symbol_2 = String(question.length % 3).replace("0", "Ⓞ").replace("1", "➀").replace("2", "➁")
							console.log(symbol_1, symbol_2, symbol_3)
							const symbols = [symbol_1, symbol_2, symbol_3]

							let cash = info["expected_cash"]
							let func = info["function"]
							answs.push([`[casino3] Стал известен первый символ: ${symbol_1}**`, {"sender": key, "send_in_private_message": true}])
							setTimeout(() => {
								answs.push([`[casino3] Стал известен второй символ: ${symbol_1}${symbol_2}*`, {"sender": key, "send_in_private_message": true}])

								setTimeout(() => {
									answs.push([`[casino3] Стал известен третий символ: ${symbol_1}${symbol_2}${symbol_3}`, {"sender": key, "send_in_private_message": true}])
									setTimeout(() => {
										func(key, cash, undefined, symbols)
									}, 5000)
									
								}, 1000)
							}, 1000)
							delete queue_waiting_data["casino3"][key];
							update_config("permanent_memory", "casino3", queue_waiting_data["casino3"])
						}
					} )
				}

			} else if (is_kick || is_ban || is_warn || is_mute) {
				let violator, guardian, reason, period;
				if (is_kick) {
					violator = is_kick[1]
					guardian = is_kick[2]
					reason = is_kick[3]
				}
				if (is_ban) {
					violator = is_ban[1]
					period = is_ban[2]
					guardian = is_ban[3]
					reason = is_ban[4]
				}
				if (is_warn) {
					violator = is_warn[1]
					guardian = is_warn[2]
					reason = is_warn[3]
				}
				if (is_mute) {
					violator = is_mute[1]
					period = is_mute[2]
					guardian = is_mute[3]
					reason = is_mute[4]
				}

				if (Object.keys(queue_waiting_data["casino2"]).length != 0) {
					Object.keys(queue_waiting_data["casino2"]).forEach( (key) => {
						const info = queue_waiting_data["casino2"][key]
						if (info["step"] == 2) {
							let cash = info["expected_cash"]
							let func = info["function"]
							func(key, cash, violator)
							delete queue_waiting_data["casino2"][key];
							update_config("permanent_memory", "casino2", queue_waiting_data["casino2"])
						}
					} )
				}

			} else {
				
				if (!ignore_text.includes(message)) {
					console.log("ТЕкст", message.split("\n"))
				}
			}
				
			
		}

	}
});


function check_times() {
	let hours = new Date().getHours()
	let minutes = new Date().getMinutes()
	if (hours == 3 && minutes > 1 && minutes < 3) {
		bot.quit()
		console.log("Бот вышел")
		setTimeout(() => {
			console.log("Завершение работы")
			throw new Error('Перезагрузка сервера');
		}, 5000)
		
	}
}

let tp_end = setInterval(() => {
	if (location_bot && location_bot.includes("Локация Край")) clearInterval(tp_end);
	else if (location_bot) bot.chat("/swarp end")}, 5000)

setInterval(check_times, 1200000)
setInterval(send_random_quote, 6000000)
setInterval(check_nearby_players, 10000)
setInterval(check_loc_bot, 3000)
setInterval(send_answs, 2000)
setInterval(send_cmds, 600)
setInterval(() => cmds.push("/tca log"), 10000)
setInterval(() => cmds.push("/bal"), 5000)
setInterval(() => cmds.push("/tca check"), 5000)

setInterval(() => {
	if (new Date().getTime() - date_last_pressed_key > 600000) {
		console.log("Сеньор афк!")
		seniors_afk = true;
	} else {
		console.log("Сеньор не афк!")
		seniors_afk = false;
	}
}, 300000)

