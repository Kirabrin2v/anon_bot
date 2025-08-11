const ConfigParser = require('configparser');

const path = require("path")

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const memory = new ConfigParser();
const path_memory = path.join(__dirname, "permanent_memory.ini")
memory.read(path_memory)

const module_name = "casino"
const help = "Казино, в котором можно как выиграть, так и проиграть миллионы!"

structure = {
	ставка: {
		версия: {
			_type: "int",
			_default: 1,
			_description: "Версия казино. Определяет, от чего зависит победа. 1 - внутренняя функция рандома. 2 - чётность ника нарушителя из чата. 3[Заморожено] - информация из викторины"
		},
		_type: "int",
		_description: "Сумма, на которую будет идти игра. Можно указать TCA по текущему внутриботовому курсу обмена и играть на них"
	}
}

const max_bets = JSON.parse(config.get("VARIABLES", "max_bets"))
const min_bet = Number(config.get("VARIABLES", "min_bet"))

var phrases = {};
phrases["lose"] = JSON.parse(config.get("phrases", "lose"))
phrases["win"] = JSON.parse(config.get("phrases", "win"))
phrases["win_public"] = JSON.parse(config.get("phrases", "win_public"))
phrases["wait_cash"] = JSON.parse(config.get("phrases", "wait_cash"))

var players_increased_win = {}

var wait_chat_violators = JSON.parse(memory.get("wait_result", "chat_violators"))

var wait_pay = {}

var actions = []

var bal_survings = 0;

function random_number (min_num, max_num) {
	return Math.floor(Math.random() * (max_num - min_num + 1)) + min_num;
}

function random_choice(array) {
	return array[Math.floor(Math.random() * array.length)]
}

function casino_random_numbers() {
	return random_number(0, 1)
}

function substitute_text(pattern, values) {
	return pattern.replace(/\{([^}]+)\}/g, (match, key) => values[key]);
	
}

function casino_chat_violators(nick, nick_violator, nick_guardian) {
	if (nick_violator != nick && nick_guardian != nick) {
		delete(wait_chat_violators[nick])
		memory.set("wait_result", "chat_violators", JSON.stringify(wait_chat_violators))
		memory.write(path_memory)
		return nick_violator.length % 2 == 1;
	}
}

function prepare_casino_violators(nick, bet) {
	if (wait_chat_violators[nick]) {
		return {"type": "answ", "content": {"recipient": nick, "message": "Запрос уже создан, ожидайте"}}

	} else {
		wait_chat_violators[nick] = bet;
		memory.set("wait_result", "chat_violators", JSON.stringify(wait_chat_violators))
		memory.write(path_memory)
		return {"type": "answ", "content": {"recipient": nick, "message": "Запрос получен. Ожидайте подходящего сообщения в чате"}}
	}
	
}

function win_processing(nick, bet, win) {
	if (win === undefined) {
		return;
	}
	if (win) {
		let coef_win = use_coef_win(nick)
		if (!coef_win) {
			coef_win = 1;
		}
		let phrase = random_choice(phrases["win"])
		let win_money = bet*0.9*coef_win
		actions.push({"type": "survings", "content": {"nick": nick, "amount": bet + win_money, "reason": phrase}})
		actions.push({
			type: "update_stats",
			content: {
				nickname: nick,
				key: "casino",
				type: "add",
				value: win_money
			}
		})
	} else {
		let phrase = substitute_text(random_choice(phrases["lose"]), {"cash": bet})
		actions.push({"type": "answ", "content": {"recipient": nick, "message": phrase}})
		actions.push({
			type: "update_stats",
			content: {
				nickname: nick,
				key: "casino",
				type: "add",
				value: -bet
			}
		})
	}
}


