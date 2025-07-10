const module_name = "flags"
const help = "Информация о флагах"

const structure = {
	info: {
		_description: "Общая информация о флагах",
	},
	list: {
		_description: "Список всех флагов",
	},
	name_flag: {
		_type: "string",
		_description: "Описание выбранного флага"
	}
}

function cmd_processing(sender, args) {
	try {
		if (args.length == 0 || args[0] == "help") {
			answ = "Возможные аргументы: [info - информация о флагах, list - список флагов, *название_флага* - информация о флаге]"
			return {type: "answ",
					content: {
						message: answ,
						recipient: sender
					}}
		} else {
			if (args[0] == "info") {
				answ = "Флаги нужны для изменения поведения команды. Синтаксис: -flag1 -flag2 сmd *команда*. Флагов может быть не больше 5. Пример: '-p сmd кто Гей' напишет Вас в лс, кто является Геем, хотя по умолчанию выводит в локальный чат"
			} else if (args[0] == "list") {
				answ = "Доступные флаги: cc(клан-чат), pc(пати-чат), p(личные сообщения). l(локальный чат)"
			} else if (args[0] == "cc") {
				answ = "Перенаправляет ответ выполненной команды в клановый чат"
			} else if (args[0] == "pc") {
				answ = "Перенаправляет ответ выполненной команды в пати-чат"
			} else if (args[0] == "p") {
				answ = "Перенаправляет ответ выполненной команды Вам в личные сообщения"
			} else if (args[0] == "l") {
				answ = "Перенаправляет ответ выполненной команды в локальный чат"
			}
			return {type: "answ",
					content: {
						recipient: sender,
						message: answ
					}}
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

function diagnostic_eval (eval_expression) {
	try {
		return eval(eval_expression)
	} catch (error) {
		return error
	}
}

module.exports = {module_name, cmd_processing, diagnostic_eval, help, structure}