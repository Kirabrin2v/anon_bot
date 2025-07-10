const module_name = "викторина"
const help = "Ответы на серверную викторину"

const structure = {
  last: {
    _description: "Показывает ответ на последнюю замеченную ботом викторину(она может быть очень старой/с другой локации)"
  },
  now: {
    _description: "Показывает ответ на актуальную в данный момент на данной локации викторину"
  }
}

const path = require("path")
const math = require("mathjs");
const fs = require("fs")

const sorted_anagrams = JSON.parse(fs.readFileSync(path.join(__dirname, "anagrams.json"), "utf-8"))
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, "questions.json"), "utf-8"))

const reg_vic_anagrams = new RegExp("Расшифруйте первым анаграмму (.*) , чтобы выиграть!")
const reg_vic_fast = new RegExp("Напечатайте первым \"(.*)\", чтобы выиграть!")
const reg_vic_example = new RegExp("Решите первым пример (.*), чтобы выиграть!")
const reg_vic_quest = new RegExp("(.*)")

var wait_tryme = false;
var index_wait_tryme = 0;
var tryme_info = {}
var clear_tryme;

var wait_quiz = false;
var clear_quiz;

var last_question = {"question": undefined, "answ": undefined}

var users_wait_answ = []

var actions = []



function get_answ(question, type_question) {
	if (!type_question) {
		if (question.match(reg_vic_anagrams)) {
			question = question.match(reg_vic_anagrams)[1]
			type_question = "anagram"

		} else if (question.match(reg_vic_fast)) {
			question = question.match(reg_vic_fast)[1]
			type_question = "fast"

		} else if (question.match(reg_vic_example)) {
			question = question.match(reg_vic_example)[1]
			type_question = "example"

		} else if (question.match(reg_vic_quest)) {
			question = question.match(reg_vic_quest)[1]
			type_question = "quest"
		}

	}

	var answ;
	if (type_question == "anagram") {
		const sorted_symbols = question.split("").sort().join("")
		if (sorted_anagrams[sorted_symbols]) {
			answ = sorted_anagrams[sorted_symbols]
		} else {
			console.log("Не найдена анаграмма:", question)
		}

	} else if (type_question == "fast") {
		answ = question

	} else if (type_question == "example") {
		answ = math.evaluate(question)
	
	} else if (type_question == "quest") {
		if (questions[question]) {
			answ = questions[question]
		} 
	}
	return answ;
}

function quiz_processing(question, type_question) {
	const answ = get_answ(question, type_question)

	if (answ) {
		last_question = {"question": question, "answ": answ}
		console.log("\033[36m" + "Ответ на викторину:", answ + "\033[0m")

	}
}

function tryme_processing(question) {
	for (let i=0; i < users_wait_answ.length; i++) {
		const nick = users_wait_answ.shift()
		const answ = get_answ(question) 
		let answ_user;
		if (answ) {
			last_question = {"question": question, "answ": answ}
			answ_user = `Ответ на вопрос "${question}": ${answ}`
		} else {
			answ_user = "К сожалению, я не знаю ответа"
		}
		actions.push({type: "answ",
					content: {
						message: answ_user,
						recipient: nick
					}})
	}
	

}

function server_message_processing(message) {
	if (message.includes("[Викторина] ")) {
		quiz_processing(message)
	} else {
		tryme_processing(message)
	}
}

function cmd_processing(sender, args) {
	try {
		if (args[0] == "help") {
			answ = "Возможные аргументы: [last(ответ на последнюю замеченную викторину), now(ответ на текущую викторину)]"
			return {type: "answ",
					content: {
						message: answ,
						recipient: sender
					}}
		} else {
			let action = "last"
			if (args[0] == "now") {
				action = "now"
			}
			if (action == "last") {
				if (last_question.answ) {
					answ = `Ответ на вопрос "${last_question.question}": ${last_question.answ}`

				} else {
					answ = "Бот пока не увидел ни одной викторины"
				}

			} else if (action == "now") {
				users_wait_answ.push(sender)
				return {
							type: "cmd",
							content: {
								module_sender: module_name,
								cmd: "/tryme info"
							}
						}

			} else {
				answ = "Возможные аргументы: [last(ответ на последнюю замеченную викторину), now(ответ на текущую викторину)]"
			}
		}
		actions.push({type: "answ",
					content: {
						recipient: sender,
						message: answ
					}})

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

function server_answ_processing(cmd, server_answ, values, identifier, is_confirmed) {
	try {
		//console.log("Зашло1", cmd.split(" "))
		console.log(cmd, values)
		if (cmd == "/tryme info") {
			if (is_confirmed) {
				const question = values.question
				tryme_processing(question)
			}

		}

	} catch (error) {
		actions.push({
			type: "error",
			content: {
				date_time: new Date(),
				module_name: module_name,
				error: error,
				args: [cmd, server_answ, values, identifier, is_confirmed]
			}})
	}
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

module.exports = {module_name, diagnostic_eval, quiz_processing, tryme_processing, server_answ_processing, cmd_processing, get_actions, help, structure}
