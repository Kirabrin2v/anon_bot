const sqlite = require("better-sqlite3");

const db = new sqlite("modules/bank/users_data.db");

const module_name = "bank"
const help = "1 счёт на несколько аккаунтов"

const structure = {
  auth: {
    название_счёта: {
      пароль: {
        _type: "string",
        _description: "Пароль от счёта, в котором нужно авторизоваться. Бывает двух типов: гостевой и владельца"
      },
      _type: "string",
      _description: "Название счёта, в котором нужно авторизоваться"
    },
    _description: "Авторизоваться в счёте"
  },
  создать: {
  	название_счёта: {
  		пароль_владельца: {
  			пароль_гостя: {
  				_type: "string",
  				_description: "Пароль для доступа к счёту в режиме гостя. В режиме гостя доступно только пополнение и просмотр баланса"
  			},
  			_type: "string",
  			_description: "Пароль для доступа к счёту в режиме владельца. В режиме владельца можно выполнять все возможные действия"
  		},
  		_type: "string",
  		_description: "Название счёта, необходимое для идентифицирования счёта"
  	},
  	_description: "Создать новый счёт"

  },
  снять: {
    сумма: {
      валюта: {
        _type: "string",
        _description: "Валюта, в которой указана сумма. TCA или сурвинги"
      },
    _type: "int",
    _description: "Сумма, которую нужно снять"
    }

  },
  logout: {
    _description: "Разлогиниться из счёта"
  },
  баланс: {
    _description: "Узнать балан счёта, в котором активна авторизация"
  },
  пополнить: {
    _description: "Для пополнения необходимо авторизоваться и перевести сумму"
  }
}

var informed_users = {"auth": [], "wrong_data": [], "add": [], "empty_data": []}

var actions = []

var bot_bal_TCA = 0;
var bot_bal_survings = 0;

var bank_auth = {}
var bank_accounts = {}

db.prepare("SELECT * FROM bank").all().forEach((bank_info) => {
	let name_bank = bank_info["name_bank"]
	let main_password = bank_info["main_password"]
	let visitor_password = bank_info["visitor_password"]

	bank_accounts[name_bank] = {"main_password": main_password, "visitor_password": visitor_password}

	var count_survings = db.prepare(`SELECT sum(amount) FROM logs 
								WHERE name_bank == '${name_bank}'
								AND currency == 'survings' `).all()[0]["sum(amount)"]
	if (!count_survings) count_survings = 0;

	var count_TCA = db.prepare(`SELECT sum(amount) FROM logs 
								WHERE name_bank == '${name_bank}'
								AND currency == 'TCA' `).all()[0]["sum(amount)"]
	if (!count_TCA) count_TCA = 0;

	bank_accounts[name_bank]["TCA"] = count_TCA;
	bank_accounts[name_bank]["survings"] = count_survings;
})

function payment_processing (nick, cash, currency, reason) {
	try {

		if (bank_auth[nick]) {
			if (currency == "TCA") {
				update_bank(nick, bank_auth[nick]["name_bank"], cash, "TCA")
				answ = `На счёт успешно зачислено ${cash} TCA`
			
			} else {
				update_bank(nick, bank_auth[nick]["name_bank"], cash, "survings")
				answ = `На счёт успешно зачислено ${cash}$`
			}
			actions.push({"type": "answ", "content": {"recipient": nick, "message": answ}})
			return {"used": true}
		}
		return {"used": false}
	} catch (error) {
		actions.push({"type": "error", "content": {"date_time": new Date(), "module_name": module_name, "error": error, "args": args,  "sender": sender}})
		return {"used": false}
	}
}



