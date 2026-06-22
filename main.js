globalThis.BASE_DIR = __dirname;

const path = require("path");
const { SocksClient } = require('socks')

const ConfigParser = require('configparser');
const config = new ConfigParser();
config.read("txt/config.ini")

const express = require("express");

const {
	reg_bal_survings,
	reg_bal_TCA,
	reg_bal_log,

	reg_near,

	reg_lookup,

	reg_vic_question,
	reg_vic_answ,
	reg_tryme_info,
	
	reg_seen,

	reg_survings_send,
	reg_TCA_send,
	reg_log_line,
	reg_tca_accept,
	reg_survings_accept,

	reg_warn,
	reg_ban,
	reg_mute,
	reg_kick,

	reg_spawnmob_help,
	reg_spawnmob_region_error,
	reg_spawnmob_rank_error,
	reg_spawnmob_success,

	reg_limbo,

	chatSchema,

	Color

} = require("./regex.js")

const { text_to_date } = require("./utils/text.js")

const { ModuleManager, CommandManager } = require("./module_manager.js")
const bus = require("./event_bus.js");

const { init, get_bot } = require('./init')

// Константы
const MC_TZ_OFFSET_MINUTES = Number(config.get("TESLA", "MC_TZ_OFFSET_MINUTES"))
const bot_username = config.get("VARIABLES", "active_nick");
globalThis.bot_username = bot_username

const proxy = {
	host: config.get("PROXY", "host"),
	port: Number(config.get("PROXY", "port")),
	type: 5,
	userId: config.get("PROXY", "login"),
	password: config.get("PROXY", "password")
}

const host = config.get("VARIABLES", "host")
const port = Number(config.get("VARIABLES", "port"))
const run_with_proxy = config.get("PROXY", "run_with_proxy") === "true";

const options = {
    host: host,
    port: port,
    maps_outputDir: "img/",
    maps_saveToFile: false,
    version: "1.12.2",
    hideErrors: true,
    username: bot_username
};

if (run_with_proxy) {
    options.connect = async (client) => {
        const info = await SocksClient.createConnection({
            proxy: proxy,
            command: 'connect',
            destination: {
                host: host,
                port: port
            }
        });

        client.setSocket(info.socket);
        client.emit('connect');
    };
}

init(options);

const bot = get_bot();

const modules = ModuleManager;

const seniors = JSON.parse(config.get("VARIABLES", "seniors")) // Полный доступ
const masters = JSON.parse(config.get("VARIABLES", "masters")) // Доступны команды из master_cmds

const tracked_block_place = JSON.parse(config.get("TESLA", "tracked_block_place"))

const masters_cmds = JSON.parse(config.get("VARIABLES", "master_cmds"))
const ignore_cmds = JSON.parse(config.get("VARIABLES", "ignore_cmds")) // Не логировать ответ от этих команд

const tesla_ranks = JSON.parse(config.get("TESLA", "ranks"))

const interval_send_cmds = config.get("VARIABLES", "interval_send_cmds")
const interval_check_surv = config.get("VARIABLES", "interval_check_surv")

const bot_password = config.get(bot_username, "bot_password")
const bot_pin = config.get(bot_username, "bot_pin")
let pin_enter = false;
let password_enter = false;

const queue_waiting_data = {"message": [], "cmd": []}

// Regexes команд, для которых парсится ответ сервера 
const regexes = [
	reg_bal_survings,
	reg_bal_TCA,
	reg_bal_log,

	reg_lookup,

	reg_vic_question,
	reg_vic_answ,
	reg_tryme_info,

	reg_seen,

	reg_survings_send,
	reg_TCA_send,
	reg_tca_accept,
	reg_survings_accept,

	reg_warn,
	reg_ban,
	reg_mute,
	reg_kick,

	reg_spawnmob_help,
	reg_spawnmob_region_error,
	reg_spawnmob_rank_error,
	reg_spawnmob_success
]

const run_local_server = config.get("VARIABLES", "run_local_server") === "true"

const port_keyboard_event = Number(config.get("VARIABLES", "port_keyboard_event"))
const app = express();


// Переменные. Изменяются во время выполнения
let empty_chat_timer;

let bot_bal_survings = 0;

