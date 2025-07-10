const module_name = ""
const help = ""

const structure = {}

function cmd_processing(sender, args) {
	try {
		let answ;
		if (args.length == 0 || args[0] == "help") {
			answ = ""

		}
		if (answ) {
			return {
				type: "answ",
				content: {
					message: answ,
					recipient: sender
				}
			}
		}

	} catch (error) {
		return {
			type: "error",
			content: {
				date_time: new Date(),
				module_name: module_name,
				error: error,
				args: args, 
				sender: sender}}
	}
}

function diagnostic_eval (eval_expression) {
	try {
		return eval(eval_expression)
	} catch (error) {
		return error
	}
}

module.exports = {cmd_processing, diagnostic_eval, structure, help}