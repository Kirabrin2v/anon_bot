const ConfigParser = require("configparser");
const path = require("path")

const BaseCmd = require(path.join(__dirname, "..", "base.js"))
const bus = require(path.join(BASE_DIR, "event_bus.js"))

const global_config = new ConfigParser();
global_config.read(path.join(BASE_DIR, "txt", "config.ini"))


const CMD_NAME = "server"
const STRUCTURE = {
  _description: "Серверные команды",
  account: {
    _description: "Привязать Телеграм к Майнкрафт-аккаунту"
  },

  near: {
    _description: "Список игроков, находящихся рядом"
  },
  lookup: {
    nick: {
        _type: "nick",
        _optional: true,
    },
    _description: "Информация об игроке"
  },
  seen: {
    nick: {
        _type: "nick",
    },
    _description: "Местоположение игрока"
  },
  spawnmob: {
    count: {
        mob_name: {
            rider_name: {
                _type: "string",
                _multiple: true,
                _optional: true,
                _description: "Название моб-наездника"
            },
            _type: "string",
            _description: "Название моба"
        },
        _type: "int",
        _optional: true
    },
    _description: "Спавнит мобов"
  },
  friend: {
    add: {
        nickname: {
            _type: "nick"
        },
        _need_rank: 1,
        _description: "Отправить игроку заявку в друзья"
    },
    accept: {
        nickname: {
            _type: "nick"
        },
        _need_rank: 1,
        _description: "Принять заявку в друзья от игрока"
    },
    deny: {
        nickname: {
            _type: "nick"
        },
        _need_rank: 1,
        _description: "Отклонить заявку в друзья от игрока"
    },
    remove: {
        nickname: {
            _type: "nick"
        },
        _need_rank: 1,
        _description: "Удалить игрока из друзей"
    },
    tp: {
        nickname: {
            _type: "nick"
        },
        _need_rank: 1,
        _description: "Отправиться на режим к другу"
    },
    list: {
        _description: "Страница Посмотреть список друзей"
    },
    requests: {
        page_number: {
            _description: "Номер страницы",
            _optional: true
        },
        _description: "Посмотреть список запросов"
    },
    best: {
        nickname: {
            _type: "nick"
        },
        _need_rank: 1,
        _description: "Назначить лучшим другом"
    },
    _description: "Друзья",
  }
};


class ServerCmd extends BaseCmd {
    constructor(module_obj) {
        super(module_obj, CMD_NAME, STRUCTURE)

        this.wait_connect_minecraft = {}

        bus.on("player_message", (obj) => this.connect_minecraft_to_tg(
                obj.sender,
                obj.message
            )
        )
    }

    connect_minecraft_to_tg(sender, message) {
        Object.entries(this.wait_connect_minecraft).forEach(([tg_id, confirm_message]) => {
            if (message.toLowerCase() === confirm_message.toLowerCase()) {
                this.module_obj.player_settings[tg_id].server_nick = sender
                this.module_obj.actions.push({
                    type: "answ",
                    content: {
                        message: "Аккаунт успешно привязан!",
                        recipient: sender,
                        send_in_private_message: true
                    }
                })
                delete this.wait_connect_minecraft[tg_id]
            }
        })
    }

    _process(sender, args, _unused_args, _cmd, msg_obj) {
        if (args[0].name === "account") {
            if (this.module_obj.player_settings[sender].server_nick) {
                return `У Вас уже привязан аккаунт: ${this.module_obj.player_settings[sender].server_nick}. Если Вы привязали не тот аккаунт, обратитесь к @Kirabriin для его изменения`
            } else {
                const bot_username = global_config.get("VARIABLES", "active_nick")
                const tg_id = msg_obj.chat.id
                const username = msg_obj.chat.username
                const username_block = username ? `@${username}` : "юзернейм отсутствует"

                const confirm_message = `(TG ID: ${msg_obj.chat.id}; Username: ${username_block}) - мой Телеграм-аккаунт, и я несу за него ответственность`
                this.wait_connect_minecraft[tg_id] = confirm_message
                setTimeout(() => {
                    delete this.wait_connect_minecraft[tg_id]
                }, 600000)

                const answ = ( 
                    `Отправьте мне\\(${this.module_obj.escapeMarkdownV2(bot_username)}\\) в течение 10 минут в ЛС на сервере следующее сообщение:\n` +
                    "```\n" +
                    this.module_obj.escapeMarkdownV2(confirm_message) +
                    "```\n\n" +
                    "Это подтвердит, что именно Вы пользуетесь аккаунтом и может быть использовано для переноса наказаний за нарушения, совершённые Вами через бота, на Ваш серверный аккаунт\n\n" +
                    "Просьба привязывать свой основной аккаунт\\. После подтверждения изменить аккаунт *самостоятельно* не получится\\."
                )
                return { 
                    message: answ,
                    parse_mode: "MarkdownV2"
                };
            }
        }
        else if (this.module_obj.access_cmds[sender].includes(args[0].name)) {
            const flattern_args = this.CommandManager.flattenArgs(args)

            this.module_obj.actions.push({
                type: "cmd",
                content: {
                    module_sender: this.module_obj.module_name,
                    cmd: `/${flattern_args.join(" ")}`,
                    identifier: sender
                }
            })
        } else {
            return "Недостаточно прав для использования этой команды"
        }
    }
}

module.exports = ServerCmd