const answs = [];
let cmds = [];

let bot_location;

let time_last_server_message = 0
let combine_server_message = [] // Объединение одного логического сообщения, разбитого на разные строки
let reset_wait_next_message;

// Regex, с которым проверяется сходство сообщения
let now_reg_index = 0;
let now_reg;


function module_connect(module_recipient, module_sender, json_cmd, access_lvl) {
	console.log(module_recipient, module_sender, json_cmd)
	if (typeof module_recipient === "string") {
		module_recipient = modules.modules[module_recipient]
	} 

	if (typeof module_sender === "string") {
		module_sender = modules.modules[module_sender]
	} 

	if (typeof module_recipient === "object" && (typeof module_sender === "object" || module_sender === undefined)) {
		module_recipient.module_dialogue(module_recipient, module_sender, json_cmd, access_lvl)
	} else {
		console.log("Модуль не найден", module_recipient, module_sender)
	}
}

function seen_parse_time(input) {
  const dayTimeRegex = /(?:(\d+)\sдн\.\s)?(\d{2}):(\d{2})(?::(\d{2}))?/;
  const secondsOnlyRegex = /^(\d{1,2})\sс$/;

  // Попытка распарсить "дн. чч:мм[:cc]"
  const dayTimeMatch = input.match(dayTimeRegex);
  if (dayTimeMatch) {
    const days = parseInt(dayTimeMatch[1] || '0', 10);
    const hours = parseInt(dayTimeMatch[2], 10);
    const minutes = parseInt(dayTimeMatch[3], 10);
    const seconds = parseInt(dayTimeMatch[4] || '0', 10);

    return (
      days * 86400 +
      hours * 3600 +
      minutes * 60 +
      seconds
    );
  }

  // Попытка распарсить "12 с"
  const secondsMatch = input.match(secondsOnlyRegex);
  if (secondsMatch) {
    return parseInt(secondsMatch[1], 10);
  }

  // Неизвестный формат
  console.log('Неверный формат времени: ' + input)
}



function merge_with_inherited(target, source) { // Объединение основного объекта с побочным. Если свойство существует, приоритет у свойства основного.
    let obj = source;
    while (obj) {
        Object.keys(obj).forEach(prop => {
            if (!(prop in target)) {
                target[prop] = source[prop]; // Берём из самого объекта, не из прототипа
            } else if (typeof target[prop] === "object" && typeof source[prop] === "object") {
            	target[prop] = merge_with_inherited(target[prop], source[prop])
            }
        });
        obj = Object.getPrototypeOf(obj);
    }
    return target;
}


function random_number(min_num, max_num) {
	return Math.floor(Math.random() * (max_num - min_num + 1)) + min_num;
}

function count(array, value) {
    return array.reduce((accumulator, currentValue) => {
        return currentValue === value ? accumulator + 1 : accumulator;
    }, 0);
}

async function actions_processing(actions, module_name, update_action) {
	if (!actions) {return;}
	if (!actions.length) {
		actions = [actions]
	}
	actions.forEach(action => {
		const type = action.type;
		const content = action.content;

		if (update_action && type === update_action.type) {
			for (const key in update_action.content) {
				if (key === "send_in_private_message" && !update_action.content[key]) {continue;}
				content[key] = update_action.content[key]
			}
		}
		if (type === "answ") {
			if (!content.message) {return;}
			answs.push(content)
		} else if (type === "cmd") {
			cmds.push(content)
		} else if (type === "survings") {
			send_pay(content.nick, content.amount, content.reason)
		} else if (type === "TCA") {
			send_TCA(content.nick, content.amount)
		} else if (type === "error") {
			const error = content.error
			const recipient = content.sender
			console.log(content)
			bus.emit(
				"error",
				{
					date_time: content.date_time,
					module_name: content.module_name,
					short_error: error.toString(),
					full_error: error.stack,
					args: content.args,
					sender: content.sender
				}
			)

			if (recipient) {
				actions_processing({"type": "answ", "content": {"recipient": recipient, "message": `Во время выполнения команды из ${content.module_name} произошла ошибка`}})
			}

		} else if (type === "new_survings") {
			payment_processing(content.payer, content.amount, "survings", content.reason)
		} else if (type === "new_TCA") {
			payment_processing(content.payer, content.amount, "TCA")
		
		} else if (type === "update_stats")  {
			console.log("update_stats", content)
			bus.emit("update_stats", {
				nickname: content.nickname,
				key: content.key,
				value: content.value,
				type: content.type
			})

		} else if (type === "module_request") {
			module_connect(action.module_recipient, action.module_sender, content, action.access_lvl)
		} else if (type === "wait_data") {

			queue_waiting_data[content.type].push({"time_create": new Date().getTime(), "module_name": action.module_name, "content": content})
		} else if (type === "js") {
			let is_ok = true;
			let message_error;
			try {
				eval(content.js)
			} catch (error) {
				is_ok = false;
				message_error = error.toString();
			}

			const new_content = {
				type: "answ",
				type_content: "message",
				name: "execute_js",
				old_data: content,
				is_ok,
				message_error: JSON.stringify(message_error)
			}
			module_connect(action.module_name, undefined, new_content)
		}
	})
}

