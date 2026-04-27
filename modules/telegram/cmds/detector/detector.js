const path = require("path")

const BaseCmd = require(path.join(__dirname, "..", "base.js"))


const CMD_NAME = "detector"


class DetectorCmd extends BaseCmd {
    constructor(module_obj) {
        super(module_obj, CMD_NAME, null)
    }

    initialize() {
        this.structure = this.module_obj.ModuleManager.call_module("detector").structure
    }

    _process(sender, args) {
        return this.module_obj.ModuleManager.call_module("detector")._process(
            sender,
            args
        )
    }
}

module.exports = DetectorCmd
