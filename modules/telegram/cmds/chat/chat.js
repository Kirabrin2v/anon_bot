const path = require("path")

const BaseCmd = require(path.join(__dirname, "..", "base.js"))
const bus = require(path.join(BASE_DIR, "event_bus.js"))
const { random_number } = require(path.join(BASE_DIR, "utils", "random.js")) 
const { Color } = require(path.join(BASE_DIR, "regex.js"))
const { chatSchema, reg_full_nickname, reg_nickname } = require(path.join(BASE_DIR, "regex.js"))
const ConfigParser = require('configparser');


const global_config = new ConfigParser();
global_config.read("txt/config.ini")

const bot_username = global_config.get("VARIABLES", "active_nick");
const PARTY_CMDS = ["pc", "зс"]
const CLAN_CMDS = ["cc", "сс"]
const PRIVATE_MESSAGE_CMDS = ["m", "ь"]
const PRIVATE_FAST_MESSAGE_CMDS = ["r", "к"]
const FRIEND_CHAT_CMDS_1 = ["fr", "ак"]
const FRIEND_CHAT_CMDS_2 = ["notify", "n", "тщешан", "т"]

const CMD_NAME = "server_chat"
const STRUCTURE = {
    chat: {
        switch: {
            chat_type: {
                _type: "text",
                _description: "Тип чата(Лк, Пати-чат и др.)"
            },
            _description: "Включить/выключить пересылку из конкретных видов чата",
            _optional: true
        },
        list: {
            _description: "Список отслеживаемых типов чата",
            _optional: true
        },
        info: {
            _description: "Информация о команде",
            _optional: true
        },
        _description: "Включить/выключить пересылку из всех видов чата",
        _aliases: ["c"]
    },

    nick_notice: {
        blacklist: {
            clear: {
                _description: "Очистить список запретных слов"
            },
            list: {
                _description: "Список запрещённых слов"
            },
            words: {
                _type: "string",
                _multiple: true,
                _description: "Слова, которые нужно игнорировать. Все введённые слова регистронезавимы"
            },
            _description: "Выключить триггер для определённых слов",
            _optional: true
        },
        _description: "Включить/выключить уведомления о сообщениях, в которых встречается Ваш ник. Сообщение приходит даже при выключенном через /c чате.",
        _aliases: ["nn"]
    },

    chat_pattern: {
        show: {
            _description: "Показать текущий шаблон чата"
        },
        edit: {
            chat_pattern: {
                _type: "text",
                _description: "Шаблон сообщения. Пример и доступные параметры можно посмотреть в /chat_pattern info"
            },
            _description: "Изменить шаблон шата"
        },
        info: {
            _description: "Информация о доступных параметрах"
        },
        reset: {
            _description: "Сбросить шаблон до заводских настроек"
        },
        _description: "Изменить вид, в котором сообщения пересылаются с сервера",
        _aliases: ["cp"]
    },

    [PARTY_CMDS[0]]: {
        text: {
            _type: "text",
            _description: "Сообщение, которое нужно отправить"
        },
        _description: "Отправить сообщение в пати-чат",
        _aliases: PARTY_CMDS
    },

    [FRIEND_CHAT_CMDS_1[0]]: {
        [FRIEND_CHAT_CMDS_2[0]]: {
            text: {
                _type: "text",
                _description: "Сообщение, которое нужно отправить"
            },
            _description: "Отправить сообщение в чат друзей",
            _aliases: FRIEND_CHAT_CMDS_2
        },
        _description: "Команды друзей",
        _aliases: FRIEND_CHAT_CMDS_1
    },

    [CLAN_CMDS[0]]: {
        text: {
            _type: "text",
            _description: "Сообщение, которое нужно отправить"
        },
        _description: "Отправить сообщение в клан-чат",
        _aliases: CLAN_CMDS
    },

    [PRIVATE_MESSAGE_CMDS[0]]: {
        nick: {
            text: {
                _type: "text",
                _description: "Сообщение, которое нужно отправить"
            },
            _type: "nick",
            _description: "Ник получателя"
        },
        _description: "Отправить личное сообщение",
        _aliases: PRIVATE_MESSAGE_CMDS
    },

    [PRIVATE_FAST_MESSAGE_CMDS[0]]: {
        text: {
            _type: "text",
            _description: "Сообщение, которое нужно отправить"
        },
        _description: "Отправить личное сообщение",
        _aliases: PRIVATE_FAST_MESSAGE_CMDS
    },

    _description: "Управление чатом"
};