function processing_server_message(sender, message, message_json) {
	let wait_cmd;
	let now_cmd;
	let values = {}
	let exclude = []
	let count_args = 1;

	if (queue_waiting_data["cmd"].length !== 0) {
		wait_cmd = queue_waiting_data["cmd"][0].cmd
	}

	const lookup = message.match(reg_lookup)

	const near = message.match(reg_near)

	const bal_TCA = message.match(reg_bal_TCA)
	const bal_survings = message.match(reg_bal_survings)
	const bal_log = message.match(reg_bal_log)

	const is_kick = message.match(reg_kick)
	const is_warn = message.match(reg_warn)
	const is_ban = message.match(reg_ban)
	const is_mute = message.match(reg_mute)

	const vic_answ = message.match(reg_vic_answ)
	const vic_question = message.match(reg_vic_question)

	const tryme_info = message.match(reg_tryme_info)

	const seen = message.match(reg_seen)

	const survings_accept = message.match(reg_survings_accept)
	const tca_accept = message.match(reg_tca_accept)
	const tca_send = message.match(reg_TCA_send)
	const survings_send = message.match(reg_survings_send)

	const spawnmob_help = message.match(reg_spawnmob_help)
	const spawnmob_region_error = message.match(reg_spawnmob_region_error)
	const spawnmob_rank_error = message.match(reg_spawnmob_rank_error)
	const spawnmob_success = message.match(reg_spawnmob_success)

	const limbo = message.match(reg_limbo)

	if (message !== "" && !seen && !tca_accept && !bal_survings && !bal_log && !bal_TCA && !message.includes("Лог последних операций с баллами TCA:") && !message.match(reg_log_line)) {
		bus.emit(
			"server_message",
			{
				date_time: new Date(),
				sender,
				message,
				message_json: JSON.stringify(message_json)
			}
		)
		console.log([message], sender)
	}

	if (["Нужно авторизоваться. Напишите в чат Ваш пароль", "Забыли пароль? Восстановите его с помощью команды /Recovery <Почта>"].includes(message)
		&& !password_enter) {
		bot.chat(`/login ${bot_password}`)
		password_enter = true;

	} else if (message === "[TeslaCraft] Уже выполняется другая телепортация.") {
		bot.chat("/hub" + random_number(1, 8))

	} else if (limbo) {
		console.log("Перезагрузка из-за лимбо")
		process.exit(-1);

	} else if (seen) {
		now_cmd = "seen"

		const nick = seen[1]
		const status = seen[2]
		const duration = seen_parse_time(seen[3])
		const server = seen[4]
		const position = {x: seen[5], y: seen[6], z: seen[7]}
		
		values = {nick: nick, status: status, duration: duration, server: server, position: position, bot_location: bot_location}

	} else if (near) {
		now_cmd = "near"

		const nick_and_distances = near[1] // [nick1(Nm), nick2(Nm), ...] ИЛИ "ничего"

		values = {nick_and_distances: nick_and_distances}
		
	} else if (survings_accept) {
		const nick = survings_accept[1]
		const donate_sum = Number(survings_accept[2].replaceAll(",", ""))
		const reason = survings_accept[3]
		console.log(nick, donate_sum, reason)
		bus.emit(
			"survings_accept_raw",
			{
				nickname: nick,
				amount: donate_sum,
				reason
			}
		)

	} else if (tca_send) {
		now_cmd = "tca transfer"
		count_args = 2

		const cash = Number(tca_send[1])
		const nick = tca_send[2]
		bus.emit(
			"sended_tca",
			{
				date_time: new Date(),
				nickname: nick,
				amount: cash
			}
		)

	} else if (survings_send) {
		now_cmd = "pay"

		const cash = Number(survings_send[1].replaceAll(",", ""))
		const nick = survings_send[2]
		bus.emit(
			"sended_survings",
			{
				date_time: new Date(),
				nickname: nick,
				amount: cash
			}
		)

	}  else if (tca_accept) {
		now_cmd = "tca log"
		count_args = 2
		const tca_logs = []
		for (let i=0; i < 15; i++) {
			const date_time = tca_accept[i*5 + 1]
			const [day, month, year] = date_time.split(" ")[0].split(".")
			const [hours, minutes, seconds] = date_time.split(" ")[1].split(":")
			const date = new Date()
			date.setYear(year)
			date.setMonth(month)
			date.setDate(day)
			date.setHours(hours)
			date.setMinutes(minutes)
			date.setSeconds(seconds)
			
			const action = tca_accept[i*5 + 2]
			const amount = Number(tca_accept[i*5 + 3])
			const _balance_TCA = Number(tca_accept[i*5 + 4])
			const nickname = tca_accept[i*5 + 5]
			let payer, payee;
			if (action === "+") {
				payer = nickname;
				payee = bot_username;

			} else {
				payer = bot_username;
				payee = nickname;
			}
			tca_logs.push({payer: payer, payee: payee, amount: amount, date: date})
		}
		bus.emit(
			"tca_accept_raw",
			{
				tca_logs
			}
		)

	} else if (bal_TCA) {
		now_cmd = "tca check"
		count_args = 2

		const bal_TCA_raw = Number(bal_TCA[1])

		bus.emit(
			"update_bal_tca_raw",
			{
				date_time: new Date(),
				amount: bal_TCA_raw
			}
		)

	} else if (bal_survings) {
		now_cmd = "bal"
		exclude = ["bal log"]

		// if (!timer_check_surv || timer_check_surv._destroyed) {
		// 	timer_check_surv = setTimeout(() => {bot.chat("/bal")}, interval_check_surv)
		// }
		
		const bal_survings_raw = Number(bal_survings[1].replace(/,/g, ""))
		bus.emit(
			"update_bal_survings_raw",
			{
				date_time: new Date(),
				amount: bal_survings_raw
			}
		)
	} else if (bal_log) {
		now_cmd = "bal log"
		count_args = 2
		values = []
		const GROUPS_PER_ROW = 6
		for (let i = 1; i < bal_log.length; i += GROUPS_PER_ROW) {
			const [date, time, reason, nickname, direction, amount] = bal_log.slice(i, i + GROUPS_PER_ROW)
			let sender, recipient;
			// Парсим как "наивную" дату, цифры которой относятся к TZ Minecraft-сервера
			const naive = text_to_date(`${date} ${time}`, 'DD.MM.YYYY HH:mm:ss')
			// Конвертируем в корректный момент времени (UTC), вычитая смещение MC-сервера
			const date_time = new Date(Date.UTC(
				naive.getFullYear(),
				naive.getMonth(),
				naive.getDate(),
				naive.getHours(),
				naive.getMinutes(),
				naive.getSeconds()
			) - MC_TZ_OFFSET_MINUTES * 60000)
			if (direction === "+") {
				sender = nickname
				recipient = bot_username
			} else {
				sender = bot_username
				recipient = nickname
			}
			values.push({
				sender,
				recipient,
				reason: reason === "Не указана" ? undefined : reason,
				amount: Number(amount.replace(/,/g, "")),
				date_time
			})
		}

	} else if (is_kick || is_warn || is_ban || is_mute) {
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
		const punishment_data = {
			is_kick: is_kick,
			is_ban: is_ban,
			is_warn: is_warn,
			is_mute: is_mute,
			violator: violator,
			guardian: guardian,
			reason: reason,
			period: period
		}
		bus.emit("new_punishment", {
			message,
			punishment_data,
			date_time: new Date()
		})

	} else if (lookup) {
		now_cmd = "lookup"

		const nickname = lookup[1]
		const online = lookup[2] === "Онлайн"
		const rank = tesla_ranks.indexOf(lookup[3])
		const clan = lookup[4]
		const active_ban = lookup[5]
		const active_mute  = lookup[6]
		const date_reg = lookup[7]
		const date_last_online = lookup[8]
		const location_player = lookup[9]
		const count_bans = lookup[10]
		const count_kicks = lookup[11]
		const count_mutes = lookup[12]
		const count_warns = lookup[13]
		const last_warn_1 = lookup[14]
		const last_warn_2 = lookup[15]
		const last_warn_3 = lookup[16]
		
		const _lookup_data = {
			nickname,
			online,
			rank,
			clan,
			active_ban,
			active_mute,
			date_reg,
			date_last_online,
			location_player,
			count_bans,
			count_kicks,
			count_mutes,
			count_warns,
			last_warns: [last_warn_1, last_warn_2, last_warn_3]
		}

	} else if (tryme_info) {
		now_cmd = "tryme info"
		count_args = 2

		const already_answered = tryme_info[1] === "True"
		const category_difficulty = tryme_info[2]
		const time_to_next_quest = tryme_info[3]
		const number_quest = Number(tryme_info[4])
		const question = tryme_info[5]


		values = {
			already_answered: already_answered,
			category_difficulty: category_difficulty,
			time_to_next_quest: time_to_next_quest,
			number_quest: number_quest,
			question: question
			}

	} else if (vic_answ) {

	} else if (vic_question) {
		let type_question, question;

		if (vic_question[1]) {
			type_question = "anagram"
			question = vic_question[1]

		} else if (vic_question[2]) {
			type_question = "fast"
			question = vic_question[2]

		} else if (vic_question[3]) {
			type_question = "example"
			question = vic_question[3]

		} else if (vic_question[4]) {
			type_question = "quest"
			question = vic_question[4]
		}

		bus.emit(
			"server_quiz_question",
			{
				type_question,
				question
			}
		)
	} else if (spawnmob_help || spawnmob_region_error || spawnmob_rank_error || spawnmob_success) {
		now_cmd = "spawnmob"
	}
	if (wait_cmd) {
		let confirmed = false;
		if (
			now_cmd === wait_cmd.trim().split(" ").slice(0, count_args).join(" ").replace("/", "")
			&& !exclude.includes(wait_cmd.replace("/", ""))
		) {
			confirmed = true;
		}
		wait_data_processing("cmd", {server_answ: message, values: values, is_confirmed: confirmed})
	}

}

