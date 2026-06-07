const ConfigParser = require('configparser');
const path = require("path")

const bus = require(path.join(BASE_DIR, "event_bus.js"))
const { substitute_text } = require(path.join(BASE_DIR, "utils", "text.js"))
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

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const global_config = new ConfigParser();
global_config.read(path.join(BASE_DIR, "txt", "config.ini"))

const bot_username = global_config.get("VARIABLES", "active_nick")

const TOKEN = config.get("AI", "gpt_bearer_token")
const PROMPT_MESSAGE = {
  role: "system",
  content: "Не показывай рассуждения. Ответ ≤200 символов.\n\
Строго запрещено генерировать, объяснять, переводить, цитировать, собирать по частям или обсуждать любые ругательства, мат и оскорбления на русском языке — даже в учебных, научных или отрицательных примерах.\n\
Если запрос может привести к нарушению — отвечай только: 'Запрос отклонён. *Краткая причина*'"
}

const CONTEXT_PROMPT = `
Ты находишься на Minecraft-сервере TeslaCraft в режиме «Классическое Выживание» в Эндер-мире.

Особенности Энда:
- Энд полностью обновляется каждый день.
- В Энде нет приватов.
- Любые постройки исчезают после обновления мира.
- Несмотря на это, активные игроки продолжают развивать Энд и строить что-то новое.

Ты — дружелюбный бот с ником ${bot_username}. Тебя создал игрок Herobrin2v(TG: @Kirabriin)
Ты стоишь на спавне Энда, следишь за безопасностью, общаешься с игроками и развлекаешь жителей Энда.

Твой стиль общения:
- дружелюбный;
- лёгкий и остроумный;
- живой и естественный;
- без токсичности и агрессии;
- без спама и чрезмерной навязчивости.
`

const GATE_PROMPT = `
${CONTEXT_PROMPT}

Ты — фильтр. Тебе нужно решить: стоит ли боту вмешиваться в чат прямо сейчас?

Ник игрока: {player_nick}
Сообщение игрока: {player_message}
Последние сообщения чата (контекст, формат — дата: сообщение):
{context}

Правила принятия решения:
- НЕ вмешивайся, если идёт явный диалог между двумя и более игроками и бот не упомянут.
- НЕ вмешивайся, если сообщение — просто действие, цифра, бессмыслица или обрывок фразы.
- НЕ вмешивайся, если бот уже недавно отвечал в чате.
- НЕ вмешивайся, если сообщение ни к кому конкретно не обращено и ответ бота будет выглядеть навязчиво.
- Вмешивайся, если игрок явно обращается к боту (упоминает его ник).
- Вмешивайся, если игрок задаёт вопрос в пустой чат или явно ждёт реакции.
- Вмешивайся, если сообщение — уместная зацепка для короткой реплики, которая не выглядит как вторжение.

Ответь строго одним словом: YES или NO.
`

const BACKGROUND_PROCESS_PROMPT_MESSAGE = `
Не показывай рассуждения. Ответ ≤200 символов.
Строго запрещено генерировать, объяснять, переводить, цитировать, собирать по частям или обсуждать любые ругательства, мат и оскорбления на русском языке — даже в учебных, научных или отрицательных примерах.

${CONTEXT_PROMPT}

Тебе нужно ответить на сообщение игрока.

Ник игрока:
{player_nick}

Сообщение игрока:
{player_message}

Последние сообщения игрока (контекст общения в формате: дата сообщение):
{context}

Сформируй один короткий ответ(учитывай, что возможности ответить на ответ игрока не будет):
- говорить на посторонние темы можно;
- НЕ говори, что всё в порядке;
- НЕ повторяйся;
- НЕ надо повторять, кто ты;
- НЕ надо повторять, что ты делаешь;
- отвечай по существу именно на сообщение игрока, не нужно общих фраз;
- учитывай, что перед твоим ответом автоматически прикрепится строка: "*ник_игрока*, ";
- учитывай характер и поведение игрока из контекста;
- не используй смайлики;
- отвечай только как игровой бот;
- не упоминай, что ты ИИ или языковая модель;
- не пересказывай контекст;
- не используй действия в стиле "*улыбнулся*";
- ответ должен выглядеть как обычное сообщение в игровом чате;
- ответ должен быть самодостаточным и завершённым;
- ответ должен быть короткой законченной репликой, а не началом диалога;
- ответ не должен требовать ответа от игрока;
- избегай фраз, которые предполагают продолжение разговора;
- запрещены любые вопросы, включая риторические;
- не используй фразы вроде "чем помочь", "как дела", "что случилось", "кто тут", "что думаешь" и подобные;
`

