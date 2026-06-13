const ConfigParser = require('configparser');
const path = require("path");

const { random_number } = require(path.join(BASE_DIR, "utils", "random.js"))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const MODULE_NAME = "twink"
const HELP = "Позволяет пользоваться ботом с твинков"
const STRUCTURE = {
    add: {
        nick: {
            _type: "nick",
            _description: "Ник твинка"
        },
        _description: "Добавить твинк"
    },
    remove: {
        nick: {
            _type: "nick",
            _description: "Ник твинка"
        },
        _description: "Отвязать твинк"
    },
    list: {
        _description: "Посмотреть список твинков"
    },

};


class TwinkModule extends BaseModule {
    constructor () {
        super(MODULE_NAME, HELP, STRUCTURE, INTERVAL_CHECK_ACTIONS)
        this.wait_add_twink_users = {} // {main: {"twink": twink, "password": password}}
    }

    _process(sender, args) {
        let answ;
        if (args[0].name === "add") {
            const twink_nick = args[1].value
            const password = random_number(10000, 99999)
            this.wait_add_twink_users[sender] = {
                twink: twink_nick,
                password: password
            }
            this.actions.push({
                    type: "wait_data",
                    module_name: this.module_name,
                    content: {
                        type: "message",
                        sender: twink_nick
                    }
                })
            answ = `Заявка на добавление твинка создана. Напишите мне с твинка в ЛС(не в общий чат) число(${password}) в течение 5 минут`
            setTimeout(() => {
                delete(this.wait_add_twink_users[sender])
            }, 300000)
        } else if (args[0].name === "remove") {
            const twink_nick = args[1].value
            const twinks = this.ModuleManager.call_module("stats").get_stats(sender, "twinks")
            if (twinks.includes(twink_nick)) {
                const status = this.ModuleManager.call_module("stats").update_stats(
                    sender,
                    "twinks",
                    twinks.filter(nick => nick != twink_nick)
                )
                if (status["is_ok"]) {
                    answ = "Твинк успешно отвязан"
                } else {
                    answ = "Во время отвязывания возникла ошибка"
                }
            } else {
                answ = "Твинк уже не привязан к Вашему аккаунту"
            }
        } else if (args[0].name === "list") {
            const twinks = this.ModuleManager.call_module("stats").get_stats(sender, "twinks")
            if (twinks.length === 0) {
                answ = "У Вас не привязан ни один твинк"
            } else {
                answ = `Список твинков: ${twinks.join("; ")}`
            }
        }
        if (answ) {
            return answ
        }   
    }

    message_processing(sender, message) {
        for (const main_nick of Object.keys(this.wait_add_twink_users)) {
            const twink_nick = this.wait_add_twink_users[main_nick].twink
            if (sender.toLowerCase() !== twink_nick.toLowerCase()) {
                continue;
            }
            const password = String(this.wait_add_twink_users[main_nick].password)
            if (!message.includes(password)) {
                continue;
            }

            const twinks = this.ModuleManager.call_module("stats").get_stats(main_nick, "twinks")
            twinks.push(sender)
            const status = this.ModuleManager.call_module("stats").update_stats(
                main_nick,
                "twinks",
                twinks
            )
            if (status["is_ok"]) {
                this.actions.push({
                    type: "answ",
                    content: {
                        recipient: sender,
                        message: "Твинк успешно добавлен!"
                    }
                })
                delete(this.wait_add_twink_users[main_nick])
                break;

            } else {

            }
        }
    }
}



module.exports = TwinkModule