function wait_data_processing(type, content) {
	for (let i=0; i < queue_waiting_data[type].length; i++) {
		const data = queue_waiting_data[type][i]

		if (data.time_create && new Date().getTime() - data.time_create > 300000) {
			queue_waiting_data[type].splice(i, 1)
			continue;
		}
		if (type === "message") {
			if (data.content.sender.toLowerCase() === content.sender.toLowerCase()) {
				const in_private_message = data.content.private_message
				const pattern = data.content.pattern
				const message = content.message
				if (!in_private_message || content.private_message) {
					if (!pattern || message.match(pattern)) {
						const module_object = modules.modules[data.module_name]
						if (module_object) {
							module_object.message_processing(content.sender, message, content.type_chat)
							queue_waiting_data[type].splice(i, 1)
							break;
						} else {
							console.log("Модуль не найден")
						}

					}
				}
			}
		} else if (type === "cmd") {
			const module_object = modules.modules[data.module_sender]
			if (module_object) {
				module_object.server_answ_processing(data.cmd, content.server_answ, content.values, data.identifier, content.is_confirmed)
			}
			queue_waiting_data[type].splice(i, 1)
			break;
		}
	}
}

function payment_processing(nick, cash, currency, reason) {
	console.log(`Перевод ${cash} ${currency} от ${nick} с причиной ${reason}`)
	if (modules.call_module("casino").payment_processing(nick, cash, currency, reason)["used"]) {
		
	} else if (modules.call_module("bank").payment_processing(nick, cash, currency, reason)["used"]) {
		
	} else if (modules.call_module("stats").payment_processing(nick, cash, currency, reason)["used"]) {
		
	} else {
		if (currency === "TCA") {
			send_TCA(nick, cash)
		} else {
			send_pay(nick, cash, "Платёж почему-то не обработался. Повторите попытку")
		}
	}
}

