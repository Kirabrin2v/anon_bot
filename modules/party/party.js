const module_name = "party"
const help = "Пригласит Вас в пати"

const structure = {

}

function cmd_processing(sender, args) {
	try {
		let answ;
		if (args[0] == "help") {
			answ = "Пропишите команду без аргуменов и бот пригласит Вас в пати"
			return {type: "answ",
					content: {
						message: answ,
						recipient: sender
					}}
		} else {
			let cmd = `/party invite ${sender}`
			return {type: "cmd",
						content: {
							cmd: cmd
						}
					}
		}

	} catch (error) {
		return {type: "error",
			content: {
				module_name: module_name,
				error: error,
				args: args, 
				sender: sender}}
	}
}

module.exports = {module_name, cmd_processing, help, structure}