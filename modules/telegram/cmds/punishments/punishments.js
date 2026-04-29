const path = require("path")

const BaseCmd = require(path.join(__dirname, "..", "base.js"))
const bus = require(path.join(BASE_DIR, "event_bus.js"))


const CMD_NAME = "punishments"
const STRUCTURE = {
    _aliases: ["p"],
    _description: "Включить/выключить пересылку чата",
}

class PunishmentsCmd extends BaseCmd {
    constructor(module_obj) {
        super(module_obj, CMD_NAME, STRUCTURE)

        this.punishment_logs = []

        bus.on("new_punishment", (obj) => 
            this.punishment_processing(
                obj.message,
                obj.punishment_data,
                obj.date_time
            )
        )

    }

    _process(sender) {
        let answ;
        const settings = this.module_obj.player_settings[sender]
        if (settings["punishments_on"] === true) {
             settings["punishments_on"] = false;
             answ = "Оповещения о наказаниях выключены"
         } else {
             settings["punishments_on"] = true;
             const context = this.punishment_logs.slice(-5).join("\n")
             answ = `Оповещения о наказаниях включены. Последние наказания:\n${context}`
         }
        return answ;
    }

    punishment_processing(message, parsed_args, date_time) {
        date_time.setHours(date_time.getHours() + 3) // To MSC time
        const hours = String(date_time.getHours()).padStart(2, '0');
        const minutes = String(date_time.getMinutes()).padStart(2, '0');
        const seconds = String(date_time.getSeconds()).padStart(2, '0');
        message = `[${hours}:${minutes}:${seconds}] ${message}`

        for (const tg_id in this.module_obj.player_settings) {
            const settings = this.module_obj.player_settings[tg_id]
            if (settings["punishments_on"] === true) {
                this.module_obj.send_message_tg(tg_id, message)
            }
        }
        if (this.punishment_logs.length < 5) {
            this.punishment_logs.push(message)

        } else {
            this.punishment_logs.shift()
            this.punishment_logs.push(message)
        }
    }
}

module.exports = PunishmentsCmd