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

	chatSchema

} = require("./regex.js")

const { stats_split_into_pages } = require("./utils/text.js")

const { ModuleManager, CommandManager } = require("./module_manager.js")
const bus = require("./event_bus.js");

const { init, get_bot } = require('./init')

// Константы
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

const bot_password = config.get(bot_username, "bot_password")
const bot_pin = config.get(bot_username, "bot_pin")
let pin_enter = false;
let password_enter = false;

const queue_waiting_data = {"message": [], "cmd": []}

// Regexes команд, для которых парсится ответ сервера 
const regexes = [
	reg_bal_survings,
	reg_bal_TCA,

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
	reg_spawnmob_rank_error
]

const run_local_server = config.get("VARIABLES", "run_local_server") === "True"

const port_keyboard_event = Number(config.get("VARIABLES", "port_keyboard_event"))
const app = express();


// Переменные. Изменяются во время выполнения
let bot_bal_survings = 0;

const answs = [];
let cmds = [];

let location_bot;

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

function parseArgs(inputString) {
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  const args = [];
  let match;
  while ((match = regex.exec(inputString)) !== null) {
    args.push(match[1] || match[2] || match[3]);
  }
  return args;
}

function check_loc_bot() {
	const tablist = bot.tablist.header.text.split("\n")
	if (tablist.length >= 3) {
		const new_location_bot = tablist[2].split("» §b§l")[1].split(" §e§l«")[0];
		if (new_location_bot !== location_bot) {
			if (location_bot) {
				console.log(`Бот переместился с ${location_bot} на ${new_location_bot}`)
				if (!location_bot.includes("Классическое выживание") && new_location_bot.includes("Классическое выживание")) {
					// if (!timer_check_surv || timer_check_surv._destroyed) {
					// 	timer_check_surv = setTimeout(() => {bot.chat("/bal")}, interval_check_surv)
					// }
				}
				location_bot = new_location_bot;

			} else {
				location_bot = new_location_bot;
				console.log(`Бот появился на локации ${new_location_bot}`)
			}
		}
	} else {
		location_bot = tablist.join(" ");
	}
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


function check_access(cmd, args, lvl, module_cmd_access) {
	if (lvl === undefined || lvl < 0) {return false;}

	let access_object = module_cmd_access[cmd]
	if (access_object) {access_object = access_object[lvl]}

	if (!access_object) {return true;}

	const source_objects = module_cmd_access[cmd].slice(0, lvl)
	source_objects.reverse()
	for (let i=0; i < source_objects.length; i++) {
		access_object = merge_with_inherited(access_object, source_objects[i])
	}
	
	if (args.length === 0 && !access_object[""]) {return false;}

	let index_args = 0

	while (typeof access_object !== "string") {
		if (args.length === index_args) {return true;}
		access_object = access_object[args[index_args]]
		index_args++;
		if (!access_object) {return false;}

	}
	if (access_object === "access_before" && args.length === index_args) {return true;}
	if (access_object === "end") {return true;}
	return false;
	
}

function random_number(min_num, max_num) {
	return Math.floor(Math.random() * (max_num - min_num + 1)) + min_num;
}

function count(array, value) {
    return array.reduce((accumulator, currentValue) => {
        return currentValue === value ? accumulator + 1 : accumulator;
    }, 0);
}

function generate_help_message(num_page) {
	const help_list = Object.entries(modules.modules)
		.filter((elem) => CommandManager.modules_structure[elem[0]] && elem[1].cmd_processing)
		.map((elem) => [elem[0], elem[1].help])
	const info =  stats_split_into_pages(help_list, 3, num_page, "Информация о командах: ")
	if (info) {
		return info["answ"]
	} else {
		return "Ошибка"
	}
}

function check_allow_cmd(cmd, args) {
	if (args) {
		cmd = `${cmd} ${args.join(" ")}`
	}

	for (let i=0; i < masters_cmds.length; i++) {
		if (cmd.startsWith(masters_cmds[i])) {
			return true;
		}
	}
	return false
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

		} else if (type === "waiting_data") {
			queue_waiting_data["private_message"].push({module_name: module_name,
														
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
	let count_args = 1;

	if (queue_waiting_data["cmd"].length !== 0) {
		wait_cmd = queue_waiting_data["cmd"][0].cmd
	}

	const lookup = message.match(reg_lookup)

	const near = message.match(reg_near)

	const bal_TCA = message.match(reg_bal_TCA)
	const bal_survings = message.match(reg_bal_survings)

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

	if (message !== "" && !seen && !tca_accept && !bal_survings && !bal_TCA && !message.includes("Лог последних операций с баллами TCA:") && !message.match(reg_log_line)) {
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

	} else if (seen) {
		now_cmd = "seen"

		const nick = seen[1]
		const status = seen[2]
		const duration = seen_parse_time(seen[3])
		const server = seen[4]
		const position = {x: seen[5], y: seen[6], z: seen[7]}
		
		values = {nick: nick, status: status, duration: duration, server: server, position: position, location_bot: location_bot}

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
	} else if (spawnmob_help || spawnmob_region_error || spawnmob_rank_error) {
		now_cmd = "spawnmob"
	}
	if (wait_cmd) {
		let confirmed = false;
		if (now_cmd === wait_cmd.trim().split(" ").slice(0, count_args).join(" ").replace("/", "")) {
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
			if (data.content.sender === content.sender) {
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
	if (!location_bot) {
		cmds = []
		return;
	}
	if (cmds.length > 0) {
		const cmd_object = cmds.shift()
		let cmd;
		if (typeof cmd_object === "object") {
			cmd = cmd_object.cmd
		} else {
			cmd = cmd_object
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
	if (!location_bot) {return;}
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
	if (title === '"§4§l§nВведите Ваш пин-пароль"' && !pin_enter && !location_bot) {
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

	if (sender === "chat") {
		// const raw_message = message;
		const parsed = chatSchema.parse(raw_message)
		console.log(raw_message)
		if (!parsed) { /* неизвестный формат */ return }

		const { type_chat, sender } = parsed
		let { message } = parsed

		bus.emit("player_message", {
			location_bot,
			type_chat,
			sender,
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

		let rank_sender = modules.call_module("stats").get_stats(sender, "rank")
		if (seniors.includes(sender)) {
			rank_sender = 6;
		}
		if (!rank_sender) {
			rank_sender = 0;
			
		}


		const flags = []
		message = message.replace(/[c|C][m|M][d|D]/, "cmd")
		let cmd;
		let args = []
		let chat_send;
		let send_in_private_message;
		let cmd_parameters;

		if (message.toLowerCase().includes("cmd ")) {
			const flags_match = message.split("cmd ")[0].matchAll(/-([^ -]*)(?: |$)/g)
			const count_flags = 0;
			for (let flag of flags_match) {
				flag = flag[1].toLowerCase()
				if (flag === "cc") {
					chat_send = "/cc "

				} else if (flag === "pc") {
					chat_send = "/pc "

				} else if (flag === "p") {
					send_in_private_message = true;

				} else if (flag === "l") {
					chat_send = ""

				} else if (flag === "g" && (seniors.includes(sender) || rank_sender >= 6)) {

					chat_send = "!"
				} else {
					flags.push(flag)
				}
				if (count_flags === 5) {
					break;
				}
			}

			console.log("Флаги:", flags, chat_send, send_in_private_message)
			message = message.split("cmd ")[1]
			message = message.split(" ")
			cmd = message[0].toLowerCase()
			args = parseArgs(message.slice(1).join(" "))

			cmd_parameters = {
				cmd,
				rank_sender,
				seniors,
				location_bot
			}
		}
		
		if (cmd && (rank_sender !== 0 || cmd === "bank")) {
			console.log(`cmd ${cmd} args ${args}`)
			if (cmd === "help") {
				let answ;
				if (args[0] === "help") {
					answ = "Возможные аргументы: [номер страницы]"
				}
				else {
					let num_page;
					if (args.length > 0) {
						num_page = Number(args[0])
					}
					if (!num_page) {
						num_page = 1;
					}
					answ = generate_help_message(num_page)
				}

				answs.push({"recipient": sender, "message": answ})

			} else if (cmd === "test") {
				const brin = bot.players["Herobrin2v"].entity
				setInterval(() => console.log(brin.yaw, brin.pitch), 1000)

			} else if (CommandManager.modules_structure[cmd]) {
				const module_object = modules.call_module(cmd, sender)
				const valid_command = CommandManager.validate_command(module_object.module_name, args)
				if (valid_command["is_ok"]) {

					if (module_object.cmd_access && check_access(cmd, args, rank_sender, module_object.cmd_access) ||
						!module_object.cmd_access && rank_sender > 0) {

						const cooldown_info = modules.call_module("cooldown").check_cooldown(sender, cmd, args)
						if (!cooldown_info || seniors.includes(sender) || cooldown_info["is_ok"]) {
						  const actions = module_object.cmd_processing(sender, args, cmd_parameters, valid_command.args, valid_command.unused_args);

						  const update_action = {
						    type: "answ",
						    content: {
						      chat_send: chat_send,
						      send_in_private_message: send_in_private_message
						    }
						  };

						  Promise.resolve(actions)
						    .then(resolvedActions => {
						      actions_processing(resolvedActions, undefined, update_action);
						    })
						    .catch(console.error);

						} else {
						  actions_processing(cooldown_info);
						}

					} else if (rank_sender > 0) {
						answs.push({"recipient": sender, "message": "У Вас недостаточно прав"})
					}
				} else {
					answs.push({"recipient": sender, "message": valid_command["message_error"]})
				}
				
			
			} else if (check_allow_cmd(cmd, args) && masters.includes(sender)) {
				bot.chat(`${cmd} ${args.join(" ")}`)

			} else if (seniors.includes(sender)) {
				if (cmd === "js") {
					try {
						eval(args.join(" "))
					} catch (error) {
						console.log(error)
					}
				} else {
					bot.chat(`${cmd} ${args.join(" ")}`.trim())
					
				}
			} else {
				answs.push({"recipient": sender, "message": "Команда не найдена"})
			}
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
	if (!location_bot || !location_bot.includes("Классическое выживание")) {return;}
	
	bus.emit("player_joined_raw", {
		nickname: player.username,
		date_time: new Date()
	})
})


bus.on("new_actions", (event) => {
	console.log("New actions", event.actions)
	actions_processing(event.actions)
})

bot.on("update_bal_survings", (obj) => {
	bot_bal_survings = obj.amount
})


setInterval(() => {

 	if (!location_bot || !location_bot.includes("Локация Край")) {bot.chat("/swarp end")}
 }, 5000)

setInterval(check_loc_bot, 3000)

setInterval(send_answs, 2000)
setInterval(send_cmds, interval_send_cmds)

setInterval(() => cmds.push("/tca log"), 10000)
setInterval(() =>  {
	if (location_bot && location_bot.includes("Классическое выживание")) {
		bot.chat("/bal")
	}
}, 3000)

setInterval(() => cmds.push("/tca check"), 15000)
