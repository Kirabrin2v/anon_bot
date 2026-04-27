const sqlite = require("better-sqlite3");
const path = require("path")
const db = new sqlite("modules/bank/users_data.db");

const { BaseModule } = require(path.join(__dirname, "../base.js"))
const bus = require(path.join(BASE_DIR, "event_bus.js"))

const MODULE_NAME = "bank"
const HELP = "1 счёт на несколько аккаунтов"
const INTERVAL_CHECK_ACTIONS = 500 
const STRUCTURE = {
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

const informed_users = {"auth": [], "wrong_data": [], "add": [], "empty_data": []}


class BankModule extends BaseModule {
	constructor () {
		super(MODULE_NAME, HELP, STRUCTURE, INTERVAL_CHECK_ACTIONS)
		this.bal_tca = 0;
		this.bal_survings = 0;
		this.bank_auth = {}
		this.bank_accounts = {}

		bus.on("update_bal_survings", (obj) => {
			this.bal_survings = obj.amount
		})

		bus.on("update_bal_tca", (obj) => {
			this.bal_tca = obj.amount
		})

		db.prepare("SELECT * FROM bank").all().forEach((bank_info) => {
			const name_bank = bank_info["name_bank"]
			const main_password = bank_info["main_password"]
			const visitor_password = bank_info["visitor_password"]

			this.bank_accounts[name_bank] = {"main_password": main_password, "visitor_password": visitor_password}

			let count_survings = db.prepare(`SELECT sum(amount) FROM logs 
										WHERE name_bank == '${name_bank}'
										AND currency == 'survings' `).all()[0]["sum(amount)"]
			if (!count_survings) {count_survings = 0;}

			let count_TCA = db.prepare(`SELECT sum(amount) FROM logs 
										WHERE name_bank == '${name_bank}'
										AND currency == 'TCA' `).all()[0]["sum(amount)"]
			if (!count_TCA) {count_TCA = 0;}

			this.bank_accounts[name_bank]["TCA"] = count_TCA;
			this.bank_accounts[name_bank]["survings"] = count_survings;
		})
	}

	_process(sender, args, parameters) {
		const rank = parameters.rank_sender
		let answ;
		if (args[0].name === "создать") {
			if (rank === 0) {return;}
			const name_bank = args[1].value
			const main_password = args[2].value
			const visitor_password = args[3].value

			answ = this._create_new_account(sender, name_bank, main_password, visitor_password)
		
		} else {
			answ = this._bank_processing(sender, args)
		}
		return answ
	}

	payment_processing(nick, cash, currency) {
		console.log("Платёж получен")
		let answ;
		if (this.bank_auth[nick]) {
			if (currency === "TCA") {
				this._update_bank(nick, this.bank_auth[nick]["name_bank"], cash, "TCA")
				answ = `На счёт успешно зачислено ${cash} TCA`
			
			} else {
				this._update_bank(nick, this.bank_auth[nick]["name_bank"], cash, "survings")
				answ = `На счёт успешно зачислено ${cash}$`
			}
			this.actions.push({"type": "answ", "content": {"recipient": nick, "message": answ}})
			return {"used": true}
		}
		return {"used": false}
	}

	_get_cash(nick, name_bank, amount, currency) {
		let answ;

		currency = currency.toLowerCase()
		if (currency.includes("tca") || currency.includes("тса")) {
			const count_TCA = this.bank_accounts[name_bank]["TCA"]
			if (count_TCA >= amount) {
				if (amount <= this.bal_tca) {
					console.log(`Перевожу игроку ${nick} ${amount} TCA`)
					this._update_bank(nick, name_bank, -amount, "TCA")
					this.actions.push({"type": "TCA", "content": {"nick": nick, "amount": amount}})
					
				} else {
					answ = `У бота на счету на данный момент недостаточно средств, чтобы выдать всю сумму. Текущий баланс бота: ${this.bal_tca} TCA`
				}

			} else {
				answ = `У Вас недостаточно средств на балансе. Количество Ваших TCA: ${count_TCA}`
			}

		} else if (currency.includes("surv") || currency.includes("сурв")) {
			const count_survings = this.bank_accounts[name_bank]["survings"]
			if (count_survings >= amount) {
				if (amount <= this.bal_survings) {
					console.log(`Перевожу игроку ${nick} ${amount} сурвингов`)
					this._update_bank(nick, name_bank, -amount, "survings")
					this.actions.push({"type": "survings", "content": {"nick": nick, "amount": amount, "reason": `Вы успешно сняли со счёта ${amount}$`}})

				} else {
					answ = `У бота на счету на данный момент недостаточно средств, чтобы выдать всю сумму. Текущий баланс бота: ${this.bal_survings}$`
				}

			} else {
				answ = `У Вас недостаточно средств на балансе. Количество Ваших сурвингов: ${count_survings}`
			}

		} else {
			answ = `Неверно указано название валюты. Примеры правильного написания: TCA; сурвинги`
		}
		return answ

	}

	_authorization(nick, name_bank, password) {
		let answ;

		name_bank = name_bank.toLowerCase()
		password = password.toLowerCase()
		if (this.bank_accounts[name_bank] && (this.bank_accounts[name_bank].main_password === password || this.bank_accounts[name_bank].visitor_password === password)) {
			informed_users["auth"].splice(informed_users["auth"].indexOf(nick), 1)
			informed_users["wrong_data"].splice(informed_users["auth"].indexOf(nick), 1)
			informed_users["add"].splice(informed_users["auth"].indexOf(nick), 1)

			let mode;
			if (this.bank_accounts[name_bank].main_password === password) {
				this.bank_auth[nick] = {"name_bank": name_bank, "is_main": true}
				mode = "владелец счёта"
			
			} else {
				this.bank_auth[nick] = {"name_bank": name_bank, "is_main": false}
				mode = "гость"
			}

			setTimeout((nick) => {
				if (this.bank_auth[nick]) {
					setTimeout(() => delete this.bank_auth[nick], 5000)
					
					const answ = "Время активности авторизации истекло. Для продолжения авторизуйтесь в банке заново";
					this.actions.push({
						type: "answ",
						content: {
							recipient: nick,
							message: answ
						}
					})
				}
			}, 600000, nick)

			answ = `Вы успешно авторизовались как ${mode}. Авторизация актуальна следующие 10 минут. После их истечения надо будет заново авторизоваться.`
			
		
		} else if (!informed_users["wrong_data"].includes(nick)) {
			answ = "Название счёта или пароль введены неверно. Это сообщение при введении неправильных данных больше отправляться не будет. Если данные будут введены корректно - сообщение будет отправлено."
			informed_users["wrong_data"].push(nick)
		} 
		return answ;
	}

	_bank_processing(sender, args) {
			let answ;
			if (this.bank_auth[sender]) {
				const is_main = this.bank_auth[sender]["is_main"]
				if (args[0].name === "auth") {
					answ = `Вы уже авторизованы в счёте ${this.bank_auth[sender]["name_bank"]}. Чтобы авторизоваться в другом счёте, сначала выйдите из этого: сmd bank logout`
				
				} else if (args[0].name === "снять") {
					if (is_main) {
						let amount = args[1].value
						const currency = args[2].value
						if (amount) {
							if (currency) {
								if ((currency.includes("surv") || currency.includes("сурв"))) {
									if (amount > 5000) {
										amount = Number(amount.toFixed(1))
										const name_bank = this.bank_auth[sender]["name_bank"]
										answ = this._get_cash(sender, name_bank, amount, currency)
									} else {
										answ = "Минимальная сумма для вывода"
									}
								} else {
									const name_bank = this.bank_auth[sender]["name_bank"]
									answ = this._get_cash(sender, name_bank, amount, currency)
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

				} else if (args[0].name === "logout") {
					delete this.bank_auth[sender]
					answ = "Вы разлогинились. Повторно пройти авторизацию: сmd bank auth [название счёта] [пароль]"
				
				} else if (args[0].name === "баланс") {
					const name_bank = this.bank_auth[sender]["name_bank"]
					const count_TCA = this.bank_accounts[name_bank]["TCA"]
					const count_survings = this.bank_accounts[name_bank]["survings"]
					answ = `Текущий баланс выбранного счёта: TCA: ${count_TCA}; Сурвингов: ${count_survings}`
				
				} else if (args[0].name === "пополнить") {
					answ = "Для пополнения баланса не нужно прописывать отдельную команду, т.к. вы уже авторизованы в этом счёте. В течение текущей сессии любой перевод TCA/сурвингов будет автоматически зачислен на счёт"
				
				} else {
					answ = "Возможные аргументы: [снять, пополнить, баланс, logout, создать]"
				}

			} else {
				if (args[0].name === "auth") {
					const name_bank = args[1].value
					const password = args[2].value
					if (name_bank && password) {
						answ = this._authorization(sender, name_bank, password)

					} else {
						informed_users["empty_data"].push(sender)
						answ = "Верный синтаксис: сmd bank auth [название_счёта] [пароль]"

					}

				} else if (args[0].name === "пополнить" && !informed_users["add"].includes(sender)) {
					informed_users["add"].push(sender)
					answ = "Для пополнения баланса Вам нужно сначала авторизоваться с помощью команды: сmd bank auth [название счёта] [пароль]. Данное сообщение больше отправляться не будет"

				} else if (!informed_users["auth"].includes(sender)) {
					answ = "Вы не авторизованы, сделайте это командой: сmd bank auth [название счёта] [пароль]. Данное сообщение отправляется только 1 раз."
					informed_users["auth"].push(sender)
				}
			}
			return answ
	}

	_create_new_account(nick, name_bank, main_password, visitor_password) {
		let answ;
		if (name_bank) {
			name_bank = name_bank.toLowerCase()
			if (!this.bank_accounts[name_bank]) {
				if (main_password) {
					main_password = main_password.toLowerCase().replace()
					if (visitor_password) {
						visitor_password = visitor_password.toLowerCase()
						this.bank_accounts[name_bank] = {"TCA": 0, "survings": 0, "main_password": main_password, "visitor_password": visitor_password}
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

	_update_bank(nickname, name_bank, amount, currency) {
			const insertMessage = db.prepare(`INSERT INTO logs (
			date_time, name_bank, nickname, amount, currency)
			VALUES (datetime('now', '+3 hours'), @name_bank, @nickname, @amount, @currency)`);
			insertMessage.run({
			  name_bank: name_bank,
			  nickname: nickname,
			  amount: amount,
			  currency: currency
			});

			this.bank_accounts[name_bank][currency] += amount
		}
}

module.exports = BankModule
