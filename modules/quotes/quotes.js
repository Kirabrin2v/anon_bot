const module_name = "цитата"
const help = "Великие цитаты обычных Эндерчан"

structure = {
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

const sqlite = require("better-sqlite3");
const path = require("path")
const fs = require("fs")

const text = require(path.join(__dirname, "../text/text.js"))

const db = new sqlite(path.join(__dirname, "quotes.db"));

const path_rep = path.join(__dirname, "quotes_rep.json")
var quotes_rep = JSON.parse(fs.readFileSync(path_rep, "utf-8"))

const quotes = db.prepare(`SELECT ID, citation, author, rating FROM quotes`).all()
const placeholder_quote = {"author": "anon_bot", "citation": "1000010010110000110000"}
quotes.unshift(placeholder_quote)

var actions = []
function add_prepared_quotes_to_bd() {
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
			if (status == 1) {
				const insertMessage = db.prepare(`INSERT INTO quotes
												(citation, author)
												VALUES (?, ?)`)
				insertMessage.run(citation, author)
			}
			const deleteMessage = db.prepare(`DELETE FROM prepare_quotes
												WHERE ID == ?`)
			deleteMessage.run(ID)
		})
	} catch (error) {
		actions.push({type: "error",
					content: {date_time: new Date(),
							module_name: module_name,
							error: error,
							args: []
					}})
	}

}

add_prepared_quotes_to_bd()

function random_number (min_num, max_num) {
	return Math.floor(Math.random() * (max_num - min_num + 1)) + min_num;
}


function random_choice(array) {
	return array[Math.floor(Math.random() * array.length)]
}



function generate_quotes_list(nick) {
	let quotes = get_quotes_from_author(nick).map((quote) => {
		let citation_header = quote["citation"].split(" ").slice(0, 3).join(" ").slice(0, 50)
		return [quote.ID, `"${citation_header}..."` ]
	})
	return quotes;
}

function generate_quotes_stats() {
	let stats = {}
	quotes.map((quote) => {
		let nick = quote.author
		if (stats[nick]) {
			stats[nick]["count_quotes"]++;
		} else {
			stats[nick] = {"count_quotes": 1, "rating": get_sum_ratings(nick)}
		}
	})
	stats = Object.entries(stats).map((elem) => {
		let nick = elem[0]
		let stat = elem[1]
		return [nick, `Количество цитат: ${stat.count_quotes}, Рейтинг цитат: ${stat.rating}`]
	})
	return stats
}


function get_quotes_from_author(author) {
	let quotes_by_author = quotes.filter((quote) => {
		return quote.author.toLowerCase() == author.toLowerCase();
	})
	return quotes_by_author
	
}

