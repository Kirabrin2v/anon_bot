const module_name = "sex"
const help = "Насилует указанного игрока"

const structure = {
	nick: {
		_type: "nick",
		_description: "Ник игрока, которого нужно обесчестить"
	},
	быстрее: {
		_description: "Ускориться"
	}
}

let actions = []

var bot;

function initialize(constants) {
	bot = constants.bot
}

function sneak_toggle() {
	if (Date.now() - time_last_update > interval_sneak) {
		time_last_update = Date.now() + interval_sneak
		if (bot.getControlState("sneak")) {
			bot.setControlState("sneak", false)
		} else {
			bot.setControlState("sneak", true)
		}
	}
}



let outer_sex_updater;
let inner_sex_updater;

let time_last_update = 0;

let interval_sneak = 3000;

function cmd_processing(sender, args, cmd_parameters, valid_args) {
	const seniors = cmd_parameters.seniors
	if (!seniors.includes(sender)) return;
	args = valid_args
	console.log("Кмд процесинг virt", args)
	if (args[0].name == "nick") {
		const module_recipient = "ручуп"
		actions.push({
							type: "module_request",
							module_recipient: module_recipient,
							module_sender: module_name,
							content:{
								type: "request",
								cmd: "look",
								args: args
							}})

		sex_interval = setInterval(sneak_toggle, 10)
	} else if (args[0].name == "быстрее") {
		interval_sneak -= 500;
	}
}

function diagnostic_eval (eval_expression) {
	try {
		return eval(eval_expression)
	} catch (error) {
		return error
	}
}

function get_actions() {
	return actions.splice(0)
}

module.exports = {cmd_processing, initialize, module_name, diagnostic_eval, structure, get_actions, help}