function send_TCA(nick, amount) {
	cmds.push(`/tca transfer ${nick} ${amount}`)
	cmds.push(`/confirm`)
	modules.call_module("manage_cash").add_wait_send_money(nick, amount, "TCA")
}

function send_pay(nick, amount, reason="") {
	cmds.push(`/pay ${nick} ${amount} ${reason}`.slice(0, 255))
	setTimeout(() => cmds.push(`/pay confirm`), 10)
	
	modules.call_module("manage_cash").add_wait_send_money(nick, amount, "survings", reason)
}

function send_cmds() {
	if (cmds.length > 0) {
		const cmd_object = cmds.shift()
		let cmd;
		if (typeof cmd_object === "object") {
			cmd = cmd_object.cmd
		} else {
			cmd = cmd_object
		}
		const bot_location = modules.call_module("move").get_bot_location()
		if (!bot_location && !masters_cmds.includes(cmd)) {
			return;
		}

		if (count(cmds, cmd_object) > 5) {
			console.log("Очищено", cmd_object, count(cmds, cmd_object))
			cmds = cmds.filter((value) => value !== cmd_object)
		}

		if (!ignore_cmds.includes(cmd.split(" ").slice(0, ).join(" ")) && !ignore_cmds.includes(cmd.split(" ")[0])) {
			console.log("\033[36m" + cmd + "\033[0m")
			//add_msg_to_bd(nickname=bot_username, type_chat = 'Скрипт', message=cmd)
		}

		if (cmd.length > 255) {return;}
		//if (!cmd.match(/^\/[ 0-9A-zА-яёЁ!@#$%^&*\-_+=]{1,255}$/)) {return;}

		bot.chat(cmd.trim())
		if (cmd_object.module_sender) {
			setTimeout(() => queue_waiting_data["cmd"].push(cmd_object), 20)
		}
	}
}


