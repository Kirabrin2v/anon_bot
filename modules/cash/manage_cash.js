const sqlite = require("better-sqlite3");
const db = new sqlite("modules/cash/money.db");

const path = require("path")

const module_name = "manage_cash"

var bot_username;
var last_payers_TCA = []

var interval_send_cmds;
var interval_check_surv;
var time_last_check_surv = 0;

function initialize(constants) {
	bot_username = constants.bot_username;
	interval_check_surv = constants.interval_check_surv;
	interval_send_cmds = constants.interval_send_cmds;
	last_payers_TCA = db.prepare(`SELECT * FROM logs WHERE payee == '${bot_username}' AND currency == 'TCA' ORDER BY id DESC LIMIT 20`).all();
}

var bal_survings;

var wait_confirm_send_money = {"TCA": [], "survings": []}
var wait_confirm_send_TCA = []
var wait_confirm_send_survings = []

var wait_confirm_surv = []

var last_balance_TCA;

var actions = []

const { date_to_text } = require(path.join(__dirname,  '../text/text.js'))

function add_pay_to_bd(payer, payee, amount, currency, date_time, reason) {
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
	  if (currency == "TCA") {
		  last_payers_TCA = db.prepare(`SELECT * FROM logs WHERE payee == '${bot_username}' AND currency == 'TCA' ORDER BY id DESC LIMIT 20`).all();
	  }
}

function confirm_send_money(date, nick, currency, amount) {
	for (let i=0; i < wait_confirm_send_money[currency].length; i++) {
		let info = wait_confirm_send_money[currency][i]
		if (nick == info.nick && amount == info.amount) {
			console.log("\033[36m" + "Подтверждено" + "\033[0m", nick, amount)
			add_pay_to_bd(bot_username, nick, amount, currency, date_to_text(date), info.reason)
			wait_confirm_send_money[currency].splice(i, 1)
			break;
		}
	}


}

function survings_accept(nick, amount, reason) {
	try {
		if (reason == "Не указана") {
			reason = undefined;
		}
		
		wait_confirm_surv.push({"payer": nick, "amount": amount, "reason": reason})
		
	} catch (error) {
		actions.push({"type": "error", "content": {"date_time": new Date(), "module_name": module_name, "error": error, "args": [reason]}})
	}
}

function processing_wait_survings(last_balance, balance_now, date_now) {
	try {
		if (wait_confirm_surv.length == 0) {
			return {"is_ok": false, "message_error": "Переводов, ожидающих подтверждения, нет"}
			
		}
		let confirmed_survings = []
		let sum_transactions = 0;
		wait_confirm_surv.forEach(info => {
			let amount = info.amount;
			sum_transactions += amount;
			confirmed_survings.push({"payer": info.payer, "amount": Math.floor(amount), "reason": info.reason})

		})
		wait_confirm_surv = []
		let expected_balance = sum_transactions + last_balance;
		if (Math.round(expected_balance) == Math.round(balance_now) ) {
			confirmed_survings.forEach(pay => {
				actions.push({"type": "new_survings", "content": pay})
				add_pay_to_bd(pay.payer, bot_username, pay.amount, "survings", date_to_text(new Date()), pay.reason)
			})
			actions = actions.concat(confirmed_survings)

			return {"is_ok": true}
		} else {
			console.log("Не совпало", expected_balance, balance_now, last_balance)
			return {"is_ok": false, "message_error": "Сумма последних переводов не совпадает с текущим балансом"}
		}

	} catch (error) {
		actions.push({"type": "error", "content": {"date_time": new Date(), "module_name": module_name, "error": error, "args": [last_balance, balance_now, date_now]}})
		return {"is_ok": false, "message_error": "Возникла ошибка"}
	} 
	
}

function check_repeat_TCA(payer, amount, date) {
	let flag_find = false;
	for (let i = 0; i < last_payers_TCA.length; i++) {
		info = last_payers_TCA[i]
		if (info.payer == payer && info.date_time == date_to_text(date) && info.amount == amount) {
			flag_find = true;
			break;
		} 
	}
	if (!flag_find) {
		if (last_payers_TCA.length > 15) {
			return {"is_ok": true}
		} else {
			console.log("Недостаточно переводов")
			return {"is_ok": false, "message_error": "В базе данных недостаточно данных о переводах"}
		}

	} else {
		return {"is_ok": false, "message_error": "Перевод уже был обработан"}
	}
}



function tca_accept(logs_TCA) {
	try {
		let confirmed_TCA = []

		logs_TCA.forEach(pay_TCA => {
			let payer = pay_TCA.payer;
			if (payer == bot_username) return {"is_ok": false, "message_error": "Перевод от бота"}
			let amount = pay_TCA.amount;
			let date = pay_TCA.date;

			if (check_repeat_TCA(payer, amount, date)["is_ok"]) {
				confirmed_TCA.push({"type": "new_TCA", "content": {"payer": payer, "amount": amount}})
				add_pay_to_bd(payer, bot_username, amount, "TCA", date_to_text(date))
			}
		})
		actions = actions.concat(confirmed_TCA)

	} catch (error) {
		actions.push({"type": "error", "content": {"date_time": new Date(), "module_name": module_name, "error": error, "args": [payer, payee, amount, date]}})
	}
}

function get_actions() {
	return actions.splice(0)
}

function add_wait_send_money(nick, amount, currency, reason) {
	wait_confirm_send_money[currency].push({nick: nick,
												amount: amount,
												reason: reason})
}


function update_survings(count_survings, date_now) {
	try {
		if (date_now - time_last_check_surv >= interval_check_surv + 140) {
			time_last_check_surv = date_now

			processing_wait_survings(bal_survings, count_survings, date_now)
			bal_survings = count_survings;
			return {"is_ok": true}
		} else {
			return {"is_ok": false, "message_error": "Команда /bal прописана не по расписанию"}
		}
	} catch (error) {
		actions.push({
			type: "error", 
			content: {
				date_time: new Date(),
				module_name: module_name,
				error: error,
				args: [count_survings, date_now]
			}
		})
	}
	
}



module.exports = {module_name, initialize, survings_accept, tca_accept, update_survings, 
				add_wait_send_money, confirm_send_money, get_actions}