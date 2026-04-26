const sqlite = require("better-sqlite3");
const path = require("path")
const fs = require("fs")

const { random_choice } = require(path.join(BASE_DIR, "utils", "random.js"))
const { stats_split_into_pages } = require(path.join(BASE_DIR, "utils", "text.js"))
const db = new sqlite(path.join(__dirname, "quotes.db"));
const path_rep = path.join(__dirname, "quotes_rep.json")
const quotes_rep = JSON.parse(fs.readFileSync(path_rep, "utf-8"))
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

let quotes = db.prepare(`SELECT ID, citation, author, rating FROM quotes`).all()
const placeholder_quote = {"author": "anon_bot", "citation": "1000010010110000110000"}
quotes.unshift(placeholder_quote)


class QuotesModule extends BaseModule {
    constructor () {
        super(MODULE_NAME, HELP, STRUCTURE, INTERVAL_CHECK_ACTIONS)
        this.add_prepared_quotes_to_bd()
        this.INTERVAL_SEND_RANDOM_QUOTE = 12000

        setInterval(() => {
                this.send_random_quote()
            }, this.INTERVAL_SEND_RANDOM_QUOTE * 10**3)
    }

    add_prepared_quotes_to_bd() {
        try {
            const selectMessage = db.prepare(`SELECT ID, date_offer, citation, author, status
                                              FROM prepare_quotes
                                              WHERE status == 1 OR status == 0`)
            const prepared_quotes = selectMessage.all()
            prepared_quotes.forEach(quote => {
                const ID = quote.ID
                const citation = quote.citation
                const author = quote.author
                const status = quote.status
                if (status === 1) {
                    const insertMessage = db.prepare(`INSERT INTO quotes
                                                      (citation, author)
                                                      VALUES (?, ?)`)
                    insertMessage.run(citation, author)
                }
                const deleteMessage = db.prepare(`DELETE FROM prepare_quotes
                                                  WHERE ID == ?`)
                deleteMessage.run(ID)
            })
        quotes = db.prepare(`SELECT ID, citation, author, rating FROM quotes`).all()
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
        
        if (author !== undefined) {
            conditions.push('author = ?')
            params.push(author)
        }
        if (date_offer !== undefined) {
            conditions.push('date_offer = ?')
            params.push(date_offer)
        }
        if (id !== undefined) {
            conditions.push('id = ?')
            params.push(id)
        }
        
        const whereClause = conditions.join(' AND ')
        const selectPrompt = `
            SELECT ID, citation, author, date_offer
            FROM prepare_quotes
            WHERE ${whereClause}
        `
        
        const selectMessage = db.prepare(selectPrompt)
        return selectMessage.all(...params)
    }

    get_prepared_quote(id) {
        const selectMessage = db.prepare(`
            SELECT ID, citation, author
            FROM prepare_quotes
            WHERE id = ?
        `)
        return selectMessage.get(id)
    }

    accept_quote(prepared_quote_id) {
        const prepared_quote = this.get_prepared_quote(prepared_quote_id)
        if (prepared_quote) {
            const citation = prepared_quote.citation
            const author = prepared_quote.author

            this.create_quote(citation, author)        
            this.delete_prepared_quote(prepared_quote_id)

            return {"is_ok": true}
        } else {
            return {"is_ok": false, "message_error": "not_exist"}
        }
    }

    reject_quote(prepared_quote_id) {
        const prepared_quote = this.get_prepared_quote(prepared_quote_id)
        if (prepared_quote) {
            this.delete_prepared_quote(prepared_quote_id)
            return {"is_ok": true}
        } else {
            return {"is_ok": false, "message_error": "not_exist"}
        }
    }

    create_quote(citation, author) {
        const insertMessage = db.prepare(`INSERT INTO quotes
                                          (citation, author)
                                          VALUES (?, ?)`)
        insertMessage.run(citation, author)
        quotes = db.prepare(`SELECT ID, citation, author, rating FROM quotes`).all()

    }

    delete_prepared_quote(ID) {
        const deleteMessage = db.prepare(`DELETE FROM prepare_quotes
                                          WHERE ID == ?`)
        deleteMessage.run(ID)
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
            SELECT COUNT(*) as cnt
            FROM prepare_quotes
            WHERE status = -1
        `).get().cnt

        return {
            quotes,
            total_pages: Math.ceil(total / per_page),
            current_page: page
        }
    }

    format_prepared_quote_text(quote) {
        const date = new Date(Number(quote.date_offer)).toLocaleString("ru-RU");
        return (
            `Автор: ${quote.author}\n` +
            `Дата предложения: ${date}\n\n` +
            `"${quote.citation}"`
        );
    }

    send_processing_quotes_message(tg_id, prepared_quotes, last_quote_id, page = 1) {
        if (prepared_quotes.length === 0) {
            this.actions.push({
                type: "module_request",
                    module_recipient: "telegram",
                    module_sender: this.module_name,
                content: { type: "answ", message: "Новых цитат для модерации нет.", type_content: "message", old_data: { tg_id } }
            });
            return;
        }

        const quote = prepared_quotes[0];
        const text = this.format_prepared_quote_text(quote);

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
        };

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
        });
    }

    get_next_quote(prepared_quotes, current_id) {
        if (!prepared_quotes || prepared_quotes.length === 0) {return null;}

        const current_index = prepared_quotes.findIndex(q => Number(q.ID) === Number(current_id));
        const next_index = (current_index + 1) % prepared_quotes.length;

        console.log("current_index:", current_index, "next_index:", next_index, "ids:", prepared_quotes.map(q => q.id));

        return prepared_quotes[next_index];
    }


    module_dialogue(module_recipient, module_sender, json_cmd) {
        try {
            if (json_cmd.type === "request") {
                const args = json_cmd.args;
                const tg_id = json_cmd.tg_id;
                let answ;
                const type = "message";

                if (args[0] === "accept") {
                    const prepared_quote_id = Number(args[1]);
                    if (!prepared_quote_id) {
                        answ = "Некорректно указан айди";
                    } else {
                        const status = this.accept_quote(prepared_quote_id);
                        answ = status.is_ok ? "Цитата успешно добавлена" : `Ошибка: ${status.message_error}`;
                    }
                } else if (args[0] === "reject") {
                    const prepared_quote_id = Number(args[1]);
                    if (!prepared_quote_id) {
                        answ = "Некорректно указан айди";
                    } else {
                        const status = this.reject_quote(prepared_quote_id);
                        answ = status.is_ok ? "Цитата успешно отклонена" : `Ошибка: ${status.message_error}`;
                    }
                } else if (args[0] === "next") {
                                const current_id = Number(args[1]); // id текущей цитаты
                                const prepared = this.get_prepared_quotes(-1); // функция, возвращающая все подготовленные цитаты
                                const next_quote = this.get_next_quote(prepared, current_id);

                                if (next_quote) {
                                    this.send_processing_quotes_message(tg_id, [next_quote], next_quote.id);
                                    return;
                                } else {
                                    answ = "Цитаты не найдены."
                                }
                                
                            } else if (args.length === 0) {
                    const page = 1;
                    const prepared = this.get_prepared_quotes_paginated(page);
                    this.send_processing_quotes_message(tg_id, prepared.quotes, null, page);
                    return;
                } else {
                    answ = "Команда не найдена. Доступные: accept; reject; next";
                }

                this.actions.push({
                    type: "module_request",
                    module_recipient: module_sender,
                    module_sender: this.module_name,
                    content: {
                        type: "answ",
                        old_data: json_cmd,
                        type_content: type,
                        message: answ
                    }
                });
            }
        } catch (error) {
            const answ = `Возникла ошибка: ${error.toString()}`;
            this.actions.push({
                type: "module_request",
                module_recipient: module_sender,
                module_sender: this.module_name,
                content: { type: "answ", old_data: json_cmd, message: answ }
            });
        }
    }


    generate_quotes_list(nick) {
        const quotes = this.get_quotes_from_author(nick).map((quote) => {
            const citation_header = quote["citation"].split(" ").slice(0, 3).join(" ").slice(0, 50)
            return [quote.ID, `"${citation_header}..."` ]
        })
        return quotes;
    }

    generate_quotes_stats() {
        let stats = {}
        quotes.map((quote) => {
            const nick = quote.author
            if (stats[nick]) {
                stats[nick]["count_quotes"]++;
            } else {
                stats[nick] = {"count_quotes": 1, "rating": this.get_sum_ratings(nick)}
            }
        })
        stats = Object.entries(stats).map((elem) => {
            const nick = elem[0]
            const stat = elem[1]
            return [nick, `Количество цитат: ${stat.count_quotes}, Рейтинг цитат: ${stat.rating}`]
        })
        return stats
    }

    get_quotes_from_author(author) {
        return quotes.filter((quote) => quote.author.toLowerCase() === author.toLowerCase())
    }

    get_total_rating_by_author(author) {
        const selectMessage = db.prepare(`
            SELECT SUM(l.add_number) as total
            FROM logs l
            JOIN quotes q ON q.ID = l.ID_quote
            WHERE LOWER(q.author) = LOWER(?)
        `);

        const result = selectMessage.get(author);
        return result.total || 0;
    }

    send_quote(ID) {
        console.log(ID, quotes[ID])
        const quote_info = quotes[ID]
        if (quote_info) {
            const author = quote_info["author"]
            const quote = quote_info["citation"]
            this.actions.push({
                type: "answ",
                content: {
                    message: `[Цитаты Эндерчан] "${quote}" (C) ${author}`
                }
            })
            if (random_choice([0,0,0,0,0,0,0,1])) {
                const answ = "Вы можете поставить свою оценку любой цитате, для этого пропишите команду 'сmd цитата rep id_цитаты +/-'. '+' - повысить рейтинг, '-' - понизить"
                this.actions.push({
                    type: "answ",
                    content: {
                        message: answ
                    }
                })
            }
            return {"is_ok": true, "author": author, "quote": quote}
        } else {
            return {"is_ok": false, "message_error": "Цитата не была найдена"}
        }
    }

    send_random_quote() {
        const weights = quotes.map(quote => {
            if (!quote.rating && quote.rating !== 0) {return 0;}
            return Math.max(quote.rating, 1);
        });

        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        const randomValue = Math.random() * totalWeight;

        let cumulativeWeight = 0;
        for (let i = 0; i < quotes.length; i++) {
            cumulativeWeight += weights[i];
            if (randomValue <= cumulativeWeight) {
                console.log([this])
                this.send_quote(i)
                return quotes[i];
            }
        }
        this.send_quote(0)
        return quotes[0];
    }

    update_quotes_rep(ID, nickname, add_rep) {
        if (!quotes_rep[nickname]) {quotes_rep[nickname] = {}}
        quotes_rep[nickname][ID] = add_rep
        fs.writeFileSync(path_rep, JSON.stringify(quotes_rep))
    }

    add_quote_to_bd(author, quote) {
        const insertMessage = db.prepare(`INSERT INTO prepare_quotes
                                         (date_offer, citation, author)
                                         VALUES (${new Date().getTime()}, ?, ?)`)
        insertMessage.run(quote, author)
    }

    update_rating(ID) {
        const new_rating = this.get_rating_quote(ID)
        const insertMessage = db.prepare(`UPDATE quotes
                                         SET rating = ?
                                         WHERE ID = ?`)
        insertMessage.run(new_rating, ID)
    }

    update_logs_quotes(ID, nickname, add_number) {
        const insertMessage = db.prepare(`INSERT INTO logs
                                         (date_time, nickname, ID_quote, add_number)
                                         VALUES (${new Date().getTime()}, ?, ?, ?)`)
        insertMessage.run(nickname, ID, add_number)
    }

    get_rating_quote(ID) {
        const selectMessage = db.prepare(`SELECT sum(add_number)
                                         FROM logs
                                         WHERE ID_quote = ?`)
        const rating = selectMessage.all(ID)[0]['sum(add_number)']
        return rating
    }

    get_sum_ratings(nickname) {
        try {
            const selectMessage = db.prepare(`SELECT sum(rating)
                                             FROM quotes
                                             WHERE author == ?`)
            const rating = selectMessage.all(nickname)[0]['sum(rating)']
            return rating
        } catch (error) {
            this.actions.push({
                type: "error",
                content:{
                    date_time: new Date(),
                    module_name: this.module_name,
                    error: error,
                    args: [nickname]
                }
            })
            
        }
    }

    _process(sender, args, parameters) {
        let answ;
        let send_in_private_message = false;

        if (args[0] === "add") {
            if (args[1]) {
                const quote = args.slice(1).join(" ")
                this.add_quote_to_bd(sender, quote)
                answ = "Ваша цитата отправлена на проверку!"
            } else {
                answ = "Верный синтаксис: add [Ваша личная цитата цензурного содержания]"
            }

        } else if (args[0] === "rep") {
            const rank_sender = parameters.rank_sender
            if (Number(args[1])) {
                const ID = Number(args[1])
                if (ID && ID > 0 && ID <= quotes.length) {
                    if (args[2] === "+" || args[2] === "-") {
                        if (!quotes_rep[sender] || !quotes_rep[sender][ID]) {
                            const quote_info = quotes[ID]
                            let author;
                            if (quote_info) {author = quote_info["author"]}
                            if (author && author !== sender) {
                                let add_rep = rank_sender >= 2 && rank_sender <= 4 ? 2 : rank_sender > 4 ? 3 : 1
                                if (args[2] === "-") {add_rep = -add_rep}
                                quotes[ID]["rating"] += add_rep
                                this.update_quotes_rep(ID, sender, add_rep)
                                this.update_logs_quotes(ID, sender, add_rep)
                                this.update_rating(ID)
                                answ = "Рейтинг успешно изменён"
                            } else {answ = "Вы не можете поставить рейтинг самому себе"}
                        } else {answ = "Вы уже оставили свой голос для этой цитаты. Выберите другую или отмените голос для этой с помощью сmd цитата rep [ID] del"}
                    } else if (args[2] === "del") {
                        if (quotes_rep[sender] && quotes_rep[sender][ID]) {
                            const add_rep = - quotes_rep[sender][ID]
                            delete(quotes_rep[sender][ID])
                            fs.writeFileSync(path_rep, JSON.stringify(quotes_rep))
                            this.update_logs_quotes(ID, sender, add_rep)
                            this.update_rating(ID)
                            answ = "Голос успешно удалён"
                        } else {answ = "Вы ещё не поставили оценку этой цитате"}
                    } else {answ = "Вы должны указать, что вы хотите сделать с рейтингом выбранной цитаты. Повысить(+),  понизить(-) или отменить голос(del)"}
                } else {answ = "Цитаты с данным айди не существует"}
            } else {answ = "Верный синтаксис: [id цитаты] [+(повысить рейтинг), -(понизить рейтинг), del(отменить голос)]"}

        } else if (args[0] === "list") {
            send_in_private_message = true;
            if (args.length === 1 || args[1] === "help") {answ = "Возможные аргументы: [by - цитаты конкретного человека; all - информация о всех цитатах]"}
            else if (args[1] === "by") {
                if (args.length === 2) {answ = "Возможные аргументы: [ник_игрока]. Покажет айди и начало цитат выбранного игрока"}
                else {
                    const nick = args[2]
                    const num_page = args.length>3?Number(args[3]):1
                    const quotes = this.generate_quotes_list(nick)
                    if (quotes && quotes.length>0) {answ = stats_split_into_pages(quotes, 5, num_page, `Цитаты игрока ${nick}: `)["answ"]}
                    else {answ = "У выбранного игрока нет цитат"}
                }
            } else if (args[1] === "all") {
                const num_page = args.length>2?Number(args[2]):1
                const stats = this.generate_quotes_stats()
                answ = stats_split_into_pages(stats, 3, num_page, "Тест: ")["answ"]
            } else {answ = "Возможные аргументы: [by, all]"}

        } else if (args[0] === "by") {
            const author = args[1]
            if (author) {
                const quotes_by_author = this.get_quotes_from_author(author)
                if (quotes_by_author.length>0) {
                    const quote_info = random_choice(quotes_by_author)
                    const ID = quote_info["ID"]
                    const info = this.send_quote(ID)
                    answ = info["is_ok"]? `Цитата игрока ${info["author"]}: "${info["quote"]}"`: info["message_error"]
                } else {answ = "У выбранного игрока нет цитат"}
            } else {answ = "Вы должны указать игрока, чтобы получить его цитату"}

        } else if (args[0] === "id") {
            const ID = Number(args[1])
            if (ID) {
                const info = this.send_quote(ID)
                answ = info["is_ok"]? `Цитата игрока ${info["author"]}: "${info["quote"]}"`: info["message_error"]
            } else {answ = "Вы должны указать айди цитаты"}

        } else {answ = "Возможные аргументы: add, rep, list, by, id"}
        if (answ) {
            return {
                message: answ,
                send_in_private_message
            }
        } 
    }
}


module.exports = QuotesModule
