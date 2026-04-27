const ConfigParser = require('configparser');
const path = require("path")

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const { BaseModule } = require(path.join(__dirname, "..", "base.js"))


const MODULE_NAME = "gpt"
const HELP = "Общение с искусственным интеллектом"
const STRUCTURE = {
  clear: {
    _description: "Очищает историю"
  },
  request: {
    _type: "text",
    _description: "Ваш запрос к нейросети"
  }
}

const TOKEN = config.get("AI", "gpt_bearer_token")
const PROMPT_MESSAGE = {
  role: "system",
  content: "Не показывай рассуждения. Ответ ≤200 символов.\n\
Строго запрещено генерировать, объяснять, переводить, цитировать, собирать по частям или обсуждать любые ругательства, мат и оскорбления на русском языке — даже в учебных, научных или отрицательных примерах.\n\
Если запрос может привести к нарушению — отвечай только: 'Запрос отклонён. *Краткая причина*'"
}


class GptModule extends BaseModule {
  constructor () {
    super(MODULE_NAME, HELP, STRUCTURE)
    this.dialogue_history = {}
  }

  async _process(sender, args, cmd_parameters) {
    const rank = cmd_parameters.rank_sender;
    let answ;

    if (rank >= 2) {
      if (args[0].name === "clear") {
        this.dialogue_history[sender] = []
        answ = "История очищена"
      } else if (args[0].name === "request") {
        const text = args[0].value

        answ = await this.send_request(sender, text);
      }
    } else {
      answ = "ИИ доступен со звания Стажёр"
    }

    if (answ) {
      return answ
    }
  }

  async send_request(nickname, text) {
    try {
      let cur_history;
      if (this.dialogue_history[nickname]) {
        cur_history = this.dialogue_history[nickname]
      } else {
        cur_history = []
        this.dialogue_history[nickname] = cur_history
      }
      cur_history.push({
        role: "user",
        content: text
      })
      const response = await fetch("https://gpt.serverspace.ru/v1/chat/completions", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TOKEN}`
        },
        body: JSON.stringify({
          model: "gpt-oss-20b",
          max_tokens: 1000,
          top_p: 0.1,
          temperature: 0.7,
          messages: [PROMPT_MESSAGE].concat(cur_history)
        })
      });

      const data = await response.json();
      let answ = data.choices[0].message.content
      cur_history.push({
        role: "assistant",
        content: answ
      })
      if (!answ) {
        answ = "Я слишком долго думал и забыл свою мысль"
      }
      return answ
    } catch (error) {
      console.error("Ошибка запроса:", error);
    }
  }
}

module.exports = GptModule
