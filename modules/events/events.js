const path = require("path");
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))
const bus = require(path.join(BASE_DIR, "event_bus.js"))


const MODULE_NAME = "events"


class EventsModule extends BaseModule {
    constructor () {
        super(MODULE_NAME)

        bus.on("player_joined_raw", (obj) => {
            this.player_joined_raw_event(obj.nickname)
        })
    }

    player_joined_raw_event(nick) {
        this.actions.push({
            type: "cmd",
            content: {
                module_sender: this.module_name,
                cmd: `/seen ${nick}`
            }
        })
    }

    _server_answ_processing(cmd, _server_answ, values, _identifier, is_confirmed) {
        if (cmd.split(" ")[0] === "/seen") {
            if (is_confirmed) {
                const location_bot = values.location_bot
                if (location_bot.includes("Классическое выживание")) {
                    const nick = values.nick
                    const status = values.status
                    const duration = values.duration
                    if (duration !== null && duration < 10 && status === "Онлайн") {
                        console.log(`На КВ зашёл ${nick}`)
                        bus.emit(
                            'player_joined',
                            {
                                nickname: nick
                            }
                        )

                    }
                }
            }
        }
    }    
}

module.exports = EventsModule