class ChatCmd extends BaseCmd {
    constructor(module_obj) {
        super(module_obj, CMD_NAME, STRUCTURE)

        this.logs = []
        this.len_context = 5;

        this.CHECK_PLAYERS_COUNT_INTERVAL = 600000 // 10 минут
        this.WIRETAPPING_NOTIFY_INTERVAL = 86400000 // 24 часа
        this.last_wiretapping_notify_time = 0

        this.all_chat_types = ["Приват", "Лк", "Гл", "Клан-чат", "Пати-чат", "Друзья"]
        this.wait_continue_dialogue = {}
        this.wait_continue_dialogue_interval = 300000

        bus.on("player_message", (obj) => this.player_message_processing(
                obj.type_chat,
                obj.sender,
                obj.recipient,
                obj.message,
                obj.raw_message,
                obj.date_time
            )
        )

        bus.on("telegram_authorized_message", (obj) => {
            this.message_processing(
                obj.tg_id,
                obj.message,
                obj.msg_obj
            )
        })
    }

    initialize() {
        this.default_standard_chat_pattern = this.module_obj.config.get("VARIABLES", "default_standard_chat_pattern")
        setInterval(() => this.check_nearby_players_count(), this.CHECK_PLAYERS_COUNT_INTERVAL)
    }

    check_nearby_players_count() {
        const nearby_players_count = this.module_obj.ModuleManager
            .call_module("entities")
            .get_players(true)
            .length

        if (
            nearby_players_count === 3 &&
            Date.now() - this.last_wiretapping_notify_time > this.WIRETAPPING_NOTIFY_INTERVAL
        ) {
            this.last_wiretapping_notify_time = Date.now()
            this.module_obj.actions.push({
                type: "answ",
                content: {
                    message: "Бот логирует все сообщения, которые видит. Пожалуйста, не пишите в чат секретную информацию."
                }
            })
        }
    }

    generate_exclusion_regex(keyword, exclusions) {
        let behind_parts = new Set();
        let ahead_parts = new Set();
        for (const exclusion of exclusions) {
            const [behind_part, ...ahead_part_list] = exclusion.split(keyword)
            const ahead_part = ahead_part_list.join("")
            
            behind_parts.add(behind_part)
            ahead_parts.add(ahead_part)
        }
        behind_parts.delete("")
        ahead_parts.delete("")
        behind_parts = Array.from(behind_parts)
        ahead_parts = Array.from(ahead_parts)
        const behind_condition = behind_parts.length > 0 ? `(?<!${behind_parts.join("|")})` : "" 
        const ahead_condition = ahead_parts.length > 0 ? `(?!${ahead_parts.join("|")})` : ""
        const regex = new RegExp(behind_condition + keyword + ahead_condition, "i")

        return regex
    }