function send_quote(ID) {
	console.log(ID, quotes[ID])
	let quote_info = quotes[ID]
	if (quote_info) {
		let author = quote_info["author"]
		let quote = quote_info["citation"]
		last_quotes_ID = ID
		actions.push({
			type: "answ",
			content: {
				message: `[Цитаты Эндерчан] "${quote}" (C) ${author}`
			}
		})
		if (random_choice(0, 0, 0, 0, 0, 0, 0, 1)) {
			let answ = "Вы можете поставить свою оценку любой цитате, для этого пропишите команду 'сmd цитата rep id_цитаты +/-'. '+' - повысить рейтинг, '-' - понизить"
			actions.push({
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

function send_random_quote() {
	// Создаём массив с весами (рейтингами) для каждой цитаты
    const weights = quotes.map(quote => {
        // Если рейтинг не указан, считаем его равным 1
        if (!quote.rating && quote.rating != 0) return 0;
        const rating = quote.rating;
        // Убедимся, что вес не отрицательный
        return Math.max(rating, 1);
    });
    console.log(weights)

    // Вычисляем общую сумму весов
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    // Генерируем случайное число от 0 до общей суммы весов
    const randomValue = Math.random() * totalWeight;

    // Выбираем цитату на основе случайного числа
    let cumulativeWeight = 0;
    for (let i = 0; i < quotes.length; i++) {
        cumulativeWeight += weights[i];
        if (randomValue <= cumulativeWeight) {
        	send_quote(i)
            return quotes[i]; // Возвращаем выбранную цитату
        }
    }

    
    // Если что-то пошло не так, возвращаем первую цитату
    send_quote(i)
    return quotes[0];
	
}

function update_quotes_rep(ID, nickname, add_rep) {
	if (quotes_rep[nickname]) {
		quotes_rep[nickname][ID] = add_rep
	} else {
		quotes_rep[nickname] = {}
		quotes_rep[nickname][ID] = add_rep
	}	
	

	fs.writeFileSync(path_rep, JSON.stringify(quotes_rep))
}

function add_quote_to_bd(author, quote) {
	const insertMessage = db.prepare(`INSERT INTO prepare_quotes
											(date_offer, citation, author)
											VALUES (${new Date().getTime()}, ?, ?)`)


	insertMessage.run(quote, author)
}

function update_rating(ID) {
	const new_rating = get_rating_quote(ID)

	const insertMessage = db.prepare(`UPDATE quotes
										SET rating = ?
										WHERE ID = ?`)
	insertMessage.run(new_rating, ID)
}

function update_logs_quotes(ID, nickname, add_number) {
	const insertMessage = db.prepare(`INSERT INTO logs
											(date_time, nickname, ID_quote, add_number)
											VALUES (${new Date().getTime()}, ?, ?, ?)`)
	insertMessage.run(nickname, ID, add_number)
}

function get_rating_quote(ID) {
	const selectMessage = db.prepare(`SELECT sum(add_number)
										FROM logs
										WHERE ID_quote = ?`)
	const rating = selectMessage.all(ID)[0]['sum(add_number)']
	return rating
}

function get_sum_ratings(nickname) {
	try {
		const selectMessage = db.prepare(`SELECT sum(rating)
											FROM quotes
											WHERE author == ?`)

		const rating = selectMessage.all(nickname)[0]['sum(rating)']
		return rating
	} catch (error) {
		actions.push({"type": "error", "content": {"date_time": new Date(), "module_name": module_name, "error": error, "args": [nickname]}})
		return;
	}
}


function cmd_processing(sender, args, parameters) {
	try {
		if (args[0] == "add") {
			console.log("цитата add", args)
			if (args[1]) {
				let quote = args.slice(1).join(" ")
				console.log("Предложенная цитата:", quote)

				add_quote_to_bd(sender, quote)
				answ = "Ваша цитата отправлена на проверку!"
			} else {
				answ = "Верный синтаксис: add [Ваша личная цитата цензурного содержания]"
			}
		

		} else if (args[0] == "rep") {
			const rank_sender = parameters.rank_sender
			if (args.length == 1 || args[1] == "help") {
				answ = "Возможные аргументы: [id цитаты] [+(повысить рейтинг), -(понизить рейтинг), del(отменить голос)]. Пример: цитата rep 39 +. Рейтинг влияет на частоту появления цитаты в общем чате"
			
			} else if (Number(args[1])) {
				let ID = Number(args[1])
				if (ID && ID > 0 && ID <= quotes.length) {
					if (args[2] == "+" || args[2] == "-") {
						if (!quotes_rep[sender] || !quotes_rep[sender][ID]) {
							let quote_info = quotes[ID]
							let author;
							if (quote_info) {
								author = quote_info["author"]
							}
							if (author && author != sender) {
								let add_rep = 1;
								if (rank_sender >= 2 && rank_sender <= 4) {
									add_rep = 2
								} else if (rank_sender > 4) {
									add_rep = 3;
								}
								if (args[2] == "-") {
									add_rep = -add_rep
								}

								quotes[ID]["rating"] += add_rep

								update_quotes_rep(ID, sender, add_rep)

								update_logs_quotes(ID, sender, add_rep)

								update_rating(ID)
		
								answ = "Рейтинг успешно изменён"
								

							} else {
								answ = "Вы не можете поставить рейтинг самому себе"
							}

						} else {
							answ = "Вы уже оставили свой голос для этой цитаты. Выберите другую или отмените голос для этой с помощью сmd цитата rep [ID] del"
						}
					} else if (args[2] == "del") {		
						if (quotes_rep[sender] && quotes_rep[sender][ID]) {
							let add_rep = - quotes_rep[sender][ID]
							delete(quotes_rep[sender][ID])
							let quote_info = quotes[ID]
							let author;
							if (quote_info) {
								author = quote_info["author"]
							}
							fs.writeFileSync(path_rep, JSON.stringify(quotes_rep))

							update_logs_quotes(ID, sender, add_rep)

							update_rating(ID)	

							answ = "Голос успешно удалён"
						} else {
							answ = "Вы ещё не поставили оценку этой цитате"
						}
					} else {
						answ = "Вы должны указать, что вы хотите сделать с рейтингом выбранной цитаты. Повысить(+),  понизить(-) или отменить голос(del)"
					}
				} else {
					answ = "Цитаты с данным айди не существует"
				}
				
			} else {
				answ = "Верный синтаксис: [id цитаты] [+(повысить рейтинг), -(понизить рейтинг), del(отменить голос)]"
			}

		} else if (args[0] == "list") {
			send_in_private_message = true;
			if (args.length == 1 || args[1] == "help") {
				answ = "Возможные аргументы: [by - цитаты конкретного человека; all - информация о всех цитатах]"
			}
			if (args[1] == "by") {
				if (args.length == 2) {
					answ = "Возможные аргументы: [ник_игрока]. Покажет айди и начало цитат выбранного игрока"
				} else {
					let nick = args[2]
					let num_page;
					if (args.length > 3) {
						num_page = Number(args[3])
					}
					if (!num_page) {
						num_page = 1;
					}
					let quotes = generate_quotes_list(nick)
					if (quotes && quotes.length > 0) {
						answ = text.stats_split_into_pages(quotes, nums_in_page=5, num_page=num_page, begin_text=`Цитаты игрока ${nick}: `)["answ"]
					} else {
						answ = "У выбранного игрока нет цитат"
					}
					console.log("АНСВ", answ)
				}
				
			} else if (args[1] == "all") {
				let num_page;
				if (args.length > 2) {
					num_page = Number(args[2])
				}
				if (!num_page) {
					num_page = 1;
				}
				let stats = generate_quotes_stats()
				answ = text.stats_split_into_pages(stats, nums_in_page=3, num_page=num_page, begin_text="Тест: ")["answ"]
			} else {
				answ = "Возможные аргументы: [by, all]"
			}
			
			

		} else if (args[0] == "by") {
			let author = args[1]
			if (author) {
				
				let quotes_by_author = get_quotes_from_author(author)
				if (quotes_by_author.length > 0) {
					let quote_info = random_choice(quotes_by_author)
					let ID = quote_info["ID"]
					let author = quote_info["author"]

					let info = send_quote(ID)
					if (info["is_ok"]) {
						answ = `Цитата игрока ${author} с id ${ID} была отправлена!`
					} else {
						answ = info["message_error"]
					}

				} else {
					send_in_private_message = true;
					answ = "Цитат данного автора не было найдено"
				}

			} else {
				send_in_private_message = true;
				answ = "Верный синтаксис: by [ник игрока, чью цитату хотелось бы прочитать]"
			}


		} else if (args[0] == "id") {
			let ID = Number(args[1])
			if (ID) {
				let info = send_quote(ID)

				send_in_private_message = true;
				if (info["is_ok"]) {
					let author = info["author"]
					answ = `Цитата игрока ${author} с id ${ID} была отправлена!`
				} else {
					answ = info["message_error"]
				}

			} else {
				send_in_private_message = true;
				answ = "Верный синтаксис: id [айди цитаты]"
			}

		} else {
			let quote_info = send_random_quote()
			let author = quote_info["author"]
			let ID = quote_info["ID"]

			send_in_private_message = true;
			answ = `Цитата игрока ${author} с id ${ID} была отправлена!`
		}

		return {
			type: "answ",
			content: {
				"message": answ,
				"recipient": sender
			}
		}

	} catch (error) {
		return {"type": "error", "content": {"date_time": new Date(), "module_name": module_name, "error": error, "args": args}}
	}
}

function get_actions() {
	return actions.splice(0)
}

setInterval(send_random_quote, 12000 * 10**3)

module.exports = {module_name, cmd_processing, get_actions, help, structure}
