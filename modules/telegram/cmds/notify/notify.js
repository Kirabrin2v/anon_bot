const path = require("path")

const BaseCmd = require(path.join(__dirname, "..", "base.js"))

const CMD_NAME = "notify"

const STRUCTURE = {
    text: {
        _type: "text",
        _description: "Текст уведомления для всех пользователей"
    },
    _need_rank: 1,
    _description: "Массовая рассылка уведомления всем пользователям"
}


class NotifyCmd extends BaseCmd {
    constructor(module_obj) {
        super(module_obj, CMD_NAME, STRUCTURE)
    }

    async _process(sender, args) {
        let answ;
        if (args[0].name === "text") {
            let message = args[0].value

            const players = this.module_obj.player_settings

            if (!players) {
                return "Нет получателей"
            }

            const recipients = Object.keys(players)

            if (recipients.length === 0) {
                return "Список пользователей пуст"
            }

            let result

            try {
                result = await this.module_obj.broadcast_messages(
                    this.module_obj,
                    recipients,
                    message,
                    'Массовая рассылка',
                    60
                )
            } catch (err) {
                return `Ошибка рассылки: ${err.message || err}`
            }

            answ = (
                `Уведомление отправлено\n` +
                `Успешно: ${result.sent}\n` +
                `Ошибок: ${result.failed}`
            )
        }
        return answ;
    }
}

module.exports = NotifyCmd