    _process(sender, args, _unused_args, _cmd, msg_obj) {
        let answ;
        const settings = this.module_obj.player_settings[sender]
        if (args[0].name === "chat") {
            if (args.length === 1) {
                if (settings["chats_on"].length === 0) {
                    settings["chats_on"] = this.all_chat_types
                    const context = this.logs
                        .filter(log_element => this.check_access_to_msg(sender, log_element))
                        .map(log_element => this.format_server_message(log_element.date_time, log_element, settings["chat_pattern"]))
                        .slice(-this.len_context).join("\n")
                    answ = `Сообщения включены. Последние сообщения:\n${context}`
                } else {
                    settings["chats_on"] = []
                    answ = "Сообщения выключены"
                }
            } else if (args[1].name === "switch") {
                const chat_type = args[2].value
                if (this.all_chat_types.includes(chat_type)) {
                    let action;
                    if (settings["chats_on"].includes(chat_type)) {
                        action = "выключена"
                        settings["chats_on"] = settings["chats_on"].filter(cur_chat_type => cur_chat_type !== chat_type)
                    } else {
                        action = "включена"
                        settings["chats_on"].push(chat_type)
                    }
                    answ = `Пересылка сообщений из ${chat_type} успешно ${action}`
                } else {
                    answ = `Введённого чата не существует. Доступные виды чата:\n${this.all_chat_types.join("\n")}`
                }
            } else if (args[1].name === "list") {
                answ = `Включённые на данный момент чаты:\n${settings["chats_on"].join("\n")}`
            } else if (args[1].name === "info") {
                const color_symbol = Color.COLORS[settings.nick_color]?.toLowerCase()
                answ = "Команда позволяет управлять тем, что будет пересылаться из Майнкрафт\\-чата в Телеграм\\-чат\n\n" +
                    "Чтобы написать что\\-то в Майнкрафт\\-чат, необходимо без дополнительных команд отправить боту нужный текст\n" +
                    "Чтобы *ответить* на конкретное сообщение, нужно переслать его\\(ПКМ по сообщению \\-\\> \"Ответить\"\\) и написать нужный текст\n\n" +
                    "Команда /c включает/выключает пересылку сообщений полностью\n" +
                    "Команда /c switch \\<тип чата\\> включает/выключает пересылку из определённого чата\\(например, только из глобального чата\\)\n\n" +
                    "Приватные сообщения передаются *не все*\\. Чтобы получить приватное сообщение, оно должно быть адресовано *именно Вам*\n" +
                    "Для этого собеседник должен добавить в начало сообщения:\n" +
                    (color_symbol ? "либо\n" : "") +
                    `\`${settings["show_nick"]}\\. \`\n` +
                    (color_symbol ? "либо\n" : "") +
                    (color_symbol ? `\`${color_symbol}\`\\. \n` : "") +
                    "*Пробел после точки обязателен*"
                return {
                    message: answ,
                    parse_mode: "MarkdownV2"
                }
            }

        } else if (args[0].name === "chat_pattern") {
            if (args[1].name === "show") {
                let chat_pattern;
                if (settings["chat_pattern"]) {
                    chat_pattern = settings["chat_pattern"]
                } else {
                    chat_pattern = this.default_standard_chat_pattern
                }
                chat_pattern = this.module_obj.escapeMarkdownV2(chat_pattern)
                answ = "Текущий шаблон чата: \n" +
                    "```text\n" +
                    `${chat_pattern}` +
                    "```"

                return {
                    message: answ,
                    parse_mode: "MarkdownV2"
                }

            } else if (args[1].name === "edit") {
                const new_chat_pattern = args[2].value
                settings["chat_pattern"] = new_chat_pattern
                answ = "Шаблон сообщений успешно изменён!"

            } else if (args[1].name === "reset") {
                settings["chat_pattern"] = null;
                answ = "Шаблон успешно сброшен до заводских настроек"
            
            } else if (args[1].name === "info") {
                answ = "С помощью этой команды Вы можете изменить вид серверного сообщения\\. Для этого нужно задать его шаблон\\. " +
                    "В шаблоне ключевые слова заменяются на реальные значения, полученные с сервера\\. Ниже приведён список всех доступных ключевых слов:\n\n" +
                    "*time* \\- время в формате HH:MM:SS;\n" +
                    "*YYYY* \\- текущий год;\n" +
                    "*MM* \\- текущий месяц;\n" +
                    "*DD* \\- текущий день;\n" +
                    "*hh* \\- текущие часы;\n" +
                    "*mm* \\- текущие минуты;\n" +
                    "*ss* \\- текущие секунды;\n" +
                    "*chat*\\_type \\- тип чата\\. Например, Френд\\-чат или локальный чат;\n" +
                    "*clan*\\_part \\- клан\\. Если клана нет \\- ничего не подставится;\n" +
                    "*rank*\\_part \\- звание\\. Если звания нет \\- ничего не подставится;\n" +
                    "*sender* \\- отправитель\\. Игрок, отправивший сообщение;\n" +
                    "*message* \\- сообщение, которое отправил игрок\\.\n\n" +
                    "Для использования ключевого слова нужно заключить его в фигурные скобки\\. Например: \\{time\\}\n\n" +
                    "Примеры шаблонов:\n" +
                    "1\\) Из\n`{sender}: {message}`\nполучится\n`Kirabrn: Привет!`\n" +
                    "2\\) Из\n`sender:{sender},время - {time}`\nполучится\n`sender:Kirabrin,время - 01:13:21`"

                return {
                    message: answ,
                    parse_mode: "MarkdownV2"
                }
            }

        } else if (args[0].name === "nick_notice") {
            if (args.length === 1) {
                if (settings["nick_notice_on"] === true) {
                    settings["nick_notice_on"] = false;
                    answ = "Уведомления об упоминаниях выключены"

                } else {
                    settings["nick_notice_on"] = true;

                    answ = `Уведомления об упоминаниях включены. Ваши ники:\n${settings["notify_aliases"].join("; ")}`

                }
            } else if (args[1].name === "blacklist") {
                if (args[2].name === "clear") {
                    settings["nick_notice_blacklist"] = []
                    answ = "Список успешно очищен"

                } else if (args[2].name === "list") {
                    const banwords = settings["nick_notice_blacklist"]
                    answ = `Текущий список запретных слов:\n${banwords.join('\n')}`


                } else if (args[2].name === "words"){
                    const banwords = args[2].value
                    settings["nick_notice_blacklist"] = banwords
                    answ = `Фильтр успешно изменён. Текущий список:\n${banwords.join('\n')}`
                }
            }
        } else {
            const flattern_args = this.CommandManager.flattenArgs(args)
            answ = this.chat_commands_processing(sender, flattern_args.slice(1).join(" "), flattern_args[0], msg_obj)
        } 


        return answ;
    }

