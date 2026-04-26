const path = require("path")

const BaseCmd = require(path.join(__dirname, "..", "base.js"))
const bus = require(path.join(BASE_DIR, "event_bus.js"))
const { chatSchema, reg_full_nickname } = require(path.join(BASE_DIR, "regex.js"))


const PARTY_CMDS = ["pc", "зс"]
const CLAN_CMDS = ["cc", "сс"]
const PRIVATE_MESSAGE_CMDS = ["m", "ь"]
const PRIVATE_FAST_MESSAGE_CMDS = ["r", "к"]

const CMD_NAME = "chat"
const STRUCTURE = {
    chat: {
        _description: "Включить/выключить пересылку сообщений",
        _aliases: ["c"]
    },

    [PARTY_CMDS[0]]: {
        text: {
            _type: "text",
            _description: "Сообщение, которое нужно отправить"
        },
        _description: "Отправить сообщение в пати-чат",
        _aliases: PARTY_CMDS
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

        bus.on("player_message", (obj) => this.player_message_processing(
                obj.type_chat,
                obj.sender,
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
        } else {
            const flattern_args = this.CommandManager.flattenArgs(args)
            answ = this.chat_commands_processing(sender, flattern_args.slice(1).join(" "), flattern_args[0], msg_obj)
        } 


        return answ;
    }

    chat_commands_processing(tg_id, message, cmd, msg_obj) {
        const settings = this.module_obj.player_settings[tg_id]
        let prefix = `[${settings["nick"]}] `
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
                prefix += `[⤷ "${parsed_replied_message.message.slice(0, 10)} ..."] `
            }
        }

        if (!type_chat) {
            if (cmd) {
                if (CLAN_CMDS.includes(cmd)) {
                    type_chat = "Клан-чат"
                } else if (PARTY_CMDS.includes(cmd)) {
                    type_chat = "Пати-чат"
                } else if (PRIVATE_MESSAGE_CMDS.includes(cmd)) {
                    type_chat = "Приват"
                } else if (PRIVATE_FAST_MESSAGE_CMDS.includes(cmd)) {
                    return [
                        "Для быстрого ответа на сообщение используйте возможности Телеграм: ",
                        "ПКМ по сообщению -> 'Ответить'.\n",
                        "/r запрещена из-за постоянной смены получателей."
                    ]
                } else {
                    return null;
                }
            } else {
                if (message[0] === "!") {
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
            } else if (type_chat === "Приват") {
                if (!recipient) {
                    const message_parts = message.split(" ")
                    recipient = message_parts[0]
                    message = message_parts.slice(1).join(" ")
                }
                console.log("Ник получателя:", recipient, message)
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
        date_time.setHours(date_time.getHours() + 3) // To MSC time
        const time = [date_time.getHours(), date_time.getMinutes(), date_time.getSeconds()]
          .map(n => String(n).padStart(2, '0')).join(':')

        if (fields.type_chat === "Приват") {
          const direction = fields.sender === "Я"
            ? `Я -> ${fields.recipient}`
            : `${fields.sender} -> Мне`
          return `[${time}] [${direction}] ${fields.message}`
        }

        const clan_part = fields.clan ? ` [${fields.clan}]` : ''
        const rank_part = fields.rank ? ` [${fields.rank}]` : ''
        return `[${time}] [${fields.type_chat}]${clan_part}${rank_part} ${fields.sender}: ${fields.message}`
    }

    player_message_processing(type_chat, sender, message, raw_message, date_time) {
        const parsed = chatSchema.parse(raw_message)
        parsed.date_time = date_time
        const notify_message = this.format_server_message(date_time, parsed)
        for (const tg_id in this.module_obj.player_settings) {
            if (!this.module_obj.player_settings[tg_id]["allowed_chats"].includes(type_chat)) {
                continue;
            }
            const settings = this.module_obj.player_settings[tg_id]
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
                this.module_obj.send_message_tg(tg_id, notify_message)

            } else if (settings["notify_aliases"]) {
                const notyfy_aliases = JSON.parse(settings["notify_aliases"])
                for (const alias of notyfy_aliases) {
                    if (message.toLowerCase().includes(alias)) {
                        const context = this.logs
                            .filter(log_element => settings["allowed_chats"].includes(log_element.type_chat))
                            .map(log_element => this.format_server_message(log_element.date_time, log_element))
                            .slice(-this.len_context).join("\n")
                        const answ = `${context}\n\n${notify_message}`
                        this.module_obj.send_message_tg(tg_id, answ)
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