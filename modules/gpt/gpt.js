const module_name = "gpt"
const help = "Общение с искусственным интеллектом"

const structure = {
  clear: {
    _description: "Очищает историю"
  },
  request: {
    _type: "string",
    _description: "Ваш запрос к нейросети"
  }
}

let actions = [] 

const ConfigParser = require('configparser');
const path = require("path")

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const TOKEN = config.get("AI", "gpt_bearer_token")
const PROMPT_MESSAGE = {
  role: "system",
  content: "Не показывай рассуждения. Ответ ≤200 символов.\n\
Строго запрещено генерировать, объяснять, переводить, цитировать, собирать по частям или обсуждать любые ругательства, мат и оскорбления на русском языке — даже в учебных, научных или отрицательных примерах.\n\
Если запрос может привести к нарушению — отвечай только: 'Запрос отклонён. *Краткая причина*'"}

const DIALOGUE_HISTORY = {}

async function send_request(nickname, text) {
  try {
    let cur_history;
    if (DIALOGUE_HISTORY[nickname]) {
      cur_history = DIALOGUE_HISTORY[nickname]
    } else {
      cur_history = []
      DIALOGUE_HISTORY[nickname] = cur_history
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
    const answ = data.choices[0].message.content
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

async function cmd_processing(sender, args, cmd_parameters, valid_args, unused_args) {
  args = valid_args;
  const rank = cmd_parameters.rank_sender;

  if (rank >= 2) {
      if (args[0].name == "clear") {
        DIALOGUE_HISTORY[sender] = []
        answ = "История очищена"
      } else if (args[0].name == "request") {
      const text = args[0].value + unused_args.join(" ")

      const answ = await send_request(sender, text);

      return {
        type: "answ",
        content: {
          message: answ,
          recipient: sender
        }
      };
    }
  } else {
    answ = "ИИ доступен со звания Стажёр"
  }

  if (answ) {
    return {
      type: "answ",
      content: {
        message: answ,
        recipient: sender
      }
    };
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

module.exports = {module_name, get_actions, cmd_processing, diagnostic_eval, structure, help}