    chat_commands_processing(tg_id, message, cmd, msg_obj) {
        const settings = this.module_obj.player_settings[tg_id]

        const nick = settings["show_nick"] || settings["server_nick"]
        const color = settings["nick_color"]

        let prefix = `[${color ? Color.paint(nick, color) : nick}] `
        let answ, type_chat, server_cmd, recipient;
        let send_in_private_message = false;

        const tg_replied_msg = msg_obj.reply_to_message
        if (tg_replied_msg && tg_replied_msg.text) {
            const db_replied_message = this.module_obj.get_tg_message(tg_id, { message_id: tg_replied_msg.message_id })
            const parsed_replied_message = JSON.parse(db_replied_message.parsed_data)
            if (parsed_replied_message) {
                type_chat = parsed_replied_message.type_chat;
                recipient = parsed_replied_message.sender

                const quote_pattern = new RegExp(`(?<=^\\[${reg_nickname}\\]) \\[⤷ "[^"]*"\\]`)
                let replied_message = parsed_replied_message.message
                replied_message = replied_message.replace(quote_pattern, "")
                const replied_message_parts = replied_message.split(" ")
                const hidden_text = replied_message_parts.length >= 3 ? ' ...' : ''
                prefix += `[⤷ "${replied_message_parts.slice(0, 3).join(' ')}${hidden_text}"] `
            }
        }

        if (!type_chat) {
            if (cmd) {
                if (CLAN_CMDS.includes(cmd)) {
                    type_chat = "Клан-чат"
                } else if (PARTY_CMDS.includes(cmd)) {
                    type_chat = "Пати-чат"
                } else if (
                    FRIEND_CHAT_CMDS_1.includes(cmd)
                    && FRIEND_CHAT_CMDS_2.includes(message.split(" ")[0])
                ) {
                    type_chat = "Друзья"
                    const message_parts = message.split(" ")
                    message = message_parts.slice(1).join(" ")
                } else if (PRIVATE_MESSAGE_CMDS.includes(cmd)) {
                    type_chat = "Приват"
                } else if (PRIVATE_FAST_MESSAGE_CMDS.includes(cmd)) {
                    return [
                        "Для быстрого ответа на сообщение используйте возможности Телеграм: ",
                        "ПКМ по сообщению -> 'Ответить'.\n",
                        "/r запрещена из-за постоянной смены получателей."
                    ].join(" ")
                } else {
                    return "Я не понял, куда Вы хотите отправить сообщение";
                }
            } else {
                if (message[0] === "!") {
                    message = message.slice(1)
                    type_chat = "Гл"

                } else {
                    type_chat = "Лк"
                }
            }
        }

        if (settings["allowed_chats"].includes(type_chat)) {
            if (type_chat === "Клан-чат") {
                server_cmd = "/cc"
            } else if (type_chat === "Пати-чат") {
                server_cmd = "/pc"
            } else if (type_chat === "Друзья") {
                server_cmd = "/fr n"
            } else if (type_chat === "Приват") {
                if (!recipient) {
                    const message_parts = message.split(" ")
                    recipient = message_parts[0]
                    message = message_parts.slice(1).join(" ")
                }
                if (!recipient.match(reg_full_nickname)) {
                    return "Некорректно указан ник получателя"
                }

                const delete_tg_from_wait_dialogue = () => {
                    if (this.wait_continue_dialogue[recipient.toLowerCase()]) {
                        delete this.wait_continue_dialogue[recipient.toLowerCase()][tg_id];
                    }
                };
                if (this.wait_continue_dialogue[recipient.toLowerCase()]) {
                    const dialogue_candidates = this.wait_continue_dialogue[recipient.toLowerCase()]
                    if (dialogue_candidates[tg_id]) {
                        clearTimeout(dialogue_candidates[tg_id])
                    } 
                    dialogue_candidates[tg_id] = setTimeout(delete_tg_from_wait_dialogue, this.wait_continue_dialogue_interval)
                
                } else {
                    this.wait_continue_dialogue[recipient.toLowerCase()] = {
                        [tg_id]: setTimeout(delete_tg_from_wait_dialogue, this.wait_continue_dialogue_interval)
                    }
                }

            } else if (type_chat === "Гл") {
                prefix = `!${prefix}`
            }
        }

        if (type_chat === "Приват") {
            send_in_private_message = true;
        }

        if (server_cmd) {
            this.module_obj.actions.push({
                type: "cmd",
                content: {
                    cmd: `${server_cmd} ${prefix}${message}`
                }
            })
            answ = "Сообщение отправлено!"
        }

        if (["Лк", "Гл", "Приват"].includes(type_chat)) {
            this.module_obj.actions.push({
                type: "answ",
                content: {
                    message,
                    recipient,
                    send_in_private_message,
                    prefix: `${prefix}`
                }
            })
            answ = "Сообщение отправлено!"
        }
        if (answ) {
            return answ
        }
        return "Что-то пошло не так. Ничего не отправилось"
    }

