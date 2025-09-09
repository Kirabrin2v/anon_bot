const mineflayer = require("mineflayer");
const maps = require("mineflayer-maps");

const ConfigParser = require('configparser');
const config= new ConfigParser();
config.read("txt/config.ini")

const express = require("express");

const bot_username = "anon_bot";
const bot = mineflayer.createBot({
    host: "mnrt.teslacraft.org",
    port: "25565",
    maps_outputDir: "img/",
    maps_saveToFile: false,
    version: "1.12.2",
    hideErrors: true,
    username: bot_username});
bot.loadPlugin(maps.inject)

const price_TCA = config.get("VARIABLES", "price_TCA")

const interval_send_cmds = 900;
const interval_check_surv = 5000;

const bot_password = config.get(bot_username, "bot_password")
const bot_pin = config.get(bot_username, "bot_pin")
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


const queue_waiting_data = {"message": [], "cmd": []}

//const sqlite = require("better-sqlite3");
//const db = new sqlite("txt/players_stats.db");
const CommandManager = require("./command_engine.js")
console.log(CommandManager)
class ModuleManager {
	constructor () {
		this.modules = {}

	}
	async load_modules(modules_info) {
		const load_promises = modules_info.map(async (module_info) => {
			const path = module_info[0]
			let parameters, mod;
			try {
				parameters = module_info[1]
				mod = require(path)
				//console.log("реквайр", mod)
				if (mod.initialize) {
					mod.initialize(parameters)
				}
				if (mod.structure) {
					CommandManager.modules_structure[mod.module_name] = mod.structure
					CommandManager.modules_structure[mod.module_name]._description = mod.help
				}
				this.modules[mod.module_name] = mod
				console.log(`${mod.module_name} успешно импортирован\n`)
			
			} catch (error) {
				if (!mod) mod = {}
				console.log(`При импортировании модуля '${path}' возникла ошибка: ${error}`)
				actions_processing({
									type: "error",
									content: {
										date_time: new Date(),
										module_name: mod.module_name || path,
										error: error,
									}
								})
			}
		})
		await Promise.all(load_promises)
	}
	call_module(module_name, initiator) {
		const mod = this.modules[module_name]
		if (mod) {
			return new Proxy(mod, {
				get(target, prop) {
					const value = target[prop]

					if (typeof value === 'function') {
						return (...args) => {
							try {
								return value(...args)
							} catch (error) {
								actions_processing({
									type: "error",
									content: {
										date_time: new Date(),
										module_name: module_name,
										error: error,
										args: args,
										sender: initiator
									}
								})
								console.error(`[${initiator}] Ошибка при вызове ${prop} из модуля ${module_name}:`, error)
							}
						}
					} else {
						return value // просто значение, если не функция
					}
				}
			})

		} else {
			console.log(`Модуля ${module_name} не существует`)
		}
		return new Proxy({}, {
			get(target, prop) {
				// Если кто-то попытается вызвать любую функцию на несуществующем модуле
				return (...args) => {
					console.warn(`[${initiator || "system"}] Попытка вызвать метод "${prop}" у незагруженного модуля "${module_name}" с аргументами:`, args)
					return undefined
				}
			}
		})
	}
}

// const text = require("./modules/text/text.js")

const modules = new ModuleManager()
modules.load_modules([
	["./modules/text/text.js"],

	["./modules/choice/choice.js"],

	["./modules/detector/detector.js"],

	["./modules/players_stats/stats.js"],

	["./modules/bank/bank.js"],

	["./modules/casino/casino.js"],

	["./modules/combine_nicks/combine.js"],

	["./modules/SAGO/SAGO.js"],

	["./modules/cooldown/cooldown.js"],

	["./modules/logging/logging.js"],

	["./modules/quotes/quotes.js"],

	["./modules/party/party.js"],

	["./modules/lurking/lurking.js"],

	["./modules/alias/alias.js"],

	["./modules/who/who.js"],

	["./modules/chance/chance.js"],

	["./modules/quiz/quiz.js"],

	["./modules/flags/flags.js"],

	["./modules/skinnaper/skinnaper.js"],

	["./modules/move/move.js", {"bot": bot}],

	["./modules/cash/manage_cash.js", {
			bot_username: bot_username,
			interval_check_surv: interval_check_surv,
			interval_send_cmds: interval_send_cmds
	}],

	["./modules/telegram/telegram.js"],

])

modules.load_modules([
	["./modules/site_connect/site_connect.js", {"structures": CommandManager.modules_structure}]
])
// console.log(modules.modules)
// const players_stats = require("./modules/players_stats/stats.js")

// const bank = require("./modules/bank/bank.js")

// const casino = require("./modules/casino/casino.js")

// const combine_nicks = require("./modules/combine_nicks/combine.js")

// const SAGO = require("./modules/SAGO/SAGO.js")

// const cooldown = require("./modules/cooldown/cooldown.js")

// const logging = require("./modules/logging/logging.js")

// const quotes = require("./modules/quotes/quotes.js")

// const party = require("./modules/party/party.js")

// const lurking = require("./modules/lurking/lurking.js")

// const alias = require("./modules/alias/alias.js")

// const who = require("./modules/who/who.js")

// const chance = require("./modules/chance/chance.js")

// const quiz = require("./modules/quiz/quiz.js")

// const flags_info = require("./modules/flags/flags.js")

// const skinnaper = require("./modules/skinnaper/skinnaper.js")

// const move = require("./modules/move/move.js")
// move.initialize({
// 	bot: bot
// })

var timer_check_surv;

