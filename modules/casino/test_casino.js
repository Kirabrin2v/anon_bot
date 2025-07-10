const casino = require("./casino.js")

var balance = 0

casino.update_survings(1000000000)

var dict = {"4500": 0, "-5000": 0}

for (let i=0; i<1000000; i++) {
	const answ = casino.cmd_processing("Herobrin2v", [50000], {"rank_sender": 5})
	//console.log(answ)
	casino.payment_processing("Herobrin2v", "survings", 50000)
	const actions = casino.get_actions()
	var winner_sum = actions[1]["content"]["value"]
	balance += winner_sum
	dict[winner_sum] += 1
}

console.log(balance, dict)