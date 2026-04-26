const path = require("path")

const BaseCmd = require(path.join(__dirname, "..", "base.js"))


const CMD_NAME = "server"
const STRUCTURE = {
  _description: "Серверные команды",

  near: {
    _description: "Список игроков, находящихся рядом"
  },
  lookup: {
    nick: {
        _type: "nick",
        _optional: true,
    },
    _description: "Информация об игроке"
  },
  seen: {
    nick: {
        _type: "nick",
    },
    _description: "Местоположение игрока"
  },
  spawnmob: {
    count: {
        mob_name: {
            rider_name: {
                _type: "string",
                _optional: true,
                _description: "Название моб-наездника"
            },
            _type: "string",
            _description: "Название моба"
        },
        _type: "int",
        _optional: true
    }
  }
};


class ServerCmd extends BaseCmd {
    constructor(module_obj) {
        super(module_obj, CMD_NAME, STRUCTURE)
    }

    _process(sender, args) {
        if (this.module_obj.access_cmds[sender].includes(args[0].name)) {
            const flattern_args = this.CommandManager.flattenArgs(args)

            this.module_obj.actions.push({
                type: "cmd",
                content: {
                    module_sender: this.module_obj.module_name,
                    cmd: `/${flattern_args.join(" ")}`,
                    identifier: sender
                }
            })
        } else {
            return "Недостаточно прав для использования этой команды"
        }
    }
}

module.exports = ServerCmd