function send_answs() {
	const bot_location = modules.call_module("move").get_bot_location()
	if (!bot_location) {return;}
	if (answs.length > 0) {
		const answ = answs.shift()
		let message;
		if (typeof answ === "object") {
			const recipient = answ.recipient;
			let sender = answ.sender;
			if (sender === undefined) {
				sender = recipient;
			}
			message = answ.message;
			if (!message || message === "") {return;}

			let send_in_private_message = answ.send_in_private_message;
			if (send_in_private_message === undefined) {
				send_in_private_message = true;
			}
			if (!recipient) {
				send_in_private_message = false
			}

			let chat_send = answ.chat_send
			if (chat_send !== undefined) {
				send_in_private_message = false
			} else {
				chat_send = ""
			}
			
			if (chat_send === "Пати-чат") {
				chat_send = "/pc "
			} else if (chat_send === "Клан-чат") {
				chat_send = "/cc "
			} else if (chat_send === "Гл") {
				chat_send = "!"
			} else if (chat_send === "Лк") {
				chat_send = ""
			} else if (chat_send === "Приват") {
				send_in_private_message = true
			}


			const spec_symbols = answ.spec_symbols;
			const prefix = answ.prefix;

			//let send_full_message;
			console.log("Ансв", answ)
			console.log("\033[36m" + message + "\033[0m")
			message = message.replaceAll("\n", " ").replaceAll("\t", " ")

			if (recipient) {

				if (message[0] === "/") {
					message = message.replace("/", "\\")
				}
				if (spec_symbols) {
					
		            if (spec_symbols.includes("^")) {
						send_in_private_message = true;
					}

					if (seniors.includes(sender) && spec_symbols.includes("*")) {
						send_in_private_message = false;
					}
				}

				if (!send_in_private_message) {
					let alias;
		            
		            if (modules.call_module("stats").get_stats(sender)) {
		            	alias = modules.call_module("stats").get_stats(sender, "name")
		            }
				    if (!alias || alias === null) {
					    alias = recipient;
				    }
				    message = `${alias}, ${message}`
				}
			}
			if (prefix) {
				message = `${prefix} ${message}`
			}

			console.log(`${recipient}'у: ${message}`, send_in_private_message, chat_send)
			if (send_in_private_message) {
				message = Color.reset(message)
				if (bot_bal_survings >= 0.01 && bot.players[sender] && bot.players[sender].entity !== undefined) {
					send_pay(recipient, 0.01, message)

				} else {
					bot.chat(`/m ${recipient} ${message}`.slice(0, 255))	
				}
				
			} else if (message.length >= 255) {
				bot.chat(`${chat_send}[СБС]${message}`.slice(0, 255))

			} else {
				bot.chat(`${chat_send}${message}`)
			}
		}
	}
}


