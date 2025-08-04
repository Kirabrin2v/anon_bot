const module_name = ""
const help = ""

const structure = {}

let actions = [] 

function cmd_processing(sender, args, cmd_parameters, valid_args) {
	args = valid_args
	let answ;

	if (answ) {
		return {
			type: "answ",
			content: {
				message: answ,
				recipient: sender
			}
		}
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

module.exports = {module_name, cmd_processing, diagnostic_eval, structure, help}