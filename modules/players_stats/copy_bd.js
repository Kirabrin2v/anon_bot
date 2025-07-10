
const sqlite = require("better-sqlite3");

const db = new sqlite("2025-01-08.db");

const new_db = new sqlite("new_players_stats.db")

const old_stats = db.prepare("SELECT * FROM stats").all()

old_stats.forEach(old_stat => {

	new_db.prepare(`INSERT INTO stats (
				nickname, rank, messages, cmds, donate, casino, name, credit, warns, echo, twinks)
				VALUES ('${old_stat.nickname}', '${old_stat.rank}', '${old_stat.messages}', '${old_stat.cmds}', '${old_stat.donate}', '${old_stat.casino}', '${old_stat.name}', '${old_stat.credit}', '${old_stat.warns}', '${old_stat.echo}', '${old_stat.twinks}')`).run()

})

console.log(old_stats)