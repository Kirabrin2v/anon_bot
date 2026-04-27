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
		const cmd = `/party invite ${sender}`
		this.actions.push({
			type: "cmd",
			content: {
				cmd
			}
		})
	}
}

module.exports = PartyModule