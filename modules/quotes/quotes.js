const sqlite = require("better-sqlite3");
const path = require("path")

const { random_choice } = require(path.join(BASE_DIR, "utils", "random.js"))
const { stats_split_into_pages } = require(path.join(BASE_DIR, "utils", "text.js"))
const db = new sqlite(path.join(__dirname, "quotes.db"));
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const MODULE_NAME = "цитата"
const HELP = "Великие цитаты обычных Эндерчан"
const INTERVAL_CHECK_ACTIONS = 1000
const STRUCTURE = {
  add: {
    цитата: {
      _type: "text",
      _description: "Ваша личная цитата"
    },
    _description: "Предложить свою цитату для использования её ботом"
  },
  rep: {
    id: {
      "+": {
        _description: "Повысить рейтинг"
      },
      "-": {
        _description: "Понизить рейтинг"
      },
      "del": {
        _description: "Отменить уже поставленный рейтинг"
      },
      _type: "int",
      _description: "Айди цитаты, рейтинг которой нужно изменить"
    },
    _description: "Изменить рейтинг цитаты. Рейтинг влияет на частоту появления цитаты в чате: меньше рейтинг - реже появляется"
  },
  list: {
    by: {
      nick: {
        "номер_страницы": {
          _type: "int",
          _default: 1
        },
        _type: "nick",
        _description: "Ник игрока, цитаты которого нужно показать"
      },
      _description: "Цитаты конкретного игрока"
    },
    all: {
      "номер_страницы": {
        _type: "int",
        _default: 1
      },
      _description: "Все цитаты"
    },
    _description: "Показывает список цитат"
  },
  by: {
    nick: {
      _type: "nick",
      _description: "Ник игрока, цитату которого нужно отправить"
    },
    _description: "Отправляет случайную цитату выбранного игрока"
  },
  id: {
    id: {
      _type: "int",
      _description: "Айди цитаты, которую нужно отправить"
    },
    _description: "Отправляет цитату с указанным айди"
  }
}


class QuotesModule extends BaseModule {
    constructor () {
        super(MODULE_NAME, HELP, STRUCTURE, INTERVAL_CHECK_ACTIONS)
        this.add_prepared_quotes_to_bd()
        this.INTERVAL_SEND_RANDOM_QUOTE = 12000
        this.quotes = db.prepare(`SELECT ID, citation, author, rating FROM quotes`).all()

        setInterval(() => {
            this.send_random_quote()
        }, this.INTERVAL_SEND_RANDOM_QUOTE * 10**3)
    }

    get_user_vote(quote_id, nickname) {
        const row = db.prepare(`
            SELECT SUM(add_number) as total
            FROM logs
            WHERE ID_quote = ? AND nickname = ?
        `).get(quote_id, nickname)

        const total = row?.total
        if (total === null || total === undefined || total === 0) { return null }
        return total
    }

    has_voted(quote_id, nickname) {
        return this.get_user_vote(quote_id, nickname) !== null
    }

    // Подготовленные цитаты

