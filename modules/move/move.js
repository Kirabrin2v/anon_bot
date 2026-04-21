const path = require("path");

const { get_bot } = require(path.join(BASE_DIR, 'init.js'))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const MODULE_NAME = "ручуп"
const HELP = "Управление ботом"
const INTERVAL_CHECK_ACTIONS = 0
const STRUCTURE = {
	version: {
		_type: "int",
		_optional: true,
		_description: "Способ управления ботом. Номер \"2\" - управление с помощью блоков шерсти"
	}
}

const bot = get_bot()

const cmd_access = {"ручуп": [
	{},
	{},
	{},
	{}, 
	{"": true,
	"ручуп": "end"}
]}

class MoveModule extends BaseModule {
	constructor () {
        super(MODULE_NAME, HELP, STRUCTURE, INTERVAL_CHECK_ACTIONS)

		this.tracker_player = {}
		this.control_player = {}
    }

    control_head(delta_yaw, delta_pitch) {
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

	repeat_head_position(nickname) {
		if (bot.players[nickname] && bot.players[nickname].entity) {
			const yaw = bot.players[nickname].entity.yaw
			const pitch = bot.players[nickname].entity.pitch
			bot.look(yaw, pitch, true)
		}
	}

	track_player(nickname) {
		if (bot.players[nickname] && bot.players[nickname].entity) {
			const position = bot.players[nickname].entity.position
			bot.lookAt(position)
		}
	}

	control_state_with_keyboard(key, is_press) {
		if (this.control_player.version !== 1) {return;}
		if (key === "w") {
			if (is_press) {
				bot.setControlState("forward", true)
			} else {
				bot.setControlState("forward", false)
			}

		} else if (key === "s") {
			if (is_press) {
				bot.setControlState("back", true)
			} else {
				bot.setControlState("back", false)
			}
		
		} else if (key === "d") {
			if (is_press) {
				bot.setControlState("right", true)
			} else {
				bot.setControlState("right", false)
			}
		
		} else if (key === "a") {
			if (is_press) {
				bot.setControlState("left", true)
			} else {
				bot.setControlState("left", false)
			}
		} else if (key === "space") {
			if (is_press) {
				bot.setControlState("jump", true)
			} else {
				bot.setControlState("jump", false)
			}
		}
	}

	control_bot_with_blocks(nickname) {
		if (bot.players[nickname] && bot.players[nickname].entity) {
			const items = bot.players[nickname].entity.equipment
			const id_items = items
			.filter((item) => item !== undefined)
			.map((item) => {
				return item.metadata
			})
			if (id_items.includes(9)) {
				this.repeat_head_position(nickname)			
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

	clear_control_player() {
		if (this.control_player.version === 2) {
			clearInterval(this.control_player.interval_check)
		}
		this.control_player = {}
		bot.clearControlStates()
	}

	_process(sender, args, cmd_parameters) {
		const seniors = cmd_parameters.seniors
		let answ;
		if (args[0] === "help") {
			answ = "Возможные аргументы: [версия ручупа]"
		} else if (args.length === 0) {
			if (seniors.includes(sender)) {
				args[0] = "1"
			} else {
				args[0] = "3"
			}
		}
		if (args[0] === "3") {
			if (args[1] === "help") {
				answ = "Управление ботом с помощью блоков шерсти."

			} else {
				if (this.control_player.nick) {
					if (sender === this.control_player.nick) {
						this.clear_control_player()
						answ = "Управление успешно выключено"
					} else {
						answ = `Вы не можете использовать это сейчас, т.к. ботом управляет ${this.control_player.nick}`
					}
				} else {
					this.control_player = {
						nick: sender,
						version: 3,
						interval_check: setInterval(() => {
							this.control_bot_with_blocks(sender)
						}, 1)
					}
					answ = "Теперь Вы управляете ботом. Необходимые цвета шерсти: бирюзоывй(взгляд) оранжевый(←), лаймовый(↑), красный(↓), фиолетовый(→), зелёный(прыжок)"

				}
			}

		} else if (args[0] === "1" && seniors.includes(sender)) {
			if (this.control_player.nick === sender) {
				this.clear_control_player()
				answ = "Управление успешно выключено"
			} else {
				if (this.control_player.nick) {
					this.actions.push({
						type: "answ",
						content: {
							recipient: this.control_player.nick,
							message: `Управление было отобрано игроком ${sender}`
						}
					})
					this.clear_control_player()
				}
				this.control_player = {
						nick: sender,
						version: 1,
					}
				answ = "Управление успешно включено"
			}
		}
		if (answ) {
			return answ
		}
	}

	control_head_with_pixels(delta_x, delta_y) {
		if (this.control_player.version !== 1) {return;}

		const sensitivity = 100
		const need_pixes = 688.07 / (sensitivity - 24.57)
		const pitch = delta_y / need_pixes * 0.024543692606170175

		const yaw = delta_x / need_pixes * 0.024543692606170175
		this.control_head(yaw, pitch)
	}

	module_dialogue(module_recipient, module_sender, json_cmd) {
		if (json_cmd.type === "request") {
			const cmd = json_cmd.cmd;
			const args = json_cmd.args;
			if (cmd === "look") {
				const nickname = args[0].value
				if (this.tracker_player.interval_check) {
					clearInterval(this.tracker_player.interval_check)
				}
				this.tracker_player.interval_check = setInterval(() => this.track_player(nickname), 5)
			}
		}
	}
}



module.exports = MoveModule









