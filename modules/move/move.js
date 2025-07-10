const module_name = "ручуп"
const help = "Управление ботом"

const structure = {
	version: {
		_type: "int",
		_optional: true,
		_description: "Способ управления ботом. Номер \"2\" - управление с помощью блоков шерсти"
	}
}

var bot;

function initialize(constants) {
	bot = constants.bot
}

const cmd_access = {"ручуп": [
	{},
	{},
	{},
	{}, 
	{"": true,
	"ручуп": "end"}
]}

let actions = []

let control_player = {}

function control_head(delta_yaw, delta_pitch) {
	let [yaw, pitch] = [bot.entity.yaw, bot.entity.pitch]

	yaw -= delta_yaw
	pitch -= delta_pitch

	if (pitch > 0) {
		pitch = Math.min(1.5707963267948966, pitch)
	} else {
		pitch = Math.max(-1.5707963267948966, pitch)
	}
	yaw = yaw % 6.258641614573416

	bot.look(yaw, pitch, true)
}

function repeat_head_position(nickname) {
	if (bot.players[nickname] && bot.players[nickname].entity) {
		const yaw = bot.players[nickname].entity.yaw
		const pitch = bot.players[nickname].entity.pitch
		bot.look(yaw, pitch, true)
	}
}

function control_state_with_keyboard(key, is_press) {
	if (control_player.version != 1) return;
	if (key == "w") {
		if (is_press) {
			bot.setControlState("forward", true)
		} else {
			bot.setControlState("forward", false)
		}

	} else if (key == "s") {
		if (is_press) {
			bot.setControlState("back", true)
		} else {
			bot.setControlState("back", false)
		}
	
	} else if (key == "d") {
		if (is_press) {
			bot.setControlState("right", true)
		} else {
			bot.setControlState("right", false)
		}
	
	} else if (key == "a") {
		if (is_press) {
			bot.setControlState("left", true)
		} else {
			bot.setControlState("left", false)
		}
	} else if (key == "space") {
		if (is_press) {
			bot.setControlState("jump", true)
		} else {
			bot.setControlState("jump", false)
		}
	}
}

function control_bot_with_blocks(nickname) {
	if (bot.players[nickname] && bot.players[nickname].entity) {
		const items = bot.players[nickname].entity.equipment
		const id_items = items
		.filter((item) => item != undefined)
		.map((item) => {
			return item.metadata
		})
		if (id_items.includes(9)) {
			repeat_head_position(nickname)			
		}

		if (id_items.includes(13)) {
			bot.setControlState("jump", true)
		} else {
			bot.setControlState("jump", false)
		}

		if (id_items.includes(5)) {
			bot.setControlState("forward", true)
		} else {
			bot.setControlState("forward", false)
		}

		if (id_items.includes(14)) {
			bot.setControlState("back", true)
		} else {
			bot.setControlState("back", false)
		}

		if (id_items.includes(1)) {
			bot.setControlState("left", true)
		} else {
			bot.setControlState("left", false)
		}

		if (id_items.includes(10)) {
			bot.setControlState("right", true)
		} else {
			bot.setControlState("right", false)
		}
	} else {
		bot.clearControlStates()
	}
}

function clear_control_player() {
	if (control_player.version == 2) {
		clearInterval(control_player.interval_check)
	}
	control_player = {}
	bot.clearControlStates()
}

function cmd_processing(sender, args, cmd_parameters) {
	try {
		let seniors = cmd_parameters.seniors
		let answ;
		if (args[0] == "help") {
			answ = "Возможные аргументы: [версия ручупа]"
		} else if (args.length == 0) {
			if (seniors.includes(sender)) {
				args[0] = "1"
			} else {
				args[0] = "3"
			}
		}
		if (args[0] == "3") {
			if (args[1] == "help") {
				answ = "Управление ботом с помощью блоков шерсти."

			} else {
				if (control_player.nick) {
					if (sender == control_player.nick) {
						clear_control_player()
						answ = "Управление успешно выключено"
					} else {
						answ = `Вы не можете использовать это сейчас, т.к. ботом управляет ${control_player.nick}`
					}
				} else {
					control_player = {
						nick: sender,
						version: 3,
						interval_check: setInterval(() => {
							control_bot_with_blocks(sender)
						}, 1)
					}
					answ = "Теперь Вы управляете ботом. Необходимые цвета шерсти: бирюзоывй(взгляд) оранжевый(←), лаймовый(↑), красный(↓), фиолетовый(→), зелёный(прыжок)"

				}
			}

		} else if (args[0] == "1" && seniors.includes(sender)) {
			if (control_player.nick == sender) {
				clear_control_player()
				answ = "Управление успешно выключено"
			} else {
				if (control_player.nick) {
					actions.push({
						type: "answ",
						content: {
							recipient: control_player.nick,
							message: `Управление было отобрано игроком ${sender}`
						}
					})
					clear_control_player()
				}
				control_player = {
						nick: sender,
						version: 1,
					}
				answ = "Управление успешно включено"
			}
		}
		if (answ) {
			return {
				type: "answ",
				content: {
					recipient: sender,
					message: answ
				}
			}
		}

	} catch (error) {
		return {type: "error",
			content: {
				date_time: new Date(),
				module_name: module_name,
				error: error,
				args: args, 
				sender: sender}}
	}
}

function control_head_with_pixels(delta_x, delta_y) {
	if (control_player.version != 1) return;

	const sensitivity = 100
	need_pixes = 688.07 / (sensitivity - 24.57)
	const pitch = delta_y / need_pixes * 0.024543692606170175

	const yaw = delta_x / need_pixes * 0.024543692606170175
	control_head(yaw, pitch)
}

function get_actions() {
	return actions.splice(0)
}

function diagnostic_eval (eval_expression) {
	try {
		return eval(eval_expression)
	} catch (error) {
		return error
	}
}

module.exports = {module_name, initialize, diagnostic_eval, control_head, control_head_with_pixels, control_state_with_keyboard, cmd_access, cmd_processing, get_actions, help, structure}











// function check_loc_bot() {
// 	let tablist = bot.tablist.header.text.split("\n")
// 	if (tablist.length >= 3) {
// 		let new_location_bot = tablist[2].split("» §b§l")[1].split(" §e§l«")[0];
// 		if (new_location_bot != location_bot) {
// 			if (location_bot) {
// 				console.log(`Бот переместился с ${location_bot} на ${new_location_bot}`)
// 				if (!location_bot.includes("Классическое выживание") && new_location_bot.includes("Классическое выживание")) {
// 					if (!timer_check_surv || timer_check_surv._destroyed) {
// 						timer_check_surv = setTimeout(() => {bot.chat("/bal")}, interval_check_surv)
// 					}
// 				}
// 				location_bot = new_location_bot;

// 			} else {
// 				location_bot = new_location_bot;
// 				console.log(`Бот появился на локации ${new_location_bot}`)
// 				//tg.start()
// 			}
// 		} else {
// 			location__bot = tablist.join(" ");
// 		}
// 	}
// }
