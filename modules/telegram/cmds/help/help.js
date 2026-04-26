const path = require("path")

const BaseCmd = require(path.join(__dirname, "..", "base.js"))


const CMD_NAME = "help"
const STRUCTURE = {
    list: {
        _description: "Список доступных команд"
    },
    _description: "Информация о командах"
};


class HelpCmd extends BaseCmd {
    constructor(module_obj) {
        super(module_obj, CMD_NAME, STRUCTURE)
    }

    _process(sender, args) {
        let answ;
        if (args[0].name === "list") {
            const commands = this.CommandManager.get_available_commands(
                sender,
                (tg_id, module_name) => this.get_rank(tg_id, module_name)
            );
            answ = this.format_commands(commands)
        }
        return answ
    }

    format_commands(commands_dict, title = "Доступные команды") {
      const lines = [];

      lines.push(`${title}\n`);

      const entries = Object.entries(commands_dict);

      if (entries.length === 0) {
        return "❌ Нет доступных команд";
      }

      for (const [cmd, desc] of entries) {
        lines.push(`🔹 /${cmd}`);
        if (desc) {
          lines.push(`   └ ${desc}`);
        }
      }

      return lines.join("\n");
    }

}

module.exports = HelpCmd