function get_cash (nick, name_bank, amount, currency) {
		let answ, TCA, survings;

		currency = currency.toLowerCase()
		if (currency.includes("tca") || currency.includes("тса")) {
			let count_TCA = bank_accounts[name_bank]["TCA"]
			if (count_TCA >= amount) {
				if (amount <= bot_bal_TCA) {
					console.log(`Перевожу игроку ${nick} ${amount} TCA`)
					update_bank(nick, name_bank, -amount, "TCA")
					actions.push({"type": "TCA", "content": {"nick": nick, "amount": amount}})
					
				} else {
					answ = `У бота на счету на данный момент недостаточно средств, чтобы выдать всю сумму. Текущий баланс бота: ${bot_bal_TCA} TCA`
				}

			} else {
				answ = `У Вас недостаточно средств на балансе. Количество Ваших TCA: ${count_TCA}`
			}

		} else if (currency.includes("surv") || currency.includes("сурв")) {
			let count_survings = bank_accounts[name_bank]["survings"]
			if (count_survings >= amount) {
				if (amount <= bot_bal_survings) {
					console.log(`Перевожу игроку ${nick} ${amount} сурвингов`)
					update_bank(nick, name_bank, -amount, "survings")
					actions.push({"type": "survings", "content": {"nick": nick, "amount": amount, "reason": `Вы успешно сняли со счёта ${amount}$`}})

				} else {
					answ = `У бота на счету на данный момент недостаточно средств, чтобы выдать всю сумму. Текущий баланс бота: ${bot_bal_survings}$`
				}

			} else {
				answ = `У Вас недостаточно средств на балансе. Количество Ваших сурвингов: ${count_survings}`
			}

		} else {
			answ = `Неверно указано название валюты. Примеры правильного написания: TCA; сурвинги`
		}
		return answ

}

function authorization (nick, name_bank, password) {
	let answ;

	name_bank = name_bank.toLowerCase()
	password = password.toLowerCase()
	if (bank_accounts[name_bank] && (bank_accounts[name_bank].main_password == password || bank_accounts[name_bank].visitor_password == password)) {
		informed_users["auth"].splice(informed_users["auth"].indexOf(nick), 1)
		informed_users["wrong_data"].splice(informed_users["auth"].indexOf(nick), 1)
		informed_users["add"].splice(informed_users["auth"].indexOf(nick), 1)

		let mode;
		if (bank_accounts[name_bank].main_password == password) {
			bank_auth[nick] = {"name_bank": name_bank, "is_main": true}
			mode = "владелец счёта"
		
		} else {
			bank_auth[nick] = {"name_bank": name_bank, "is_main": false}
			mode = "гость"
		}

		setTimeout((nick) => {
			if (bank_auth[nick]) {
				setTimeout(() => delete bank_auth[nick], 5000)
				
				let answ = "Время активности авторизации истекло. Для продолжения авторизуйтесь в банке заново";
				actions.push({"type": "answ", "content": {"recipient": nick, "message": answ}})

			} else {

			}
		}, 600000, nick)

		answ = `Вы успешно авторизовались как ${mode}. Авторизация актуальна следующие 10 минут. После их истечения надо будет заново авторизоваться.`
		
	
	} else if (!informed_users["wrong_data"].includes(nick)) {
		answ = "Название счёта или пароль введены неверно. Это сообщение при введении неправильных данных больше отправляться не будет. Если данные будут введены корректно - сообщение будет отправлено."
		informed_users["wrong_data"].push(nick)
	} 
	return answ;
}

