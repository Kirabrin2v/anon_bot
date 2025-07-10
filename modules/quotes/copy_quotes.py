import sqlite3 as sq


with sq.connect("old_quotes.db") as con:
	cur = con.cursor()

	cur.execute("""SELECT citation, author, rating FROM quotes""")
	for info in cur:
		citation, author, rating = info

		with sq.connect("quotes.db") as con2:
			cur2 = con2.cursor()

			cur2.execute(f"""INSERT INTO quotes (citation, author, rating)
								VALUES ("{citation}", "{author}", "{rating}")""")