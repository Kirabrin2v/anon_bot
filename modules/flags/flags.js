const path = require("path")

const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const MODULE_NAME = "flags"
const HELP = "Информация о флагах"

const STRUCTURE = {
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


class FlagsModule extends BaseModule {
	constructor () {
        super(MODULE_NAME, HELP, STRUCTURE)
    }

	_process(sender, args) {
		let answ;
		
		if (args[0] === "info") {
			answ = "Флаги нужны для изменения поведения команды. Синтаксис: -flag1 -flag2 сmd *команда*. Флагов может быть не больше 5. Пример: '-p сmd кто Гей' напишет Вас в лс, кто является Геем, хотя по умолчанию выводит в локальный чат"
		} else if (args[0] === "list") {
			answ = "Доступные флаги: cc(клан-чат), pc(пати-чат), p(личные сообщения). l(локальный чат)"
		} else if (args[0] === "cc") {
			answ = "Перенаправляет ответ выполненной команды в клановый чат"
		} else if (args[0] === "pc") {
			answ = "Перенаправляет ответ выполненной команды в пати-чат"
		} else if (args[0] === "p") {
			answ = "Перенаправляет ответ выполненной команды Вам в личные сообщения"
		} else if (args[0] === "l") {
			answ = "Перенаправляет ответ выполненной команды в локальный чат"
		}

		return answ
	}
}

module.exports = FlagsModule