    message_processing(tg_id, message, msg_obj) {
        const answ = this.chat_commands_processing(tg_id, message, undefined, msg_obj)
        this.module_obj.send_message_tg(tg_id, answ)

    }

    format_server_message(
        date_time,
        fields,
        standard_pattern
    ) {
        if (!standard_pattern) {
            standard_pattern = this.default_standard_chat_pattern
        }
        date_time = new Date(date_time); // копия
        date_time.setHours(date_time.getHours() + 3) // To MSC time
        let [
            YYYY,
            MM,
            DD,
            hh,
            mm,
            ss
        ] = [
            String(date_time.getFullYear()),
            String((date_time.getMonth() % 12 + 1)).padStart(2, '0'),
            String(date_time.getDate()).padStart(2, '0'),
            String(date_time.getHours()).padStart(2, '0'),
            String(date_time.getMinutes()).padStart(2, '0'),
            String(date_time.getSeconds()).padStart(2, '0')
        ]
        const time = [hh, mm, ss].join(':')

        if (fields.type_chat === "Приват") {
          const direction = fields.sender === bot_username
            ? `Я -> ${fields.recipient}`
            : `${fields.sender} -> Мне`
          return `[${time}] [${direction}] ${fields.message}`
        }

        const clan_part = fields.clan ? ` [${fields.clan}]` : ''
        const rank_part = fields.rank ? ` [${fields.rank}]` : ''
        return this.module_obj.ModuleManager.call_module("text").substitute_text(
                standard_pattern,
                {
                    time: time,
                    YYYY,
                    MM,
                    DD,
                    hh,
                    mm,
                    ss,
                    chat_type: fields.type_chat,
                    clan_part,
                    rank_part,
                    sender: fields.sender,
                    message: fields.message
                }
            )
    }

    replace_notice_nick(message, notify_aliases) {
        message = this.module_obj.escapeMarkdownV2(message)
        for (let replace_alias of notify_aliases) {
            replace_alias = this.module_obj.escapeMarkdownV2(replace_alias)
            message = message.replace(new RegExp(`(${replace_alias})`, 'ig'), '_*$1*_').replace(/\*__\*/g, "")
        }

        return message
    }

    can_receive_private_message(tg_id, sender, message) {
        const settings = this.module_obj.player_settings[tg_id]
        if (settings.is_senior) return true;

        let identifier;
        if (sender === bot_username) {
            const identifier_pattern = new RegExp(`^\\[${reg_nickname}\\]`)
            const identifier_match = message.match(identifier_pattern)
            if (!identifier_match) return false;
            identifier = identifier_match[1].toLowerCase()
        } else {            
            const identifier_pattern = new RegExp(`^${reg_nickname}(?=\\. )`)
            const identifier_match = message.match(identifier_pattern)
            if (identifier_match) {
                identifier = identifier_match[1].toLowerCase()

            }
            if (
                this.wait_continue_dialogue[sender.toLowerCase()]
                && this.wait_continue_dialogue[sender.toLowerCase()][tg_id]
                && Object.keys(this.wait_continue_dialogue[sender.toLowerCase()]).length === 1
                && !Object.keys(this.module_obj.player_settings).some(id => this.check_identifier(identifier, this.module_obj.player_settings[id]))
            ) {
                return true;
            }

        }

        if (this.check_identifier(identifier, settings)) {
            return true;
        }
        return false;
    }

