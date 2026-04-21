const path = require("path");
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const MODULE_NAME = "party"
const HELP = "Пригласит Вас в пати"
const STRUCTURE = {

}


class PartyModule extends BaseModule {
	constructor () {
        super(MODULE_NAME, HELP, STRUCTURE)
    }

	_process(sender, args) {
		let answ;
		if (args[0] === "help") {
			answ = "Пропишите команду без аргуменов и бот пригласит Вас в пати"
			return answ
		} else {
			const cmd = `/party invite ${sender}`
			this.actions.push({
				type: "cmd",
				content: {
					cmd
				}
			})
		}
	}
}

module.exports = PartyModule