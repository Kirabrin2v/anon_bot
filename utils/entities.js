const path = require("path");

const { reg_nickname } = require(
	path.join(BASE_DIR, "./regex.js")
)

function get_players_and_distance(bot, start_point=bot.entity.position, max_distance=512, ignore_bot=true) {
	let players = Object.entries(bot.players)

	let players_and_distances = players.map(([nick, info]) => {
		let username = info.username;
		let entity = info.entity;

		if (username.match(reg_nickname) && entity && (!ignore_bot || username != bot_username)) {
			let distance = Number(start_point.distanceTo(entity.position).toFixed(2));
			if (distance <= max_distance) {
				return [username, distance];
			}
		}
	})
	players_and_distances = players_and_distances.filter((value) => value !== undefined)
	players_and_distances = players_and_distances.sort((player1, player2) => player1[1] - player2[1])

	return players_and_distances
}

function get_players_on_loc(bot) {
	let players = Object.keys(bot.players)
	let players_on_loc = players.filter((nick) => {
		return bot.players[nick] && bot.players[nick].displayName.text != ''
	})
	return players_on_loc
}

module.exports = {
	get_players_and_distance,
	get_players_on_loc
}