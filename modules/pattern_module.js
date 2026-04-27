const path = require("path");
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const MODULE_NAME = ""
const HELP = ""
const STRUCTURE = {

}


class Module extends BaseModule {
	constructor () {
        super(MODULE_NAME, HELP, STRUCTURE)
    }

	_process(sender, args, parameters, unused_args) {
		
	}
}

module.exports = Module