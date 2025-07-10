import sqlite3 as sq

strings = {}

with sq.connect("old_players_stats.db") as con:
	cur = con.cursor()

	cur.execute("""SELECT * FROM messages""")
	for info in cur:
		nickname, date_time, type_chat, message = info[1:]

		if nickname and type_chat != "Тесла" and type_chat != "Скрипт" and message and message != " ":

			strings[date_time+nickname+message] = [nickname, date_time, type_chat, message]#{"nickname": nickname, "date_time": date_time, "type_chat": type_chat, "message": message}

with sq.connect("2025-01-08.db") as con:
	cur = con.cursor()

	cur.execute("""SELECT * FROM messages""")
	for info in cur:
		nickname, date_time, type_chat, message = info[1:]

		if nickname and type_chat != "Тесла" and type_chat != "Скрипт" and message and message != " ":

			strings[date_time+nickname+message] = [nickname, date_time, type_chat, message]#{"nickname": nickname, "date_time": date_time, "type_chat": type_chat, "message": message}


with sq.connect("logs.db") as con:
	cur = con.cursor()

	for key in strings:
		nickname, date_time, type_chat, message = strings[key]

		cur.execute("""INSERT INTO players_logs (
						date_time, type_chat, nickname, message, is_old)
						VALUES (?, ?, ?, ?, 1)""", (date_time, type_chat, nickname, message))