function bank_processing (sender, args) {
		let answ;
		let cash = {}
		if (args) {

			if (bank_auth[sender]) {
				let is_main = bank_auth[sender]["is_main"]
				if (args[0] == "auth") {
					answ = `Вы уже авторизованы в счёте ${bank_auth[sender]["name_bank"]}. Чтобы авторизоваться в другом счёте, сначала выйдите из этого: сmd bank logout`
				
				} else if (args[0] == "снять") {
					if (is_main) {
						let amount = Number(args[1])
						let currency = args[2]
						if (amount) {
							if (currency) {
								if ((currency.includes("surv") || currency.includes("сурв"))) {
									if (amount > 5000) {
										amount = Number(amount.toFixed(1))
										let name_bank = bank_auth[sender]["name_bank"]
										answ = get_cash(sender, name_bank, amount, currency)
									} else {
										answ = "Минимальная сумма для вывода"
									}
								} else {
									let name_bank = bank_auth[sender]["name_bank"]
									answ = get_cash(sender, name_bank, amount, currency)
								}
								
								
							} else {
								answ = "Вы не указали валюту(сурвинги/TCA)"
							}

						} else {
							answ = "Вы не указали количество и название валюты"
						}

					} else {
						answ = "Вы в гостевом режиме, поэтому не имеете права на вывод денег"
					}

				} else if (args[0] == "logout") {
					delete bank_auth[sender]
					answ = "Вы разлогинились. Повторно пройти авторизацию: сmd bank auth [название счёта] [пароль]"
				
				} else if (args[0] == "баланс") {
					let name_bank = bank_auth[sender]["name_bank"]
					let count_TCA = bank_accounts[name_bank]["TCA"]
					let count_survings = bank_accounts[name_bank]["survings"]
					answ = `Текущий баланс выбранного счёта: TCA: ${count_TCA}; Сурвингов: ${count_survings}`
				
				} else if (args[0] == "пополнить") {
					answ = "Для пополнения баланса не нужно прописывать отдельную команду, т.к. вы уже авторизованы в этом счёте. В течение текущей сессии любой перевод TCA/сурвингов будет автоматически зачислен на счёт"
				
				} else {
					answ = "Возможные аргументы: [снять, пополнить, баланс, logout, создать]"
				}

			} else {
				if (args[0] == "auth") {
					let name_bank = args[1]
					let password = args[2]
					if (name_bank && password) {
						answ = authorization(sender, name_bank, password)

					} else {
						informed_users["empty_data"].push(sender)
						answ = "Верный синтаксис: сmd bank auth [название_счёта] [пароль]"

					}

				} else if (args[0] == "пополнить" && !informed_users["add"].includes(sender)) {
					informed_users["add"].push(sender)
					answ = "Для пополнения баланса Вам нужно сначала авторизоваться с помощью команды: сmd bank auth [название счёта] [пароль]. Данное сообщение больше отправляться не будет"

				} else if (!informed_users["auth"].includes(sender)) {
					answ = "Вы не авторизованы, сделайте это командой: сmd bank auth [название счёта] [пароль]. Данное сообщение отправляется только 1 раз."
					informed_users["auth"].push(sender)
				}
			}
		} else {
			answ = "Возможные аргументы: [снять, пополнить, баланс, logout, создать]"
		}
		return answ
}

function create_new_account (nick, name_bank, main_password, visitor_password) {
	if (name_bank) {
		name_bank = name_bank.toLowerCase()
		if (!bank_accounts[name_bank]) {
			if (main_password) {
				main_password = main_password.toLowerCase().replace()
				if (visitor_password) {
					visitor_password = visitor_password.toLowerCase()
					bank_accounts[name_bank] = {"TCA": 0, "survings": 0, "main_password": main_password, "visitor_password": visitor_password}
					const insertMessage = db.prepare(`INSERT INTO bank (
														name_bank, main_password, visitor_password)
														VALUES (?, ?, ?)`)
					insertMessage.run(name_bank, main_password, visitor_password)

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
	//return {"answ": {"sender": nick, "recipient": nick, "message": answ, "send_in_private_message": true}}
	return answ
}

function cmd_processing(sender, args, parameters) {
	try {
		let rank = parameters.rank_sender
		let answ;
		if (args.length == 0 || args[0] == "help") {
			send_in_private_message = true;
			answ = "Возможные аргументы: [auth, создать, снять, пополнить, баланс, logout]"
		
		} else if (args[0] == "создать") {
			if (rank == 0) return;
			let name_bank = args[1]
			let main_password = args[2]
			let visitor_password = args[3]

			answ = create_new_account(sender, name_bank, main_password, visitor_password)
		
		} else {
			answ = bank_processing(sender, args)
		}
		return {"type": "answ", "content": {"recipient": sender, "message": answ}}
	} catch (error) {
		return {"type": "error", "content": {"date_time": new Date(), "module_name": module_name, "error": error, "args": args,  "sender": sender}}
	}
}

function update_bank(nickname, name_bank, amount, currency) {
	const insertMessage = db.prepare(`INSERT INTO logs (
	date_time, name_bank, nickname, amount, currency)
	VALUES (datetime('now', '+3 hours'), @name_bank, @nickname, @amount, @currency)`);
	insertMessage.run({
	  name_bank: name_bank,
	  nickname: nickname,
	  amount: amount,
	  currency: currency
	});

	bank_accounts[name_bank][currency] += amount
}

function update_TCA(count_TCA) {
	bot_bal_TCA = count_TCA;
}

function update_survings(count_survings) {
	bot_bal_survings = count_survings;
}

function get_actions () {
	return actions.splice(0)
	// let answ = answs.shift;
	// return answ;
}
//console.log(bank_users)

module.exports = {module_name, cmd_processing, bot_bal_TCA, bot_bal_survings, update_TCA, update_survings, payment_processing, get_actions, help, structure}
