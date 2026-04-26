const path = require("path")

const BaseCmd = require(path.join(__dirname, "..", "base.js"))
const events_db = require(path.join(__dirname, "manage_bd.js"))


const CMD_NAME = "events"
const STRUCTURE = {
  _description: "Управление событиями и напоминаниями",

  list: {
    _description: "Показать список актуальных мероприятий и их ID"
  },

  subscribe: {
    event_id: {
      _type: "int",
      _description: "ID события, на которое нужно подписаться"
    },
    _description: "Подписаться на напоминание о событии"
  },

  unsubscribe: {
    event_id: {
      _type: "int",
      _description: "ID события, от которого нужно отписаться"
    },
    _description: "Отписаться от напоминаний о событии"
  }
};

const ONE_MINUTE = 60 * 10**3 
const ONE_HOUR = 3600 * 10**3
const ONE_DAY = 86400 * 10 ** 3
const ONE_WEEK = 604800 * 10**3



class EventsCmd extends BaseCmd {
    constructor(module_obj) {
        super(module_obj, CMD_NAME, STRUCTURE)

        setInterval(() => this.check_events(), 1000)

    }

    _process(sender, args) {
        let answ;
        if (args[0].name === "subscribe") {
            const event_id = args[1].value
            const info = events_db.main(
                "subscribe", 
                {
                    event_id,
                    tg_id: sender
                }
            )
            if (info.is_ok) {
                answ = "Вы успешно подписались на напоминание о событии"
            } else {
                answ = info.message_error
            }

        } else if (args[0].name === "unsubscribe") {
            const event_id = args[1].value
            const info = events_db.main(
                "unsubscribe",
                {
                    event_id,
                    tg_id: sender
                }
            )
            if (info.is_ok) {
                answ = "Вы успешно отписались от напоминаний о событии"
            } else {
                answ = info.message_error
            }

        } else if (args[0].name === "list") {
            const info = events_db.main("get_events")
            if (info.is_ok) {
                answ = this.events_to_text(info.events)
            } else {
                answ = info.message_error
            }

        }
        return answ;
    }

    events_to_text(events) {
        let text = "Список актуальных мероприятий:\n"
        for (const event of events) {
            text += `${event.event_name}\n`
            text += `   Айди мероприятия: ${event.ID}\n`
            text += `   Дата проведения: ${event.event_date}\n`
            if (event.organizers.length !== 0) {
                text += `   Организаторы: ${event.organizers.join("; ")}\n`
            }
            if (event.description) {
                text += `"${event.description}"\n\n`
            }

        }
        return text
    }

    check_events() {
        try {
            let events = events_db.main("get_events")
            if (events.is_ok) {
                events = events.events
            } else {
                console.log(events.message_error)
                return;
            }

            for (const event of events) {
                const event_timestamp = Date.parse(event.event_date)
                const now_timestamp = Date.now()
                const delta = event_timestamp - now_timestamp

                let type;
                if (delta < ONE_WEEK && delta > ONE_WEEK - 10 * ONE_HOUR) {
                    type = 0

                } else if (delta < ONE_DAY && delta > ONE_DAY - 5 * ONE_HOUR) {
                    type = 1

                } else if (delta < ONE_HOUR && delta > ONE_HOUR - 10 * ONE_MINUTE) {
                    type = 2
                }

                if (type === undefined) {continue;}

                let subscribers = events_db.main(
                    "get_subscribers", 
                    {
                        event_id: event.ID
                    }
                )
                if (subscribers.is_ok) {
                    subscribers = subscribers.subscribers
                } else {
                    console.log(subscribers.message_error)
                    return;
                }

                const tg_ids_alert = []

                for (const tg_id of subscribers) {
                    let logs = events_db.main(
                        "get_logs",
                        {
                            event_id: event.ID,
                            tg_id
                        }
                    )
                    if (!logs.is_ok) {
                        console.log(logs.message_error)
                    }
                    logs = logs.logs
                    const count_already_alert = logs.length

                    if (count_already_alert <= type) {
                        tg_ids_alert.push(tg_id)
                        const count_lost_alert = type - count_already_alert
                        for (let i = 0; i < count_lost_alert; i++) {
                            events_db.main("add_logs", {event_id: event.ID, tg_id: tg_id})
                        }
                    }

                }
                this.send_event_alert(tg_ids_alert, type, event)
            }

        } catch (error) {
            console.log(error)
            this.module_obj.actions.push({
                type: "error",
                content: {
                    date_time: new Date(),
                    module_name: this.module_name,
                    error: error,
                    args: []
                }
            })
        }
    }

    send_event_alert(tg_ids, type, event) {
        let text_time;
        if (type === 0) {
            text_time = "осталась одна неделя"
        } else if (type === 1) {
            text_time = "остался один день"
        } else if (type === 2) {
            text_time = "осталось меньше часа"
        }
        const text = `Напоминание о событии '${event.event_name}'.` +
            `Дата проведения: ${event.event_date}` +
            `До мероприятия ${text_time}!`
        for (const tg_id of tg_ids) {
            console.log("Отправляю оповещение:", tg_id)
            this.send_message_tg(tg_id, text)
            events_db.main(
                "add_logs",
                {
                    event_id: event.ID,
                    tg_id: tg_id
                }
            )
        }
    }
}

module.exports = EventsCmd