function end_casino_violator(nick_violator, nick_guardian) {
	let nick_error;
	try {
		let actions = []
		Object.keys(wait_chat_violators).forEach(nick => {
			nick_error = nick;
			let bet = wait_chat_violators[nick]
			let win = casino_chat_violators(nick, nick_violator, nick_guardian)
			win_processing(nick, bet, win)
		})
	} catch (error) {
		return {"type": "error", "content": {"module_name": module_name, "error": error, "args": [nick_violator, nick_guardian],  "sender": nick_error}}
	}
}

function use_coef_win(nick) {
	let coef_win = players_increased_win[nick]
	delete(players_increased_win[nick])
	return coef_win;
}


function check_valid_bet(nick, rank, bet, mode_casino) {
	if (bet) {
		let max_bet = max_bets[rank]
		if (bet <= max_bet && bet >= min_bet) {
			let coef_win;

			if (mode_casino == 3) {
				coef_win = 4.5

			} else {
				coef_win = players_increased_win[nick]
			}

			if (!coef_win) {
				coef_win = 1;
			}
			if (bet*0.9*coef_win < bal_survings) {
				return {"is_ok": true}
			
			} else {
				return {"is_ok": false, "message_error": `У бота недостаточно средств, чтобы можно было сыграть на эту ставку. Текущий баланс: ${bal_survings}`}
			}

		} else {
			return {"is_ok": false, "message_error": `Ставка должна быть в диапазоне от ${min_bet}$ до ${max_bet}$`}
		}

	} else {
		return {"is_ok": false, "message_error": "Ставка введена некорректно"}
	}
}


function payment_processing(nick, amount, currency, reason, price_TCA) {
	try {
		if (currency == "TCA") {
			amount = amount * price_TCA; 
		}
		if (wait_pay[nick]) {
			if (wait_pay[nick] == amount) {

				let mode_casino = wait_pay[nick]["mode_casino"]
				let bet = wait_pay[nick]["bet"]
				delete wait_pay[nick]

				if (mode_casino == 1) {

					let win = casino_random_numbers()
					//console.log(mode_casino, bet, win)
					win_processing(nick, bet, win)

					return {"used": true}

				} else if (mode_casino == 2) {
					let action = prepare_casino_violators(nick, bet)
					actions.push(action)

					return {"used": true}

				} else if (mode_casino == 3) {

				}
			} else {
				return {"used": false}
			}
		} else {
			return {"used": false}
		}
	} catch (error) {
		actions.push({"type": "error", "content": {"module_name": module_name, "error": error, "args": args,  "sender": nick}})
		return {"used": false}
	}
}

function cmd_processing(sender, args, parameters) {
	try {
		let answ;
		let rank = parameters.rank_sender
		if (args.length == 0 || args[0] == "help") {
			answ = `Возможные аргументы: [ставка в сурвингах(целое число без '$')] [версия казино]. ТСА нужно указывать в сурвингах по курсу 1:${price_TCA}`
		} else {
			let bet = Number(args[0])

			let mode_casino = Number(args[1])
			if (!mode_casino) {
				mode_casino = 1
			}

			let is_valid = check_valid_bet(sender, rank, bet, mode_casino)
			if (is_valid["is_ok"]) {
				//console.log(mode_casino)
				if (mode_casino > 0 && mode_casino <= 3) {
					wait_pay[sender] = {"bet": bet, "mode_casino": mode_casino}
					let phrase = random_choice(phrases["wait_cash"])
					answ = phrase

				} else {
					answ = "Вы неверно указали версию казино"
				}

			} else {
				answ = is_valid["message_error"]
			}
		}

		return {"type": "answ", "content": {"recipient": sender, "message": answ}}
	
	} catch (error) {
		return {"type": "error", "content": {"module_name": module_name, "error": error, "args": args,  "sender": sender}}
	}


}

function update_survings(new_balance) {
	bal_survings = new_balance;
}

function get_actions() {
	return actions.splice(0)
}


module.exports = {module_name, cmd_processing, payment_processing, end_casino_violator, update_survings, get_actions, help, structure}