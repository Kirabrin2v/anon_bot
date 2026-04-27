const ConfigParser = require('configparser');
const path = require("path")

const { random_choice, random_number } = require(path.join(BASE_DIR, "utils", "random.js"))
const { substitute_text } = require(path.join(BASE_DIR, "utils", "text.js"))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))
const bus = require(path.join(BASE_DIR, "event_bus.js"))

const MODULE_NAME = "casino"
const HELP = "Казино, в котором можно как выиграть, так и проиграть миллионы!"
const INTERVAL_CHECK_ACTIONS = 500
const STRUCTURE = {
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

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const memory = new ConfigParser();
const path_memory = path.join(__dirname, "permanent_memory.ini")
memory.read(path_memory)

const price_TCA = Number(config.get("TESLA", "price_TCA"))
const max_bets = JSON.parse(config.get("VARIABLES", "max_bets"))
const min_bet = Number(config.get("VARIABLES", "min_bet"))

const phrases = {};
phrases["lose"] = JSON.parse(config.get("phrases", "lose"))
phrases["win"] = JSON.parse(config.get("phrases", "win"))
phrases["win_public"] = JSON.parse(config.get("phrases", "win_public"))
phrases["wait_cash"] = JSON.parse(config.get("phrases", "wait_cash"))


class CasinoModule extends BaseModule {
	constructor () {
        super(MODULE_NAME, HELP, STRUCTURE, INTERVAL_CHECK_ACTIONS)

	    this.players_increased_win = {}

		this.wait_chat_violators = JSON.parse(memory.get("wait_result", "chat_violators"))
		this.wait_pay = {}

		this.bal_survings = 0;

		bus.on("update_bal_survings", (obj) => {
			this.bal_survings = obj.amount
		})

		bus.on("new_punishment", (obj) => {
			this.end_casino_violator(
				obj.punishment_data.violator,
				obj.punishment_data.guardian
			)
		})
    }

	casino_random_numbers() {
		return random_number(0, 1)
	}

	casino_chat_violators(nick, nick_violator, nick_guardian) {
		if (nick_violator !== nick && nick_guardian !== nick) {
			delete(this.wait_chat_violators[nick])
			memory.set("wait_result", "chat_violators", JSON.stringify(this.wait_chat_violators))
			memory.write(path_memory)
			return nick_violator.length % 2 === 1;
		}
	}

	prepare_casino_violators(nick, bet) {
		if (this.wait_chat_violators[nick]) {
			return {"type": "answ", "content": {"recipient": nick, "message": "Запрос уже создан, ожидайте"}}

		} else {
			this.wait_chat_violators[nick] = bet;
			memory.set("wait_result", "chat_violators", JSON.stringify(this.wait_chat_violators))
			memory.write(path_memory)
			return {"type": "answ", "content": {"recipient": nick, "message": "Запрос получен. Ожидайте подходящего сообщения в чате"}}
		}
		
	}

	win_processing(nick, bet, win) {
		if (win === undefined) {
			return;
		}
		if (win) {
			let coef_win = this.use_coef_win(nick)
			if (!coef_win) {
				coef_win = 1;
			}
			const phrase = random_choice(phrases["win"])
			const win_money = bet*0.9*coef_win
			console.log("Выигрыш", bet, coef_win, win_money)
			this.actions.push({
				type: "survings",
				content: {
					nick: nick,
					amount: bet + win_money,
					reason: phrase
				}
			})
			this.actions.push({
				type: "update_stats",
				content: {
					nickname: nick,
					key: "casino",
					type: "add",
					value: win_money
				}
			})
		} else {
			const phrase = substitute_text(random_choice(phrases["lose"]), {"cash": bet})
			this.actions.push({"type": "answ", "content": {"recipient": nick, "message": phrase}})
			this.actions.push({
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

	end_casino_violator(nick_violator, nick_guardian) {
		let nick_error;
		try {
			Object.keys(this.wait_chat_violators).forEach(nick => {
				nick_error = nick;
				const bet = this.wait_chat_violators[nick]
				const win = this.casino_chat_violators(nick, nick_violator, nick_guardian)
				this.win_processing(nick, bet, win)
			})
		} catch (error) {
			return {
				type: "error", 
				content: {
					module_name: this.module_name, 
					error: error, 
					args: [nick_violator, nick_guardian], 
					sender: nick_error
				}
			}
		}
	}

	use_coef_win(nick) {
		const coef_win = this.players_increased_win[nick]
		delete(this.players_increased_win[nick])
		return coef_win;
	}

	check_valid_bet(nick, rank, bet, mode_casino) {
		if (bet) {
			const max_bet = max_bets[rank]
			if (bet <= max_bet && bet >= min_bet) {
				let coef_win;

				if (mode_casino === 3) {
					coef_win = 4.5

				} else {
					coef_win = this.players_increased_win[nick]
				}

				if (!coef_win) {
					coef_win = 1;
				}
				if (bet*0.9*coef_win < this.bal_survings) {
					return {"is_ok": true}
				
				} else {
					return {"is_ok": false, "message_error": `У бота недостаточно средств, чтобы можно было сыграть на эту ставку. Текущий баланс: ${this.bal_survings}`}
				}

			} else {
				return {"is_ok": false, "message_error": `Ставка должна быть в диапазоне от ${min_bet}$ до ${max_bet}$`}
			}

		} else {
			return {"is_ok": false, "message_error": "Ставка введена некорректно"}
		}
	}

	payment_processing(nick, amount, currency, reason, price_TCA) {
		try {
			if (currency === "TCA") {
				amount = amount * price_TCA; 
			}
			if (this.wait_pay[nick]) {
				if (this.wait_pay[nick]["bet"] === amount) {

					const mode_casino = this.wait_pay[nick]["mode_casino"]
					const bet = this.wait_pay[nick]["bet"]
					delete this.wait_pay[nick]

					if (mode_casino === 1) {

						const win = this.casino_random_numbers()

						this.win_processing(nick, bet, win)

						return {"used": true}

					} else if (mode_casino === 2) {
						const action = this.prepare_casino_violators(nick, bet)
						this.actions.push(action)

						return {"used": true}

					} else if (mode_casino === 3) {
						// В разработке
					}
				} else {
					return {"used": false}
				}
			} else {
				return {"used": false}
			}
		} catch (error) {
			this.actions.push({
				type: "error", 
				content: {
					module_name: this.module_name, 
					error: error, 
					args: [nick, amount, currency, reason, price_TCA],  
					sender: nick
				}
			})
			return {"used": false}
		}
	}

	_process(sender, args, parameters) {
		let answ;
		const rank = parameters.rank_sender
		const bet = args[0].value

		let mode_casino = args[1].value
		if (!mode_casino) {
			mode_casino = 1
		}

		const is_valid = this.check_valid_bet(sender, rank, bet, mode_casino)
		if (is_valid["is_ok"]) {
			if (mode_casino > 0 && mode_casino <= 3) {
				this.wait_pay[sender] = {
					bet,
					mode_casino
				}
				const phrase = random_choice(phrases["wait_cash"])
				answ = phrase

			} else {
				answ = "Вы неверно указали версию казино"
			}

		} else {
			answ = is_valid["message_error"]
		}

		return answ
	}
}

module.exports = CasinoModule