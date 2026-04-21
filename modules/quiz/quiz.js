const path = require("path")
const math = require("mathjs");
const fs = require("fs")

const { COLORS } = require(path.join(BASE_DIR, "utils", "text.js"))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const {
	reg_vic_anagrams,
	reg_vic_fast,
	reg_vic_example,
	reg_vic_quest
} = require(path.join(BASE_DIR, "regex.js"))

const MODULE_NAME = "викторина"
const HELP = "Ответы на серверную викторину"
const INTERVAL_CHECK_ACTIONS = 1000
const STRUCTURE = {
  last: {
    _description: "Показывает ответ на последнюю замеченную ботом викторину(она может быть очень старой/с другой локации)"
  },
  now: {
    _description: "Показывает ответ на актуальную в данный момент на данной локации викторину"
  }
}


class QuizModule extends BaseModule {
	constructor () {
        super(MODULE_NAME, HELP, STRUCTURE, INTERVAL_CHECK_ACTIONS)

        this.SORTED_ANAGRAMS = JSON.parse(fs.readFileSync(path.join(__dirname, "anagrams.json"), "utf-8"))
				this.QUESTIONS = JSON.parse(fs.readFileSync(path.join(__dirname, "questions.json"), "utf-8"))

				this.last_question = {"question": undefined, "answ": undefined}

				this.users_wait_answ = []
    }

    get_answ(question, type_question) {
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
			let answ;
			console.log("Тип вопроса:", type_question)
			if (type_question === "anagram") {
				const sorted_symbols = question.split("").sort().join("")
				console.log("Расшифровка:", this.SORTED_ANAGRAMS[sorted_symbols])
				if (this.SORTED_ANAGRAMS[sorted_symbols]) {
					answ = this.SORTED_ANAGRAMS[sorted_symbols]
				} else {
					console.log("Не найдена анаграмма:", question)
				}

			} else if (type_question === "fast") {
				answ = question

			} else if (type_question === "example") {
				answ = math.evaluate(question)
			
			} else if (type_question === "quest") {
				if (this.QUESTIONS[question]) {
					answ = this.QUESTIONS[question]
				} 
			}
			return answ;
		}

		quiz_processing(question, type_question) {
			const answ = this.get_answ(question, type_question)

			if (answ) {
				this.last_question = {"question": question, "answ": answ}
				console.log(COLORS.blue + "Ответ на викторину:", answ + COLORS.reset);

			}
		}

		tryme_processing(question) {
			for (let i=0; i < this.users_wait_answ.length; i++) {
				const nick = this.users_wait_answ.shift()
				const answ = this.get_answ(question) 
				let answ_user;
				if (answ) {
					this.last_question = {"question": question, "answ": answ}
					answ_user = `Ответ на вопрос "${question}": ${answ}`
				} else {
					answ_user = "К сожалению, я не знаю ответа"
				}
				this.actions.push({
					type: "answ",
					content: {
						message: answ_user,
						recipient: nick
					}
				})
			}
		}

		server_message_processing(message) {
			if (message.includes("[Викторина] ")) {
				this.quiz_processing(message)
			} else {
				this.tryme_processing(message)
			}
		}

		_process(sender, args) {
			let answ;
			let action = "last"
			if (args[0] === "now") {
				action = "now"
			}
			if (action === "last") {
				if (this.last_question.answ) {
					answ = `Ответ на вопрос "${this.last_question.question}": ${this.last_question.answ}`

				} else {
					answ = "Бот пока не увидел ни одной викторины"
				}

			} else if (action === "now") {
				this.users_wait_answ.push(sender)
				this.actions.push({
					type: "cmd",
					content: {
						module_sender: this.module_name,
						cmd: "/tryme info"
					}
				})
			}
			return answ
		}

		server_answ_processing(cmd, server_answ, values, identifier, is_confirmed) {
			try {
				console.log(cmd, values)
				if (cmd === "/tryme info") {
					if (is_confirmed) {
						const question = values.question
						this.tryme_processing(question)
					}

				}

			} catch (error) {
				this.actions.push({
					type: "error",
					content: {
						date_time: new Date(),
						module_name: this.module_name,
						error: error,
						args: [cmd, server_answ, values, identifier, is_confirmed]
					}
				})
			}
		}
}


module.exports = QuizModule