    add_prepared_quotes_to_bd() {
        try {
            const prepared_quotes = db.prepare(`
                SELECT ID, citation, author, status
                FROM prepare_quotes
                WHERE status = 1 OR status = 0
            `).all()

            const insert = db.prepare(`INSERT INTO quotes (citation, author) VALUES (?, ?)`)
            const remove = db.prepare(`DELETE FROM prepare_quotes WHERE ID = ?`)

            const run_all = db.transaction((quotes) => {
                for (const quote of quotes) {
                    if (quote.status === 1) {
                        insert.run(quote.citation, quote.author)
                    }
                    remove.run(quote.ID)
                }
            })
            run_all(prepared_quotes)

            this.quotes = db.prepare(`SELECT ID, citation, author, rating FROM quotes`).all()
        } catch (error) {
            this.actions.push({
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

    get_prepared_quotes(status = 0, author, date_offer, id) {
        const conditions = ['status = ?']
        const params = [status]

        if (author !== undefined) { conditions.push('author = ?'); params.push(author) }
        if (date_offer !== undefined) { conditions.push('date_offer = ?'); params.push(date_offer) }
        if (id !== undefined) { conditions.push('id = ?'); params.push(id) }

        return db.prepare(`
            SELECT ID, citation, author, date_offer
            FROM prepare_quotes
            WHERE ${conditions.join(' AND ')}
        `).all(...params)
    }

    get_prepared_quote(id) {
        return db.prepare(`
            SELECT ID, citation, author
            FROM prepare_quotes
            WHERE ID = ?
        `).get(id)
    }

    accept_quote(prepared_quote_id) {
        const prepared_quote = this.get_prepared_quote(prepared_quote_id)
        if (!prepared_quote) { return { is_ok: false, message_error: "not_exist" } }

        this.create_quote(prepared_quote.citation, prepared_quote.author)
        this.delete_prepared_quote(prepared_quote_id)
        return { is_ok: true }
    }

    reject_quote(prepared_quote_id) {
        const prepared_quote = this.get_prepared_quote(prepared_quote_id)
        if (!prepared_quote) { return { is_ok: false, message_error: "not_exist" } }

        this.delete_prepared_quote(prepared_quote_id)
        return { is_ok: true }
    }

    create_quote(citation, author) {
        db.prepare(`INSERT INTO quotes (citation, author) VALUES (?, ?)`).run(citation, author)
        this.quotes = db.prepare(`SELECT ID, citation, author, rating FROM quotes`).all()
    }

    delete_prepared_quote(ID) {
        db.prepare(`DELETE FROM prepare_quotes WHERE ID = ?`).run(ID)
    }

    get_prepared_quotes_paginated(page = 1, per_page = 1) {
        const offset = (page - 1) * per_page
        const quotes = db.prepare(`
            SELECT ID, citation, author, date_offer
            FROM prepare_quotes
            WHERE status = -1
            ORDER BY date_offer ASC
            LIMIT ? OFFSET ?
        `).all(per_page, offset)

        const total = db.prepare(`
            SELECT COUNT(*) as cnt FROM prepare_quotes WHERE status = -1
        `).get().cnt

        return {
            quotes,
            total_pages: Math.ceil(total / per_page),
            current_page: page
        }
    }

    format_prepared_quote_text(quote) {
        const date = new Date(Number(quote.date_offer)).toLocaleString("ru-RU")
        return (
            `Автор: ${quote.author}\n` +
            `Дата предложения: ${date}\n\n` +
            `"${quote.citation}"`
        )
    }

    send_processing_quotes_message(tg_id, prepared_quotes, page = 1) {
        if (prepared_quotes.length === 0) {
            this.actions.push({
                type: "module_request",
                module_recipient: "telegram",
                module_sender: this.module_name,
                content: {
                    type: "answ",
                    message: "Новых цитат для модерации нет.",
                    type_content: "message",
                    old_data: { tg_id }
                }
            })
            return
        }

        const quote = prepared_quotes[0]
        const text = this.format_prepared_quote_text(quote)

        const keyboard = {
            inline_keyboard: [
                [
                    { text: "Принять ✅", callback_data: `quote:accept:${quote.ID}:${page}` },
                    { text: "Отклонить ❌", callback_data: `quote:reject:${quote.ID}:${page}` }
                ],
                [
                    { text: "Следующая ➡️", callback_data: `quote:next:${quote.ID}:${page + 1}` }
                ]
            ]
        }

        this.actions.push({
            type: "module_request",
            module_recipient: "telegram",
            module_sender: this.module_name,
            content: {
                type: "answ",
                old_data: { tg_id, prepared_quote_id: quote.ID },
                type_content: "message",
                message: text,
                keyboard: keyboard
            }
        })
    }

    get_next_quote(prepared_quotes, current_id) {
        if (!prepared_quotes || prepared_quotes.length === 0) { return null }
        const current_index = prepared_quotes.findIndex(q => Number(q.ID) === Number(current_id))
        if (current_index === -1) { return prepared_quotes[0] }
        const next_index = (current_index + 1) % prepared_quotes.length
        return prepared_quotes[next_index]
    }

    module_dialogue(module_recipient, module_sender, json_cmd) {
        try {
            if (json_cmd.type !== "request") { return }

            const args = json_cmd.args
            const tg_id = json_cmd.tg_id
            let answ

            if (args[0] === "accept") {
                const id = Number(args[1])
                if (!id) {
                    answ = "Некорректно указан айди"
                } else {
                    const status = this.accept_quote(id)
                    answ = status.is_ok ? "Цитата успешно добавлена" : `Ошибка: ${status.message_error}`
                }

            } else if (args[0] === "reject") {
                const id = Number(args[1])
                if (!id) {
                    answ = "Некорректно указан айди"
                } else {
                    const status = this.reject_quote(id)
                    answ = status.is_ok ? "Цитата успешно отклонена" : `Ошибка: ${status.message_error}`
                }

            } else if (args[0] === "next") {
                const current_id = Number(args[1])
                const prepared = this.get_prepared_quotes(-1)
                const next_quote = this.get_next_quote(prepared, current_id)

                if (next_quote) {
                    this.send_processing_quotes_message(tg_id, [next_quote])
                } else {
                    answ = "Цитаты не найдены."
                }

            } else if (args.length === 0) {
                const prepared = this.get_prepared_quotes_paginated(1)
                this.send_processing_quotes_message(tg_id, prepared.quotes, 1)
                return

            } else {
                answ = "Команда не найдена. Доступные: accept; reject; next"
            }

            if (answ) {
                this.actions.push({
                    type: "module_request",
                    module_recipient: module_sender,
                    module_sender: this.module_name,
                    content: {
                        type: "answ",
                        old_data: json_cmd,
                        type_content: "message",
                        message: answ
                    }
                })
            }
        } catch (error) {
            this.actions.push({
                type: "module_request",
                module_recipient: module_sender,
                module_sender: this.module_name,
                content: {
                    type: "answ",
                    old_data: json_cmd,
                    message: `Возникла ошибка: ${error.toString()}`
                }
            })
        }
    }

    // Список и статистика

    generate_quotes_list(nick) {
        return this.get_quotes_from_author(nick).map((quote) => {
            const citation_header = quote.citation.split(" ").slice(0, 3).join(" ").slice(0, 50)
            return [quote.ID, `"${citation_header}..."`]
        })
    }

    generate_quotes_stats() {
        const stats = {}
        for (const quote of this.quotes) {
            const nick = quote.author
            if (stats[nick]) {
                stats[nick].count_quotes++
            } else {
                stats[nick] = { count_quotes: 1, rating: this.get_sum_ratings(nick) }
            }
        }
        return Object.entries(stats).map(([nick, stat]) => [
            nick,
            `Количество цитат: ${stat.count_quotes}, Рейтинг цитат: ${stat.rating}`
        ])
    }

    get_quotes_from_author(author) {
        return this.quotes.filter(q => q.author.toLowerCase() === author.toLowerCase())
    }

    // Отправка цитат

    send_quote(ID) {
        const quote_info = this.quotes.find(q => q.ID === ID)
        if (!quote_info) {
            return { is_ok: false, message_error: "Цитата не была найдена" }
        }

        const author = quote_info.author
        const quote = quote_info.citation

        this.actions.push({
            type: "answ",
            content: {
                message: `[Цитаты Эндерчан] "${quote}" (C) ${author}`
            }
        })

        if (random_choice([0, 0, 0, 0, 0, 0, 0, 1])) {
            this.actions.push({
                type: "answ",
                content: {
                    message: "Вы можете поставить свою оценку любой цитате, для этого пропишите команду 'сmd цитата rep id_цитаты +/-'. '+' - повысить рейтинг, '-' - понизить"
                }
            })
        }

        return { is_ok: true, author, quote }
    }

    send_random_quote() {
        if (this.quotes.length === 0) { return }

        const weights = this.quotes.map(q => Math.max(q.rating ?? 0, 1))
        const totalWeight = weights.reduce((sum, w) => sum + w, 0)
        const randomValue = Math.random() * totalWeight

        let cumulativeWeight = 0
        for (let i = 0; i < this.quotes.length; i++) {
            cumulativeWeight += weights[i]
            if (randomValue <= cumulativeWeight) {
                this.send_quote(this.quotes[i].ID)
                return
            }
        }
        this.send_quote(this.quotes[0].ID)
    }

    // Рейтинг

    update_rating(ID) {
        const new_rating = this.get_rating_quote(ID)
        db.prepare(`UPDATE quotes SET rating = ? WHERE ID = ?`).run(new_rating, ID)

        // Синхронизируем кэш в памяти
        const cached = this.quotes.find(q => q.ID === ID)
        if (cached) { cached.rating = new_rating }
    }

    update_logs_quotes(ID, nickname, add_number) {
        db.prepare(`
            INSERT INTO logs (date_time, nickname, ID_quote, add_number)
            VALUES (?, ?, ?, ?)
        `).run(new Date().getTime(), nickname, ID, add_number)
    }

    get_rating_quote(ID) {
        const row = db.prepare(`SELECT SUM(add_number) as total FROM logs WHERE ID_quote = ?`).get(ID)
        return row?.total ?? 0
    }

    get_sum_ratings(nickname) {
        try {
            const row = db.prepare(`SELECT SUM(rating) as total FROM quotes WHERE author = ?`).get(nickname)
            return row?.total ?? 0
        } catch (error) {
            this.actions.push({
                type: "error",
                content: {
                    date_time: new Date(),
                    module_name: this.module_name,
                    error: error,
                    args: [nickname]
                }
            })
            return 0
        }
    }

    add_quote_to_bd(author, quote) {
        db.prepare(`
            INSERT INTO prepare_quotes (date_offer, citation, author)
            VALUES (?, ?, ?)
        `).run(new Date().getTime(), quote, author)
    }

    // Основная обработка команд

    _process(sender, args, parameters) {
        let answ
        let send_in_private_message = false

        if (args[0].name === "add") {
            const quote = args[1].value
            this.add_quote_to_bd(sender, quote)
            answ = "Ваша цитата отправлена на проверку!"

        } else if (args[0].name === "rep") {
            const rank_sender = parameters.rank_sender
            const ID = args[1].value 

            const quote_info = this.quotes.find(q => q.ID === ID)
            if (!quote_info) {
                answ = "Цитаты с данным айди не существует"

            } else if (args[2].name === "+" || args[2].name === "-") {
                if (quote_info.author.toLowerCase() === sender.toLowerCase()) {
                    answ = "Вы не можете поставить рейтинг самому себе"

                } else if (this.has_voted(ID, sender)) {
                    answ = "Вы уже оставили свой голос для этой цитаты. Выберите другую или отмените голос с помощью cmd цитата rep [ID] del"

                } else {
                    let add_rep = rank_sender >= 2 && rank_sender <= 4 ? 2 : rank_sender > 4 ? 3 : 1
                    if (args[2].name === "-") { add_rep = -add_rep }

                    this.update_logs_quotes(ID, sender, add_rep)
                    this.update_rating(ID)
                    answ = "Рейтинг успешно изменён"
                }

            } else if (args[2].name === "del") {
                const current_vote = this.get_user_vote(ID, sender)
                if (current_vote === null) {
                    answ = "Вы ещё не поставили оценку этой цитате"
                } else {
                    // Записываем инвертированный голос, чтобы сумма обнулилась
                    this.update_logs_quotes(ID, sender, -current_vote)
                    this.update_rating(ID)
                    answ = "Голос успешно удалён"
                }

            } else {
                answ = "Вы должны указать, что вы хотите сделать с рейтингом выбранной цитаты. Повысить(+), понизить(-) или отменить голос(del)"
            }

        } else if (args[0].name === "list") {
            send_in_private_message = true

            if (args[1].name === "by") {
                const nick = args[2].value
                const num_page = args[3].value
                const quotes = this.generate_quotes_list(nick)
                if (quotes && quotes.length > 0) {
                    answ = stats_split_into_pages(quotes, 5, num_page, `Цитаты игрока ${nick}: `)["answ"]
                } else {
                    answ = "У выбранного игрока нет цитат"
                }

            } else if (args[1].name === "all") {
                const num_page = args[2].value
                const stats = this.generate_quotes_stats()
                answ = stats_split_into_pages(stats, 3, num_page, "Цитаты: ")["answ"]

            } else {
                answ = "Возможные аргументы: [by, all]"
            }

        } else if (args[0].name === "by") {
            const author = args[1].value
            if (!author) {
                answ = "Вы должны указать игрока, чтобы получить его цитату"
            } else {
                const quotes_by_author = this.get_quotes_from_author(author)
                if (quotes_by_author.length > 0) {
                    send_in_private_message = true
                    const quote_info = random_choice(quotes_by_author)
                    const info = this.send_quote(quote_info.ID)
                    answ = info.is_ok
                        ? `Цитата игрока ${info.author}: "${info.quote}"`
                        : info.message_error
                } else {
                    answ = "У выбранного игрока нет цитат"
                }
            }

        } else if (args[0].name === "id") {
            const ID = args[1].value
            if (!ID) {
                answ = "Вы должны указать айди цитаты"
            } else {
                send_in_private_message = true
                const info = this.send_quote(ID)
                answ = info.is_ok
                    ? `Цитата игрока ${info.author}: "${info.quote}"`
                    : info.message_error
            }

        } else {
            answ = "Возможные аргументы: add, rep, list, by, id"
        }

        if (answ) {
            return { message: answ, send_in_private_message }
        }
    }
}


module.exports = QuotesModule