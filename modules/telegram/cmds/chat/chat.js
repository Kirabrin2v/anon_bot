const path = require("path")

const BaseCmd = require(path.join(__dirname, "..", "base.js"))
const bus = require(path.join(BASE_DIR, "event_bus.js"))
const { Color } = require(path.join(BASE_DIR, "regex.js"))
const { chatSchema, reg_full_nickname } = require(path.join(BASE_DIR, "regex.js"))
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

const CMD_NAME = "chat"
const STRUCTURE = {
    chat: {
        _description: "Включить/выключить пересылку сообщений",
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
            let [behind_part, ...ahead_part] = exclusion.split(keyword)
            ahead_part = ahead_part.join("")
            
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
            if (settings["chat_on"] === true) {
                settings["chat_on"] = false;
                answ = "Сообщения выключены"

            } else {
                settings["chat_on"] = true;
                const context = this.logs
                .filter(log_element => settings["allowed_chats"].includes(log_element.type_chat))
                .map(log_element => this.format_server_message(log_element.date_time, log_element))
                .slice(-this.len_context).join("\n")
                answ = `Сообщения включены. Последние сообщения:\n${context}`
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
        console.log(msg_obj)

        const nick = settings["show_nick"] || settings["server_nick"]
        const color = settings["nick_color"]

        let prefix = `[${color ? Color.paint(nick, color) : nick}] `
        let answ, type_chat, server_cmd, recipient;
        let send_in_private_message = false;

        const replied_msg = msg_obj.reply_to_message
        if (replied_msg && replied_msg.text) {
            const server_text = replied_msg.text.split("] ").slice(1).join("] ")
            const parsed = chatSchema.parse(server_text)
            const parsed_replied_message = chatSchema.parse(server_text)
            if (parsed) {
                type_chat = parsed.type_chat;
                recipient = parsed.sender
                const replied_message_parts = parsed_replied_message.message.split(" ")
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

    format_server_message(date_time, fields) {
        date_time = new Date(date_time); // копия
        date_time.setHours(date_time.getHours() + 3) // To MSC time
        const time = [date_time.getHours(), date_time.getMinutes(), date_time.getSeconds()]
          .map(n => String(n).padStart(2, '0')).join(':')

        if (fields.type_chat === "Приват") {
          const direction = fields.sender === bot_username
            ? `Я -> ${fields.recipient}`
            : `${fields.sender} -> Мне`
          return `[${time}] [${direction}] ${fields.message}`
        }

        const clan_part = fields.clan ? ` [${fields.clan}]` : ''
        const rank_part = fields.rank ? ` [${fields.rank}]` : ''
        return `[${time}] [${fields.type_chat}]${clan_part}${rank_part} ${fields.sender}: ${fields.message}`
    }

    replace_notice_nick(message, notify_aliases) {
        message = this.module_obj.escapeMarkdownV2(message)
        for (let replace_alias of notify_aliases) {
            replace_alias = this.module_obj.escapeMarkdownV2(replace_alias)
            message = message.replace(new RegExp(`(${replace_alias})`, 'ig'), '_*$1*_').replace(/\*__\*/g, "")
        }

        return message
    }

    player_message_processing(type_chat, sender, recipient, message, raw_message, date_time) {
        const parsed = chatSchema.parse(raw_message)
        parsed.date_time = date_time
        const formatted_message = this.format_server_message(date_time, parsed)
        for (const tg_id in this.module_obj.player_settings) {
            if (!this.module_obj.player_settings[tg_id]["allowed_chats"].includes(type_chat)) {
                continue;
            }
            const settings = this.module_obj.player_settings[tg_id]
            const notify_message = this.replace_notice_nick(formatted_message, settings["notify_aliases"])
            if (settings["chat_on"] === true) {
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
                this.module_obj.send_message_tg(tg_id, notify_message, undefined, false, "MarkdownV2")

            } else if (settings["nick_notice_on"]) {
                const notify_aliases = settings["notify_aliases"]
                const nick_notice_blacklist = settings["nick_notice_blacklist"]
                for (const alias of notify_aliases) {
                    const match_banwords = nick_notice_blacklist.filter(banword => banword.includes(alias))
                    const regex = this.generate_exclusion_regex(alias, match_banwords)
                    if (message.match(regex)) {
                        let context = this.logs
                            .filter(log_element => settings["allowed_chats"].includes(log_element.type_chat))
                            .map(log_element => this.format_server_message(log_element.date_time, log_element))
                            .slice(-this.len_context).join("\n")
                        context = this.module_obj.escapeMarkdownV2(context)
                        const answ = `${context}\n\n${notify_message}`
                        this.module_obj.send_message_tg(tg_id, answ, undefined, false, "MarkdownV2")
                        break;
                    }
                }
            }
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