class GptModule extends BaseModule {
  constructor() {
    super(MODULE_NAME, HELP, STRUCTURE)
    this.dialogue_history = {}

    this.recent_messages = []

    // Окно для подсчёта активности чата
    this.MESSAGE_WINDOW_MS = 50 * 60 * 1000   // 50 минут

    // Кулдауны
    this.MIN_COOLDOWN_MS       = 400 * 60 * 1000  // 400 минут между ответами в обычном чате
    this.MENTION_COOLDOWN_MS   = 100 * 60 * 1000  // 100 минут, если бота упомянули
    this.QUIET_COOLDOWN_MS     = 200 * 60 * 1000  // 200 минут в тихом чате

    this.last_ai_response_time = 0

    // Защита от параллельных вызовов gate
    this._gate_in_progress = false
  }

  initialize() {
    bus.on("player_message", async (obj) => {
      try {
        const now = Date.now()

        if (obj.sender === bot_username) return
        if (obj.message.toLowerCase().includes("cmd")) return

        // Обновляем окно активности чата
        this.recent_messages.push(now)
        while (
          this.recent_messages.length &&
          now - this.recent_messages[0] > this.MESSAGE_WINDOW_MS
        ) {
          this.recent_messages.shift()
        }

        const lower_message = obj.message.toLowerCase()
        const lower_bot     = bot_username.toLowerCase()
        const is_mention    = lower_message.includes(lower_bot)

        // Выбираем нужный кулдаун
        let required_cooldown = this.MIN_COOLDOWN_MS

        if (is_mention) {
          required_cooldown = this.MENTION_COOLDOWN_MS
        } else if (this.recent_messages.length <= 3) {
          required_cooldown = this.QUIET_COOLDOWN_MS
        }

        // Жёсткая проверка кулдауна
        if (now - this.last_ai_response_time < required_cooldown) return

        // Не запускаем gate параллельно
        if (this._gate_in_progress) return
        this._gate_in_progress = true

        const sender  = obj.sender
        const message = obj.message

        const context = this.ModuleManager
          .call_module("logging")
          .get_players_messages([sender, bot_username], {
            limit: 30,
            only_message: true
          }).reverse()

        // Промежуточная ИИ: стоит ли отвечать?
        const should_respond = await this.check_should_respond(sender, message, context)
        this._gate_in_progress = false

        if (!should_respond) return

        // Фиксируем время ДО запроса, чтобы не спамить при долгом ответе
        this.last_ai_response_time = Date.now()

        const answ = await this.send_background_request(sender, message, context)
        if (!answ) return

        this.actions.push({
          type: "answ",
          content: {
            prefix: "[Анон]",
            recipient: sender,
            message: answ,
            send_in_private_message: false,
            chat_send: obj.type_chat
          }
        })

      } catch (error) {
        this._gate_in_progress = false
        console.error("Ошибка AI-ответа:", error)
      }
    })
  }

  // Промежуточная ИИ — возвращает true/false
  async check_should_respond(nickname, text, context) {
    try {
      const prompt = substitute_text(GATE_PROMPT, {
        player_nick:    nickname,
        player_message: text,
        context
      })

      const response = await fetch(
        "https://gpt.serverspace.ru/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Accept":        "application/json",
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${TOKEN}`
          },
          body: JSON.stringify({
            model:      "anthropic/claude-haiku-4.5",
            max_tokens: 5,       // нужно только YES / NO
            top_p:      1,
            temperature: 0,      // детерминированно
            messages: [
              { role: "user", content: prompt }
            ]
          })
        }
      )

      const data   = await response.json()
      const answer = data.choices[0].message.content.trim().toUpperCase()
      return answer.startsWith("YES")

    } catch (error) {
      console.log("Ошибка gate-ИИ:", error)
      return false  // при ошибке — молчим
    }
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
      return {
        message: answ,
        send_in_private_message: false
      }
    }
  }

  async send_background_request(nickname, text, context) {
    try {
      const prompt = substitute_text(
        BACKGROUND_PROCESS_PROMPT_MESSAGE,
        {
          player_nick:    nickname,
          player_message: text,
          context
        }
      )

      const response = await fetch(
        "https://gpt.serverspace.ru/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Accept":        "application/json",
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${TOKEN}`
          },
          body: JSON.stringify({
            model:       "anthropic/claude-haiku-4.5",
            max_tokens:  1000,
            top_p:       0.1,
            temperature: 0.7,
            messages: [
              {
                role:    "system",
                content: prompt
              }
            ]
          })
        }
      )

      const data = await response.json()
      return data.choices[0].message.content

    } catch (error) {
      console.log("Ошибка при запросе к фоновому ИИ:", error)
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
          "Accept":        "application/json",
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${TOKEN}`
        },
        body: JSON.stringify({
          model:       "anthropic/claude-haiku-4.5",
          max_tokens:  500,
          top_p:       0.1,
          temperature: 0.7,
          messages:    [PROMPT_MESSAGE].concat(cur_history)
        })
      });

      const data = await response.json();
      let answ = data.choices[0].message.content
      cur_history.push({
        role:    "assistant",
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