// const interval_send_cmds = 900;
// const interval_check_surv = 5000;
// const manage_cash = require("./modules/cash/manage_cash.js")
// manage_cash.initialize({
// 	bot_username: bot_username,
// 	interval_check_surv: interval_check_surv,
// 	interval_send_cmds: interval_send_cmds
// })
// const tg = require("./modules/telegram/telegram.js")

// const module_names = {"bank": bank, "cash": manage_cash, "casino": casino, "combine_nicks": combine_nicks, 
// 					"cooldown": cooldown, "loggng": logging, "lurking": lurking, "party": party, "stats": players_stats,
// 					"quotes": quotes, "SAGO": SAGO, "telegram": tg, "text": text, "alias": alias, "skinnaper": skinnaper, "move": move, "quiz": quiz}

// const cmd_processing = {"flags": flags_info, "шанс": chance, "викторина": quiz, "кто": who, "nick": alias, "bank": bank, "скрести": combine_nicks, "casino": casino, "grief": SAGO, "stats": players_stats,
// 					"цитата": quotes, "party": party, "skinnaper": skinnaper, "ручуп3": move}

const seniors = ["Herobrin2v"]
const masters = ["DeX_Xth", "Herobrin2v"]

const masters_cmds = ["/swarp", "/warp", "/top"]

var bot_bal_survings = 0;
var bot_bal_TCA = 0;

var answs = [];
var cmds = [];

var all_players = {};

var time_last_send_cmd = {}

const ignore_cmds = ["/tca log", "/tca check", "/bal", "/seen"]

const tesla_ranks = [undefined, "Рядовой", "Ефрейтор", "Мл. Сержант", "Сержант", "Ст. Сержант", "Прапорщик",
					"Ст. Прапорщик", "Лейтенант", "Ст. Лейтенант", "Капитан", "Майор",
					"Подполковник", "Полковник", "Генерал", "Маршал", "Император"]

var location_bot;

const reg_bal_survings = new RegExp(String.raw`^Ваш баланс сурвингов: \$([0-9,]{1,10}\.[0-9]{0,2})`)
const reg_bal_TCA = new RegExp(String.raw`^Баланс баллов TCA: ([0-9]{1,5})`)

const reg_nickname = String.raw`([А-яA-Za-z0-9~!@#$^*\-_=+ёЁ]{1,16})`;
const reg_message = String.raw`(.{1,256})`;
const reg_me_send = new RegExp(`^\\[${reg_nickname} -> Мне\\] ${reg_message}`)
const reg_i_send = new RegExp(`^\\[Я -> ${reg_nickname}\\] ${reg_message}`)

const reg_encrypted_ip = String.raw`[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}`;
const reg_lookup = new RegExp(`^ஜ♒♒♒  ${reg_nickname} \\| ${reg_encrypted_ip}  ♒♒♒ஜ\n ` +
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

const reg_vic_anagrams = String.raw`\[Викторина\] Расшифруйте первым анаграмму (.*) , чтобы выиграть!`
const reg_vic_fast = String.raw`\[Викторина\] Напечатайте первым "(.*)", чтобы выиграть!`
const reg_vic_example = String.raw`\[Викторина\] Решите первым пример (.*), чтобы выиграть!`
const reg_vic_quest = String.raw`\[Викторина\] (.*)`

const reg_vic_question = new RegExp("^\\[Викторина\\] Для ответа используйте команду /Answ <Ответ>\n" +
									`(?:(?:${reg_vic_anagrams})|(?:${reg_vic_fast})|(?:${reg_vic_example})|(?:${reg_vic_quest}))`)

const reg_vic_answ = new RegExp("^[Викторина] Для ответа используйте команду /Answ <Ответ>\n" +
								"[Викторина] Время для ответа закончилось. Правильный ответ: (.*)")

const reg_tryme_info = new RegExp("^\\*{61}\n" + 
String.raw`Всего вопросов: [0-9]*\n` +
String.raw`Ответов: (True|False)\n` +
String.raw`Категория: (Custom|Easy|Normal|Medium|Hard|Default)\n` +
String.raw`Прошло времени до ответа: ([0-9]{1,3}\.[0-9]{1,2}) sec\n` +
String.raw`До следущего вопроса: [0-9]{1,3}\.[0-9]{1,2} sec\n` +
String.raw`Номер вопроса: ([0-9]|none)\n` +
String.raw`Вопрос: (.*)\n` +
"\\*{61}")

const reg_seen = new RegExp(`^${reg_nickname} (Онлайн|Офлайн) в течение ((?:(?:[0-9]* дн\\. )?[0-9]{2}:[0-9]{2}(?::[0-9]{2})?)|(?:[0-9]{1,2} с))\\n` + 
	`Сервер (.*)\\. Координаты: Мир [^ ,.]*, (\\-?[0-9]+), (\\-?[0-9]+), (\\-?[0-9]+)`)

const reg_survings_send = new RegExp(`^\\$([0-9,]*\\.[0-9]*) отправлено игроку ${reg_nickname}`)
const reg_TCA_send = new RegExp(`^Вы перевели ([0-9]*) балл(?:а||ов){1,2} TCA игроку ${reg_nickname}`)

const reg_log_line = String.raw`\- ([0-9]{2}\.[0-9]{2}\.[0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}) (\+|\-)([0-9]{1,5}) TCA \(([0-9]{1,5}) TCA\) Передача баллов (?:от игрока|игроку) ${reg_nickname}`
const reg_tca_accept = new RegExp(`^Лог последних операций с баллами TCA:\n` +
								(reg_log_line + "\n").repeat(15).slice(0, -1)
								)

const reg_survings_accept = new RegExp(`^${reg_nickname} отправил Вам \\$([0-9,]*\\.[0-9]*)\n` +
										"Причина: (.*)")
//const reg_survings_reason = "^Причина: (.*)"

const reg_warn = new RegExp(`^${reg_nickname} был предупреждён блюстителем ${reg_nickname}\\.\nПричина: (.*)`)
const reg_ban = new RegExp(`^${reg_nickname} был забанен на (.*) блюстителем ${reg_nickname}\\.\nПричина: (.*)`)
const reg_mute = new RegExp(`^Выдан временный мут игроку ${reg_nickname} на (.*) блюстителем ${reg_nickname}\\.\nПричина: (.*)`)
const reg_kick = new RegExp(`^${reg_nickname} был кикнут с сервера блюстителем ${reg_nickname}\\.\nПричина: (.*)`)

regexes = [
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
	reg_kick
]

port_keyboard_event = config.get("VARIABLES", "port_keyboard_event")
const app = express();
app.use(express.json()); // Чтобы парсить JSON

app.post("/keyboard_event", (req, res) => {
    //console.log("Получено:", req.body);
    if (false) return;


    const data = req.body;
    const key = data["key"]
    const action = data["action"]
    modules.call_module("ручуп").control_state_with_keyboard(key, action=="down")
    res.send({ status: "OK"});
})
app.post("/mouse_event", (req, res) => {
	if (false) return;

	
    const data = req.body;
    const delta_x = data["delta_x"]
    const delta_y = data["delta_y"]
    modules.call_module("ручуп").control_head_with_pixels(delta_x, delta_y)
    res.send({ status: "OK" });
});


app.listen(port_keyboard_event, "0.0.0.0", () => {
    console.log(`HTTP сервер запущен на порту ${port_keyboard_event}`);
});

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
	let tablist = bot.tablist.header.text.split("\n")
	if (tablist.length >= 3) {
		let new_location_bot = tablist[2].split("» §b§l")[1].split(" §e§l«")[0];
		if (new_location_bot != location_bot) {
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
				modules.call_module("telegram").start()
			}
		} else {
			location__bot = tablist.join(" ");
		}
	}
}