bot.on('windowOpen', function wnd (window, _info) {
	const title = window.title
	const bot_location = modules.call_module("move").get_bot_location()
	if (title === '"§4§l§nВведите Ваш пин-пароль"' && !pin_enter && !bot_location) {
		bot.chat(bot_pin)
		pin_enter = true;
		console.log("Пин-код введён")
	}
	console.log(`Окно открылось ${title}`)
})

bot.on('entitySpawn', (entity) => {
	if (entity.type === "player") {
		const nick = entity.username
		if (bot.players[nick]) {
			const url = bot.players[nick].skinData?.url
			if (url) {
				bus.emit(
					"player_spawn",
					{
						player: bot.players[nick]
					}
				)
			}
		}
	}
})

modules.load_modules(
	modules.find_modules(
		path.join(__dirname, "modules")
	)
)

if (run_local_server) {
	app.use(express.json()); // Чтобы парсить JSON
	app.post("/keyboard_event", (req, res) => {
	    const data = req.body;
	    const key = data["key"]
	    const action = data["action"]
	    modules.call_module("ручуп").control_state_with_keyboard(key, action === "down")
	    res.send({ status: "OK"});
	})
	app.post("/mouse_event", (req, res) => {
	    const data = req.body;
	    const delta_x = data["delta_x"]
	    const delta_y = data["delta_y"]
	    modules.call_module("ручуп").control_head_with_pixels(delta_x, delta_y)
	    res.send({ status: "OK" });
	});
	app.listen(port_keyboard_event, "0.0.0.0", () => {
	    console.log(`HTTP сервер запущен на порту ${port_keyboard_event}`);
	});
}

bot.on("blockUpdate" , function blocks (oldBlock, newBlock) {
	if (["flowing_water", "flowing_lava"].includes(oldBlock.name) || ["flowing_water", "flowing_lava"].includes(newBlock.name)) {return;}
	if (oldBlock.name === "air") {
		if (oldBlock.name === newBlock.name) {return;}

		if (oldBlock.name === "air" && tracked_block_place.includes(newBlock.name)) {
			const block_position = oldBlock.position;
			const nearby_players = modules.call_module("entities").get_players_and_distance(bot, block_position);
			let nick, distance;
			for (let i = 0; i < nearby_players.length; i++) {
				[nick, distance] = nearby_players[i];
				if (bot.players[nick] && bot.players[nick].entity &&  
					(bot.players[nick].entity.equipment[0] && bot.players[nick].entity.equipment[0].name === newBlock.name ||
					 bot.players[nick].entity.equipment[1] && bot.players[nick].entity.equipment[1].name === newBlock.name)) {
					break;
				
				} else {
					nick = undefined;
					distance = undefined;
				}
			}

			if (!distance || distance > 6) {
				nick = undefined;
			}

			bus.emit(
				"block_placed",
				{
					block: newBlock,
					old_block: oldBlock,
					nick: nick
				}
			)
		}
	}
})

