const sqlite = require("better-sqlite3");
const db = new sqlite("modules/cash/money.db");

const path = require("path")

const ConfigParser = require('configparser');
const global_config = new ConfigParser();
global_config.read(path.join(BASE_DIR, "txt", "config.ini"))

const { COLORS, date_to_text } = require(path.join(BASE_DIR, "utils", "text.js"))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const MODULE_NAME = "manage_cash"
const INTERVAL_CHECK_ACTIONS = 0

const bot_username = global_config.get("VARIABLES", "bot_username")
const interval_check_surv = Number(global_config.get("VARIABLES", "interval_check_surv"))


class CashModule extends BaseModule {
	constructor () {
        super(MODULE_NAME, undefined, undefined, INTERVAL_CHECK_ACTIONS)

        this.time_last_check_surv = 0;
        this.last_payers_TCA = db.prepare(`SELECT * FROM logs WHERE payee == '${bot_username}' AND currency == 'TCA' ORDER BY id DESC LIMIT 20`).all();

        this.bal_survings;

		this.wait_confirm_send_money = {"TCA": [], "survings": []}
		this.wait_confirm_send_TCA = []
		this.wait_confirm_send_survings = []

		this.wait_confirm_surv = []

		this.last_balance_TCA;
    }

    add_pay_to_bd(payer, payee, amount, currency, date_time, reason) {
		const insertMessage = db.prepare(`INSERT INTO logs (
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
		  if (currency === "TCA") {
			  this.last_payers_TCA = db.prepare(`SELECT * FROM logs WHERE payee == '${bot_username}' AND currency == 'TCA' ORDER BY id DESC LIMIT 20`).all();
		  }
	}

	confirm_send_money(date, nick, currency, amount) {
		for (let i=0; i < this.wait_confirm_send_money[currency].length; i++) {
			const info = this.wait_confirm_send_money[currency][i]
			if (nick === info.nick && amount === info.amount) {
				console.log(COLORS.blue + "Подтверждено" + COLORS.reset, nick, amount)
				this.add_pay_to_bd(bot_username, nick, amount, currency, date_to_text(date), info.reason)
				this.wait_confirm_send_money[currency].splice(i, 1)
				break;
			}
		}


	}

	survings_accept(nick, amount, reason) {
		try {
			if (reason === "Не указана") {
				reason = undefined;
			}
			
			this.wait_confirm_surv.push({"payer": nick, "amount": amount, "reason": reason})
			
		} catch (error) {
			this.actions.push({
				type: "error",
				content: {
					date_time: new Date(),
					module_name: this.module_name,
					error: error,
					args: [reason]
				}
			})
		}
	}

	processing_wait_survings(last_balance, balance_now, date_now) {
		try {
			if (this.wait_confirm_surv.length === 0) {
				return {"is_ok": false, "message_error": "Переводов, ожидающих подтверждения, нет"}
				
			}
			const confirmed_survings = []
			let sum_transactions = 0;
			this.wait_confirm_surv.forEach(info => {
				const amount = info.amount;
				sum_transactions += amount;
				confirmed_survings.push({"payer": info.payer, "amount": Math.floor(amount), "reason": info.reason})

			})
			this.wait_confirm_surv = []
			const expected_balance = sum_transactions + last_balance;
			if (Math.round(expected_balance) === Math.round(balance_now) ) {
				confirmed_survings.forEach(pay => {
					this.actions.push({"type": "new_survings", "content": pay})
					this.add_pay_to_bd(pay.payer, bot_username, pay.amount, "survings", date_to_text(new Date()), pay.reason)
				})
				this.actions = this.actions.concat(confirmed_survings)

				return {"is_ok": true}
			} else {
				console.log("Не совпало", expected_balance, balance_now, last_balance)
				return {"is_ok": false, "message_error": "Сумма последних переводов не совпадает с текущим балансом"}
			}

		} catch (error) {
			this.actions.push({
				type: "error",
				content: {
					date_time: new Date(),
					module_name: this.module_name,
					error: error,
					args: [last_balance, balance_now, date_now]
				}
			})
			return {"is_ok": false, "message_error": "Возникла ошибка"}
		} 
		
	}

	check_repeat_TCA(payer, amount, date) {
		let flag_find = false;
		for (let i = 0; i < this.last_payers_TCA.length; i++) {
			const info = this.last_payers_TCA[i]
			if (info.payer === payer && info.date_time === date_to_text(date) && info.amount === amount) {
				flag_find = true;
				break;
			} 
		}
		if (!flag_find) {
			if (this.last_payers_TCA.length > 15) {
				return {"is_ok": true}
			} else {
				console.log("Недостаточно переводов")
				return {"is_ok": false, "message_error": "В базе данных недостаточно данных о переводах"}
			}

		} else {
			return {"is_ok": false, "message_error": "Перевод уже был обработан"}
		}
	}

	tca_accept(logs_TCA) {
		try {
			const confirmed_TCA = []

			logs_TCA.forEach(pay_TCA => {
				const payer = pay_TCA.payer;
				if (payer === bot_username) {return {"is_ok": false, "message_error": "Перевод от бота"}}
				const amount = pay_TCA.amount;
				const date = pay_TCA.date;

				if (this.check_repeat_TCA(payer, amount, date)["is_ok"]) {
					confirmed_TCA.push({"type": "new_TCA", "content": {"payer": payer, "amount": amount}})
					this.add_pay_to_bd(payer, bot_username, amount, "TCA", date_to_text(date))
				}
			})
			this.actions = this.actions.concat(confirmed_TCA)

		} catch (error) {
			this.actions.push({
				type: "error",
				content: {
					date_time: new Date(),
					module_name: this.module_name,
					error: error,
					args: [logs_TCA]
				}
			})
		}
	}
	add_wait_send_money(nick, amount, currency, reason) {
		this.wait_confirm_send_money[currency].push({
			nick: nick,
			amount: amount,
			reason: reason
		})
	}

	update_survings(count_survings, date_now) {
		try {
			if (date_now - this.time_last_check_surv >= interval_check_surv + 140) {
				this.time_last_check_surv = date_now

				this.processing_wait_survings(this.bal_survings, count_survings, date_now)
				this.bal_survings = count_survings;
				return {"is_ok": true}
			} else {
				return {"is_ok": false, "message_error": "Команда /bal прописана не по расписанию"}
			}
		} catch (error) {
			this.actions.push({
				type: "error", 
				content: {
					date_time: new Date(),
					module_name: this.module_name,
					error: error,
					args: [count_survings, date_now]
				}
			})
		}
	}
}


module.exports = CashModule