function merge_with_inherited(target, source) { //Объединение основного объекта с побочным. Если свойство существует, приоритет у свойства основного.
    let obj = source;
    while (obj) {
        Object.keys(obj).forEach(prop => {
            if (!(prop in target)) {
                target[prop] = source[prop]; // Берём из самого объекта, не из прототипа
            } else if (typeof target[prop] == "object" && typeof source[prop] == "object") {
            	target[prop] = merge_with_inherited(target[prop], source[prop])
            }
        });
        obj = Object.getPrototypeOf(obj);
    }
    return target;
}


function check_access(cmd, args, lvl, module_cmd_access) {
	if (lvl == undefined || lvl < 0) return false;

	let access_object = module_cmd_access[cmd]
	if (access_object) access_object = access_object[lvl]

	if (!access_object) return true;

	let source_objects = module_cmd_access[cmd].slice(0, lvl)
	source_objects.reverse()
	for (let i=0; i < source_objects.length; i++) {
		access_object = merge_with_inherited(access_object, source_objects[i])
	}
	
	if (args.length == 0 && !access_object[""]) return false;

	let index_args = 0

	while (typeof access_object != "string") {
		if (args.length == index_args) return true;
		access_object = access_object[args[index_args]]
		index_args++;
		if (!access_object) return false;

	}
	if (access_object == "access_before" && args.length == index_args) return true;
	if (access_object == "end") return true;
	return false;
	
}

function random_number (min_num, max_num) {
	return Math.floor(Math.random() * (max_num - min_num + 1)) + min_num;
}

function random_choice(array) {
	return array[Math.floor(Math.random() * array.length)]
}

function count(array, value) {
    return array.reduce((accumulator, currentValue) => {
        return currentValue === value ? accumulator + 1 : accumulator;
    }, 0);
}