bot.on('messagestr', (raw_message, sender, message_json) => {
	if (!raw_message || !sender) {return;}
	const parsed = chatSchema.parse(raw_message)

	if (parsed) {
		clearTimeout(empty_chat_timer)

	    // Запускаем новый
	    empty_chat_timer = setTimeout(() => {
	        console.log('Перезапуск из-за отсутствия чата на протяжении получаса')
	        process.exit(-1)
	    }, 30 * 60 * 1000)

		// const raw_message = message;
		console.log(raw_message, parsed)
		const { type_chat, sender, recipient } = parsed
		let { message } = parsed

		const bot_location = modules.call_module("move").get_bot_location()
		bus.emit("player_message", {
			bot_location,
			type_chat,
			sender,
			recipient,
			message,
			raw_message,
			message_json: JSON.stringify(message_json.json),
			date_time: new Date()
		})

		wait_data_processing("message", {
			type_chat,
			message,
			sender,
			private_message: type_chat === "Приват"
		})

		//console.log(`[${type_chat}] ${sender}: ${message}`)
 		console.log(`[${type_chat}]` + "\033[32m " + sender + ":\033[33m " + message + "\033[0m")
 		// if (sender === bot_username) {return;}
		

		if (message.toLowerCase().includes("cmd ")) {
			modules.call_module("command_handler").handle(sender, message)
		}

	} else {
		const delta_time = new Date().getTime() - time_last_server_message
		time_last_server_message = new Date().getTime()
		if (reset_wait_next_message) {
			clearTimeout(reset_wait_next_message)
		}

		reset_wait_next_message = setTimeout(() => {
			if (combine_server_message.length === 0) {return;}
			processing_server_message(sender, combine_server_message.join("\n"), message_json)
			combine_server_message = []
		}, 80)

		if (delta_time < 70 || combine_server_message.length === 0) {
			if (now_reg) {
				const reg_lines = now_reg.source.split("\n")
				const reg_line = reg_lines[now_reg_index]
				if (raw_message.match(reg_line)) {
					if (now_reg_index+1 === reg_lines.length) {
						processing_server_message(sender, combine_server_message.join("\n"), message_json)
						combine_server_message = []
						now_reg = undefined;
						now_reg_index = 0;
					} else {
						combine_server_message.push(raw_message)
						now_reg += 1;
					}
				} else {
					processing_server_message(sender, combine_server_message.join("\n"), message_json)
					combine_server_message = [raw_message]
					now_reg_index = 0;
					now_reg = undefined;
				}
			} else {
				let is_matched = false;
				for (let i = 0; i < regexes.length; i++) {
					const reg_lines = regexes[i].source.split("\n")
					const reg_line = reg_lines[0]
					if (raw_message.match(reg_line)) {
						if (combine_server_message.length !== 0) {
							processing_server_message(sender, combine_server_message.join("\n"), message_json)
						}
						if (reg_lines.length === 1) {
							processing_server_message(sender, raw_message, message_json)
						} else {
							combine_server_message.push(raw_message)
							now_reg = regexes[i]
							now_reg_index = 1;
						}
						is_matched = true;
					}
				}
				if (!is_matched) {
					combine_server_message.push(raw_message)
				}
			}

			

		} else {
			combine_server_message.push(raw_message)
			processing_server_message(sender, combine_server_message.join("\n"), message_json)
			combine_server_message = []
		}
	}
})


bot.on('playerJoined', (player) => {
	const bot_location = modules.call_module("move").get_bot_location()
	if (!bot_location || !bot_location.includes("Классическое выживание")) {return;}
	
	bus.emit("player_joined_raw", {
		nickname: player.username,
		date_time: new Date()
	})
})


bus.on("new_actions", (event) => {
	// console.log("New actions", event.actions)
	actions_processing(event.actions, event.module_name, event.update_action)
})

bot.on("update_bal_survings", (obj) => {
	bot_bal_survings = obj.amount
})


setTimeout(() => {
	const bot_location = modules.call_module("move").get_bot_location()
 	if (!bot_location || !bot_location.includes("Локация Край")) {bot.chat("/swarp end")}
 }, 5000)


setInterval(send_answs, 2000)
setInterval(send_cmds, interval_send_cmds)

setInterval(() => cmds.push("/tca log"), 10000)
setInterval(() =>  {
	const bot_location = modules.call_module("move").get_bot_location()
	if (bot_location && bot_location.includes("Классическое выживание")) {
		bot.chat("/bal")
	}
}, interval_check_surv)

setInterval(() => cmds.push("/tca check"), 15000)