    check_identifier(identifier, settings) {
        if (identifier === undefined) return false;
        const color_symbol = Color.COLORS[settings.nick_color]?.toLowerCase()
        const show_nick = settings.show_nick?.toLowerCase()
        if (
            identifier === color_symbol
            || identifier === show_nick
            || (settings.server_nick && identifier === settings.server_nick.toLowerCase())
        ) {
            return true;
        }
        return false;
    }

    check_access_to_msg(tg_id, log_element) {
        const settings = this.module_obj.player_settings[tg_id]
        if (!settings["allowed_chats"].includes(log_element.type_chat)) {
            return false;
        }

        if (log_element.type_chat === "Приват") {
            return this.can_receive_private_message(tg_id, log_element.sender, log_element.message)
        }

        return true;
    }

    send_feedback(sender, count_sended_private_messages) {
        if (sender === bot_username) return;
        let answ;
        const [num1, num2] = Array.from(
            { length: 2 },
            () => random_number(1, 999999)
        );
        const prefix = `[${num1}ant.fld${num2}]`

        let count_seniors = 0;
        Object.values(this.module_obj.player_settings).forEach(settings => {
            if (settings.is_senior && settings.chats_on.includes("Приват")) {
               count_seniors += 1 
            }
        })

        if (count_sended_private_messages > count_seniors) {
            answ = "Сообщение успешно отправлено!"

        } else if (
            this.wait_continue_dialogue[sender.toLowerCase()]
            && Object.keys(this.wait_continue_dialogue[sender.toLowerCase()]).length > 0
        ) {
            answ = "Чтобы отправить сообщение кому-то, нужно в начало сообщения добавить: \"{ник}. \". Точка и пробел после ника обязательны"
        }

        if (answ) { 
            this.module_obj.actions.push({
                type: "answ",
                content: {
                    message: answ,
                    recipient: sender,
                    prefix: prefix
                }
            })
        }
    }

    player_message_processing(type_chat, sender, recipient, message, raw_message, date_time) {
        const parsed = chatSchema.parse(raw_message)
        parsed.date_time = date_time

        let count_sended_private_messages = 0;

        for (const tg_id in this.module_obj.player_settings) {
            let is_sended = false;

            const settings = this.module_obj.player_settings[tg_id]
            if (!settings["allowed_chats"].includes(type_chat)) {
                continue;
            }
            if (type_chat === "Приват") {
                if (!this.can_receive_private_message(tg_id, sender, message)) {
                    continue;
                }
            }

            if (settings["whitelist_on"] === true) {
                if (!settings["whitelist_nicks"].includes(sender)) {
                    continue;
                }
            }
            if (settings["blacklist_on"] === true) {
                if (settings["blacklist_nicks"].includes(sender)) {
                    continue;
                }
            }

            const formatted_message = this.format_server_message(date_time, parsed, settings["chat_pattern"])
            const notify_message = this.replace_notice_nick(formatted_message, settings["notify_aliases"])

            if (settings["chats_on"].includes(type_chat)) {
                this.module_obj.send_message_tg(tg_id, notify_message, undefined, false, "MarkdownV2", parsed)
                is_sended = true;

            } else if (settings["nick_notice_on"]) {
                const notify_aliases = settings["notify_aliases"]
                const nick_notice_blacklist = settings["nick_notice_blacklist"]
                for (const alias of notify_aliases) {
                    const match_banwords = nick_notice_blacklist.filter(banword => banword.includes(alias))
                    const regex = this.generate_exclusion_regex(alias, match_banwords)
                    if (message.match(regex)) {
                        let context = this.logs
                            .filter(log_element => this.check_access_to_msg(tg_id, log_element))
                            .map(log_element => this.format_server_message(log_element.date_time, log_element, settings["chat_pattern"]))
                            .slice(-this.len_context).join("\n")
                        context = this.module_obj.escapeMarkdownV2(context)
                        const answ = `${context}\n\n${notify_message}`
                        this.module_obj.send_message_tg(tg_id, answ, undefined, false, "MarkdownV2", parsed)
                        is_sended = true;
                        break;
                    }
                }
            }
            if (type_chat === "Приват" && is_sended) {
                count_sended_private_messages += 1
            }
        }
        if (type_chat === "Приват") {
            this.send_feedback(sender, count_sended_private_messages)
        }

        if (this.logs.length < 5) {
                this.logs.push(parsed)
                
        } else {
            this.logs.shift()
            this.logs.push(parsed)
        }
    }
}

module.exports = ChatCmd