function generate_help_message(num_page) {
	const help_list = Object.entries(modules.modules)
		.filter((elem) => elem[1].cmd_processing)
		.map((elem) => [elem[0], elem[1].help])
	const info =  modules.call_module("text").stats_split_into_pages(help_list, 3, num_page, "Информация о командах: ")
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

function update_all_players() {
	if (!location_bot || !location_bot.includes("Классическое выживание")) return;
	all_players = bot.players
	modules.call_module("lurking").update_players_list(Object.keys(all_players))
}

function get_players_on_loc() {
	let players = Object.keys(bot.players)
	let players_on_loc = players.filter((nick) => {
		return bot.players[nick] && bot.players[nick].displayName.text != ''
	})
	return players_on_loc
}

function get_players_and_distance(start_point=bot.entity.position, max_distance=512, ignore_bot=true) {

	let players = Object.entries(bot.players)
	let players_and_distances = players.map(([nick, info]) => {
		let username = info.username;
		let entity = info.entity;
		if (username.match(reg_nickname) && entity && (!ignore_bot || username != bot_username)) {
			let distance = Number(start_point.distanceTo(entity.position).toFixed(2));
			if (distance <= max_distance) {
				return [username, distance];
			}
		}
	})
	players_and_distances = players_and_distances.filter((value) => value !== undefined)
	players_and_distances = players_and_distances.sort((player1, player2) => player1[1] - player2[1])
	return players_and_distances
}

async function actions_processing(actions, module_name, update_action) {
	if (!actions) return;
	if (!actions.length) {
		actions = [actions]
	}
	actions.forEach(action => {
		let type = action.type;
		let content = action.content;
		//console.log(update_action)
		if (update_action && type == update_action.type) {
			for (key in update_action.content) {
				if (key == "send_in_private_message" && !update_action.content[key]) continue;
				content[key] = update_action.content[key]
			}
		}
		if (type == "answ") {
			if (!content.message) return;
			answs.push(content)
		} else if (type == "cmd") {
			cmds.push(content)
		} else if (type == "survings") {
			send_pay(content.nick, content.amount, content.reason)
		} else if (type == "TCA") {
			send_TCA(content.nick, content.amount)
		} else if (type == "error") {
			const error = content.error
			const recipient = content.sender
			console.log(content)
			modules.call_module("logging").add_error_to_logs(content.date_time, content.module_name, error.toString(), error.stack, content.args, content.sender)
			if (recipient) {
				actions_processing({"type": "answ", "content": {"recipient": recipient, "message": `Во время выполнения команды из ${content.module_name} произошла ошибка`}})
			}

		} else if (type == "new_survings") {
			payment_processing(content.payer, content.amount, "survings", content.reason)
		} else if (type == "new_TCA") {
			payment_processing(content.payer, content.amount, "TCA")
		
		} else if (type == "update_stats")  {
			console.log("update_stats", content)
			modules.call_module("stats").update_stats(content.nickname, content.key, content.value, content.type)

		} else if (type == "waiting_data") {
			queue_waiting_data["private_message"].push({module_name: module_name,
														
														})
		} else if (type == "module_request") {
			module_connect(action.module_recipient, action.module_sender, content, action.access_lvl)
		} else if (type == "wait_data") {

			queue_waiting_data[content.type].push({"time_create": new Date().getTime(), "module_name": action.module_name, "content": content})
		}
	})
}

function wait_data_processing(type, content) {
	for (let i=0; i < queue_waiting_data[type].length; i++) {
		const data = queue_waiting_data[type][i]
		//console.log("Вэйт дата", type, content, data)

		if (data.time_create && new Date().getTime() - data.time_create > 300000) {
			queue_waiting_data[type].splice(i, 1)
			continue;
		}
		if (type == "message") {
			if (data.content.sender == content.sender) {
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
		} else if (type == "cmd") {
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
	if (modules.call_module("casino").payment_processing(nick, cash, currency, reason, price_TCA)["used"]) {
		return;
	} else if (modules.call_module("bank").payment_processing(nick, cash, currency, reason, price_TCA)["used"]) {
		return;
	} else if (modules.call_module("stats").payment_processing(nick, cash, currency, reason, price_TCA)["used"]) {
		return;
	} else {
		if (currency == "TCA") {
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
	//wait_confirm_pay["TCA"].push({"nick": nick, "cash": count})
}

function send_pay(nick, amount, reason="") {
	cmds.push(`/pay ${nick} ${amount} ${reason}`.slice(0, 255))
	setTimeout(() => cmds.push(`/pay confirm`), 10)
	
	modules.call_module("manage_cash").add_wait_send_money(nick, amount, "survings", reason)

	//wait_confirm_pay["survings"].push({"nick": nick, "cash": money, "reason": reason})
	
}

function send_cmds() {
	if (!location_bot) {
		cmds = []
		return;
	}
	if (cmds.length > 0) {
		let cmd_object = cmds.shift()
		let cmd;
		if (typeof cmd_object == "object") {
			cmd = cmd_object.cmd
		} else {
			cmd = cmd_object
		}

		if (count(cmds, cmd_object) > 5) {
			console.log("Очищено", cmd_object, count(cmds, cmd_object))
			cmds = cmds.filter((value) => value != cmd_object)
		}

		if (!ignore_cmds.includes(cmd.split(" ").slice(0, ).join(" ")) && !ignore_cmds.includes(cmd.split(" ")[0])) {
			console.log("\033[36m" + cmd + "\033[0m")
			//add_msg_to_bd(nickname=bot_username, type_chat = 'Скрипт', message=cmd)
		}
		cmd = cmd
		if (cmd.length > 255) return;
		//if (!cmd.match(/^\/[ 0-9A-zА-яёЁ!@#$%^&*\-_+=]{1,255}$/)) return;

		bot.chat(cmd.trim())
		if (cmd_object.module_sender) {
			setTimeout(() => queue_waiting_data["cmd"].push(cmd_object), 100)
		}
	}
}

function send_answs() {
	if (!location_bot) return;
	if (answs.length > 0) {
		let answ = answs.shift()
		let message;
		if (typeof answ == "object") {
			let recipient = answ.recipient;
			let sender = answ.sender;
			if (sender === undefined) {
				sender = recipient;
			}
			let message = answ.message;
			if (!message || message == "") return;

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

			let spec_symbols = answ.spec_symbols;
			let prefix = answ.prefix;

			if (prefix) {
				message = `[${prefix}] ${message}`
			}

			//let send_full_message;
			console.log("Ансв", answ)
			console.log("\033[36m" + message + "\033[0m")
			message = message.replaceAll("\n", " ").replaceAll("\t", " ")

			if (recipient) {

				if (message[0] == "/") {
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

				let alias;
	            if (modules.call_module("stats").get_stats(sender)) {
	            	alias = modules.call_module("stats").get_stats(sender, "name")
	            }
			    if (!alias || alias == null) {
				    alias = recipient;
			    }	    
			    message = `${alias}, ${message}`
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


// const originalEmit = bot._client.emit;
// bot._client.emit = function (event, ...args) {
//   if (event.includes("entity") || event.includes("chank") || event.includes("chunk") || event.includes("transaction")) {//(event === 'entity_metadata' || event === 'entity_update_attributes' || event === 'spawn_entity_living' || event === 'map_chunk' || event === 'world_particles') {
//     const [data] = args;
//     if (true) return false;
//   }
//   return originalEmit.call(this, event, ...args);
// };

// bot._client.on('packet', (data, metadata) => {
// 	if (metadata.name === 'entity_metadata' || metadata.name === 'entity_update_attributes' || metadata.name === 'spawn_entity_living' || metadata.name === 'map_chunk') return;
//   console.log('Получен пакет:', metadata.name, data);
// });





bot.on("blockUpdate" , function blocks (oldBlock, newBlock) {
	if (["flowing_water", "flowing_lava"].includes(oldBlock.name) || ["flowing_water", "flowing_lava"].includes(newBlock.name)) return;
	if (oldBlock.name == "air" || newBlock.name == "air") {
		if (oldBlock.name == newBlock.name) return;
		var block_position = oldBlock.position;

		if (oldBlock.name == "air" && newBlock.name == "bed") {
			var nearby_players = get_players_and_distance(start_point=block_position);
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

			let rank = modules.call_module("stats").get_stats(criminal_nick, "rank")
			if (rank == 5) rank = 0;
			if (!rank) rank = 0;

			let actions = modules.call_module("SAGO").placed_bed_processing(criminal_nick, rank, block_position)
			actions_processing(actions)
		}

		

	}
})

// bot.on('message', function msg (jsonMsg, position, sender, verified) {
// 	console.log(position, sender, jsonMsg)
// })

let time_last_server_message = 0
let combine_server_message = [] // Объединение одного логического сообщения, разбитого на разные строки
let reset_wait_next_message;

bot.on('messagestr', (message, sender, message_json) => {
	if (!message || !sender) return;
	//console.log(sender, message)
	if (sender == "chat") {
		const raw_message = message;
		let private_message = message.match(reg_me_send);
		if (private_message) {
			sender = private_message[1]
			message = private_message[2]
			var type_chat = "Приват";

		} else {
			var type_chat = message.split("]")[0].split("[")[1]
			sender = message.split(":")[0].split(" ").at(-1)
			message = message.split(": ").slice(1).join(": ")
			
			if (type_chat != "Пати-чат" && type_chat != "Лк" && type_chat != "Гл") {
				type_chat = undefined;
			}
			
		}
		if (!message || !sender) return;

		wait_data_processing("message", {"type_chat": type_chat, "message": message, "sender": sender, "private_message": Boolean(private_message)})
		modules.call_module("logging").add_msg_to_players_logs(new Date(), location_bot, type_chat, sender, message, raw_message, JSON.stringify(message_json.json))

		//console.log(`[${type_chat}] ${sender}: ${message}`)
 		console.log(`[${type_chat}]` + "\033[32m " + sender + ":\033[33m " + message + "\033[0m")

		let rank_sender = modules.call_module("stats").get_stats(sender, "rank")
		if (seniors.includes(sender)) {
			rank_sender = 6;
		}
		if (!rank_sender) {
			rank_sender = 0;
			
		}
		modules.call_module("telegram").server_message_processing(sender, message, raw_message, new Date())

		let players_on_loc = get_players_on_loc()


		let flags = []
		message = message.replace(/[c|C][m|M][d|D]/, "cmd")
		let cmd;
		let args = []
		let chat_send;
		let send_in_private_message;
		let cmd_parameters;

		if (message.toLowerCase().includes("cmd ")) {
			let flags_match = message.split("cmd ")[0].matchAll(/-([^ -]*)(?: |$)/g)
			let count_flags = 0;
			for (let flag of flags_match) {
				flag = flag[1].toLowerCase()
				console.log("Флаг",flag)
				if (flag == "cc") {
					chat_send = "/cc "

				} else if (flag == "pc") {
					chat_send = "/pc "

				} else if (flag == "p") {
					send_in_private_message = true;

				} else if (flag == "l") {
					chat_send = ""

				} else if (flag == "g" && seniors.includes(sender)) {
					chat_send = "!"
				} else {
					flags.push(flag)
				}
				if (count_flags == 5) {
					break;
				}
			}
			console.log("ФЛаги:", flags, chat_send, send_in_private_message)
			message = message.split("cmd ")[1]
			message = message.split(" ")
			cmd = message[0].toLowerCase()
			args = parseArgs(message.slice(1).join(" "))

			cmd_parameters = {"cmd": cmd, "rank_sender": rank_sender, "players_on_loc": players_on_loc, "seniors": seniors, "location_bot": location_bot}
		}
		
		if (cmd && (rank_sender != 0 || cmd == "bank")) {
			console.log(`cmd ${cmd} args ${args}`)
			if (cmd == "help") {
				let answ;
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
					answ = generate_help_message(num_page)
				}

				answs.push({"recipient": sender, "message": answ})

			} else if (cmd == "test") {
				const brin = bot.players["Herobrin2v"].entity
				setInterval(() => console.log(brin.yaw, brin.pitch), 1000)

			} else if (modules.modules[cmd]) {
				module_object = modules.call_module(cmd, sender)
				console.log(cmd, args, rank_sender, module_object.cmd_access)
				const valid_command = CommandManager.validate_command(module_object.module_name, args)
				if (valid_command["is_ok"]) {

					if (module_object.cmd_access && check_access(cmd, args, rank_sender, module_object.cmd_access) ||
						!module_object.cmd_access && rank_sender > 0) {

						const cooldown_info = modules.call_module("cooldown").check_cooldown(sender, cmd, args)
						if (seniors.includes(sender) || cooldown_info["is_ok"]) {
							let actions = module_object.cmd_processing(sender, args, cmd_parameters, valid_command.args)
							let update_action = {type: "answ", content: {"chat_send": chat_send, "send_in_private_message": send_in_private_message}}
							console.log(actions)
							actions_processing(actions, undefined, update_action)

						} else {
							actions_processing(cooldown_info)
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
				if (cmd == "js") {
					try {
						eval(args.join(" "))
					} catch (error) {
						console.log(error)
					}
				} else {
					bot.chat(`${cmd} ${args.join(" ")}`.trim())
					return;
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
			if (combine_server_message.length == 0) return;
			processing_server_message(sender, combine_server_message.join("\n"), message_json)
			combine_server_message = []
			// processing_server_message(sender, combine_server_message.join("\n"), message_json)
		}, 80)

		if (delta_time < 70 || combine_server_message.length == 0) {
			if (now_reg) {
				reg_lines = now_reg.source.split("\n")
				reg_line = regex_lines[now_reg_index]
				if (message.match(reg_line)) {
					if (now_reg_index+1 == reg_lines.length) {
						processing_server_message(sender, combine_server_message.join("\n"), message_json)
						combine_server_message = []
						now_reg = undefined;
						now_reg_index = 0;
					} else {
						combine_server_message.push(message)
						now_reg += 1;
					}
				} else {
					processing_server_message(sender, combine_server_message.join("\n"), message_json)
					combine_server_message = [message]
					now_reg_index = 0;
					now_reg = undefined;
				}
			} else {
				let is_matched = false;
				for (let i = 0; i < regexes.length; i++) {
					regex_lines = regexes[i].source.split("\n")
					let reg_line = regex_lines[0]
					if (message.match(reg_line)) {
						if (combine_server_message.length != 0) {
							processing_server_message(sender, combine_server_message.join("\n"), message_json)
						}
						if (regex_lines.length == 1) {
							processing_server_message(sender, message, message_json)
						} else {
							combine_server_message.push(message)
							now_reg = regexes[i]
							now_reg_index = 1;
						}
						is_matched = true;
					}
				}
				if (!is_matched) {
					combine_server_message.push(message)
				}
			}

			return;

		} else {
			combine_server_message.push(message)
			processing_server_message(sender, combine_server_message.join("\n"), message_json)
			combine_server_message = []

			//console.log("Цельное сообщение:", [message])
			//combine_server_message = message
		}
		// if (combine_server_message.length == 0) return;
		// processing_server_message(sender, combine_server_message.join("\n"), message_json)

	}
})
let now_reg_index = 0;
let now_reg;

function processing_server_message(sender, message, message_json) {
	let wait_cmd;
	let now_cmd;
	let values = {}
	let count_args = 1;
	// console.log("Серверное сообщение", [message], new Date().getTime() - time_last_server_message)
	if (queue_waiting_data["cmd"].length != 0) {
		wait_cmd = queue_waiting_data["cmd"][0].cmd
		//wait_data_processing("cmd", {"server_answ": message})
	}

	const lookup = message.match(reg_lookup)

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
	//const survings_reason = message.match(reg_survings_reason)

	const tca_accept = message.match(reg_tca_accept)

	const tca_send = message.match(reg_TCA_send)
	const survings_send = message.match(reg_survings_send)
	if (message != "" && !seen && !tca_accept && !bal_survings && !bal_TCA && !message.includes("Лог последних операций с баллами TCA:") && !message.match(reg_log_line)) {
		modules.call_module("logging").add_msg_to_server_logs(new Date(), sender, message, JSON.stringify(message_json))
		console.log([message], sender)
	}

	if (["Нужно авторизоваться. Напишите в чат Ваш пароль", "Забыли пароль? Восстановите его с помощью команды /Recovery <Почта>"].includes(message)
		&& !password_enter) {
		bot.chat(`/login ${bot_password}`)
		password_enter = true;
	// } else if (message == "Вы были отключены от локации Классическое выживание, Локация №8 из-за внутренней ошибки") {
	// 	process.exit(-1)
	} else if (message == "[TeslaCraft] Уже выполняется другая телепортация.") {
		bot.chat("/hub" + random_number(1, 8))

	} else if (seen) {
		now_cmd = "seen"

		const nick = seen[1]
		const status = seen[2]
		const duration = seen_parse_time(seen[3])
		const server = seen[4]
		const position = {x: seen[5], y: seen[6], z: seen[7]}
		
		values = {nick: nick, status: status, duration: duration, server: server, position: position, location_bot: location_bot}
		// if (location_bot.includes("Классическое выживание")) {
		// 	lurking.processing_seen(nick, status, position, server)
		// }

	} else if (survings_accept) {
		let nick = survings_accept[1]
		let donate_sum = Number(survings_accept[2].replaceAll(",", ""))
		let reason = survings_accept[3]
		console.log(nick, donate_sum, reason)
		modules.call_module("manage_cash").survings_accept(nick, donate_sum,reason)

	} else if (tca_send) {
		now_cmd = "tca transfer"
		count_args = 2

		const cash = Number(tca_send[1])
		const nick = tca_send[2]
		modules.call_module("manage_cash").confirm_send_money(new Date(), nick, "TCA", cash)

	} else if (survings_send) {
		now_cmd = "pay"

		let cash = Number(survings_send[1].replaceAll(",", ""))
		let nick = survings_send[2]
		modules.call_module("manage_cash").confirm_send_money(new Date(), nick, "survings", cash)

	}  else if (tca_accept) {
		now_cmd = "tca log"
		count_args = 2
		let tca_logs = []
		for (let i=0; i < 15; i++) {
			let date_time = tca_accept[i*5 + 1]
			let [day, month, year] = date_time.split(" ")[0].split(".")
			let [hours, minutes, seconds] = date_time.split(" ")[1].split(":")
			let date = new Date()
			date.setYear(year)
			date.setMonth(month)
			date.setDate(day)
			date.setHours(hours)
			date.setMinutes(minutes)
			date.setSeconds(seconds)
			
			let action = tca_accept[i*5 + 2]
			let amount = Number(tca_accept[i*5 + 3])
			let balance_TCA = Number(tca_accept[i*5 + 4])
			let nickname = tca_accept[i*5 + 5]
			let payer, payee;
			if (action == "+") {
				payer = nickname;
				payee = bot_username;

			} else {
				payer = bot_username;
				payee = nickname;
			}
			//console.log("Добавляю:", {payer: payer, payee: payee, amount: amount, date: date})
			tca_logs.push({payer: payer, payee: payee, amount: amount, date: date})

		}
		modules.call_module("manage_cash").tca_accept(tca_logs)



	} else if (bal_TCA) {
		now_cmd = "tca check"
		count_args = 2

		bot_bal_TCA = Number(bal_TCA[1])
		modules.call_module("bank").update_TCA(bot_bal_TCA)

	} else if (bal_survings) {
		now_cmd = "bal"

		// if (!timer_check_surv || timer_check_surv._destroyed) {
		// 	timer_check_surv = setTimeout(() => {bot.chat("/bal")}, interval_check_surv)
		// }
		
		bot_bal_survings = Number(bal_survings[1].replace(/,/g, ""))
		let new_survings = modules.call_module("manage_cash").update_survings(bot_bal_survings, new Date().getTime())
		if (!new_survings || !new_survings["is_ok"]) return;

		// console.log("Баланс обновлён, текущий баланс:", bot_bal_survings)
		modules.call_module("casino").update_survings(bot_bal_survings)
		modules.call_module("bank").update_survings(bot_bal_survings)
	
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
		console.log(violator, guardian)
		let actions = modules.call_module("casino").end_casino_violator(violator, guardian)
		actions_processing(actions)

	} else if (lookup) {
		now_cmd = "lookup"

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

	} else if (tryme_info) {
		now_cmd = "tryme info"
		count_args = 2

		const already_answered = tryme_info[1] == "True"
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
		//console.log(tryme_info)

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

		modules.call_module("викторина").quiz_processing(question, type_question)

	}
	if (wait_cmd) {
		let confirmed = false;
		if (now_cmd == wait_cmd.trim().split(" ").slice(0, count_args).join(" ").replace("/", "")) {
			confirmed = true;
		}
		wait_data_processing("cmd", {server_answ: message, values: values, is_confirmed: confirmed})
	}

}

bot.on('end', function kicked(reason) {
	console.log("Закончил " + reason)
	console.log(1)
	process.exit(-1);
})

function generateJsonPatch(obj1, obj2) {
  const patch = [];

  // Рекурсивно обходим все свойства первого объекта
  for (const prop in obj1) {
    if (obj1.hasOwnProperty(prop)) {
      // Если свойство отсутствует во втором объекте, удаляем его
      if (!obj2.hasOwnProperty(prop)) {
        patch.push({op: "remove", path: `/${prop}`, oldVal: obj1[prop]});
      } else {
        // Если свойство является объектом или массивом, рекурсивно обходим его
        if (typeof obj1[prop] === "object") {
          patch.push(...generateJsonPatch(obj1[prop], obj2[prop]).map(p => {
            p.path = `/${prop}${p.path}`;
            return p;
          }));
        } else {
          // Если значение свойства отличается от значения во втором объекте, обновляем его
          if (obj1[prop] !== obj2[prop]) {
            patch.push({op: "replace", path: `/${prop}`, value: obj2[prop], oldVal: obj1[prop]});
          }
        }
      }
    }
  }

  // Обходим свойства второго объекта, которых нет в первом объекте
  for (const prop in obj2) {
    if (obj2.hasOwnProperty(prop) && !obj1.hasOwnProperty(prop)) {
      // Добавляем новое свойство
      patch.push({op: "add", path: `/${prop}`, value: obj2[prop], oldVal: undefined});
    }
  }

  return patch;
}

players = {}

bot.on('playerJoined', (player) => {
	if (!location_bot || !location_bot.includes("Классическое выживание")) return;
	modules.call_module("detector").player_joined_event(player.username)
})

// bot.on('entitySpawn', (entity) => {
// 	if (entity.name == "snowball") {
// 		let players_and_distances = get_distance_to_players(start_point=entity.position)
// 		if (players_and_distances.length == 0) return; 
// 		let [nick, distance] = players_and_distances[0];
// 		if (distance > 2) return;
// 		let gamemode = bot.players[nick].gamemode
// 		if (throw_snow[nick]) {
// 			let count_snow;
// 			if (gamemode == 0) {
// 				count_snow = throw_snow[nick][0]
// 				if (count_snow % 100 == 0) {
// 					send_pay(nick, 50, reason=`Вы кинули ${count_snow}-й снежок в гм 0!`)
// 				}
// 				throw_snow[nick][0]++;
// 			} else {
// 				count_snow = throw_snow[nick][1]
// 				if (count_snow % 100 == 0) {
// 					send_pay(nick, 5, reason=`Вы кинули ${count_snow}-й снежок в гм 1!`)
// 				}
// 				throw_snow[nick][1]++;
// 			}

// 		} else {
// 				throw_snow[nick] = [1, 1]; //Инициализация начальных значений
// 		}

// 	} else if (entity.displayName == "Thrown egg") {

// 		let egg_id = entity.id;
// 		//console.log("egg id", egg_id)
// 		if (egg_id % 200 == 0) {
// 			let players_and_distances = get_distance_to_players(start_point=entity.position)
// 			if (players_and_distances.length == 0) return; 
// 			let [nick, distance] = players_and_distances[0];
// 			send_pay(nick, 0.01, reason=`Зачем вы кидаетесь ${entity.name}? Новый год ведь, лучше снежками бросайтесь!`)
// 		}
	
// 	} else if (entity.type == "player" && seniors.includes(entity.username)){
// 		console.log("Появился", entity.username)
// 		seniors_online = true;
// 	}

// })

bot.on('entitySpawn', (entity) => {
	// console.log(entity.name, entity.displayName)
	if (entity.displayName && entity.displayName.includes("Thrown")) {
		let object_id = entity.id
		
	}
	if (entity.name == "snowball" && false) {
		modules.call_module("")
	} else if (entity.type == "player") {
		const nick = entity.username
		if (bot.players[nick]) {
			const url = bot.players[nick].skinData.url
			if (url) {
				modules.call_module("skinnaper").processing_skin_url(nick, url)
			}
		}

	}
})

bot.on('entityGone', (entity) => {
	setTimeout(() => {

	if (entity.displayName && entity.displayName.includes("Thrown")) {
		let object_id = entity.id
		console.log(`Летящий объект с id=${object_id} пропал на координатах: ${entity.position}`)
		console.log("Игроки рядом:", get_players_and_distance(start_point=entity.position, max_distance=2, ignore_bot=false))
	}
	}, 10)
})

function module_connect(module_recipient, module_sender, json_cmd, access_lvl) {
	console.log(module_recipient, module_sender, json_cmd)
	if (typeof module_recipient == "string") {
		module_recipient = modules.modules[module_recipient]
	} 

	if (typeof module_sender == "string") {
		module_sender = modules.modules[module_sender]
	} 

	if (typeof module_recipient == "object" && typeof module_sender == "object") {
		const actions = module_recipient.module_dialogue(module_recipient, module_sender, json_cmd, access_lvl)
		actions_processing(actions)
	
	} else {
		console.log("Модуль не найден", module_recipient, module_sender)
	}
}

function check_return_tg () {
	let action = modules.call_module("telegram").get_action();
	if (!action) return;
	try {
		let type = action.type;
		let content = action.content;
		if (type == "js") {
			let callback = eval(content)
			modules.call_module("telegram").send_message(`Команда ${content} выполнена. Callback: ${JSON.stringify(callback)}`)
		} else {
			actions_processing(action)
		}

	} catch (err) {
		modules.call_module("telegram").send_message(`Во время выполнения действия ${action.type} возникла ошибка: ${err}`)
	}
	
}

function check_return_casino () {
	let actions = modules.call_module("casino").get_actions()
	actions_processing(actions)
}

function check_return_bank () {
	let actions = modules.call_module("bank").get_actions()
	actions_processing(actions)
}

function check_return_cash() {
	let actions = modules.call_module("manage_cash").get_actions()
	actions_processing(actions)
	
}

function check_return_quotes() {
	let actions = modules.call_module("цитата").get_actions()

	actions_processing(actions)
}

function check_return_stats() {
	let actions = modules.call_module("stats").get_actions()
	actions_processing(actions)
}

function check_return_lurking() {
	let actions = modules.call_module("lurking").get_actions()
	actions_processing(actions)
}

function check_return_alias() {
	let actions = modules.call_module("alias").get_actions()
	actions_processing(actions)
}

function check_return_quiz() {
	let actions = modules.call_module("викторина").get_actions()
	actions_processing(actions)
}

function check_return_skinnaper() {
	let actions = modules.call_module("skinnaper").get_actions()
	// console.log(actions)
	actions_processing(actions)
}

function check_return_move() {
	let actions = modules.call_module("ручуп").get_actions()
	actions_processing(actions)
}

function check_return_detector() {
	let actions = modules.call_module("detector").get_actions()
	actions_processing(actions)
}

function check_return_choice() {
	let actions = modules.call_module("выбери").get_actions()
	actions_processing(actions)
}

setInterval(check_return_choice, 500)

setInterval(check_return_detector, 500)

setInterval(check_return_move, 500)

setInterval(check_return_skinnaper, 500)

setInterval(check_return_quiz, 500)

setInterval(check_return_alias, 500)

setInterval(check_return_lurking, 500)

setInterval(check_return_stats, 500)

setInterval(check_return_quotes, 500)

setInterval(check_return_cash, 500)

setInterval(check_return_casino, 1000)

setInterval(check_return_bank, 5000)
setInterval(check_return_tg, 1000)

let tp_end = setInterval(() => {
 	if (!location_bot || !location_bot.includes("Локация Край")) bot.chat("/swarp end")}, 5000)

setInterval(check_loc_bot, 3000)

setInterval(send_answs, 2000)
setInterval(send_cmds, interval_send_cmds)

setInterval(() => cmds.push("/tca log"), 10000)
setInterval(() =>  {
	if (location_bot && location_bot.includes("Классическое выживание")) {
		bot.chat("/bal")
	}
}, 10000)
setInterval(() => cmds.push("/tca check"), 5000)


setInterval(update_all_players, 10000)
