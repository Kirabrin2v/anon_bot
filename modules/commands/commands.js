const ConfigParser = require('configparser');
const path = require("path");

const { BaseModule } = require(path.join(__dirname, "..", "base.js"))
const bus = require(path.join(BASE_DIR, "event_bus.js"))
const { get_bot } = require(path.join(BASE_DIR, "init.js"))

const MODULE_NAME = "command_handler"

const config = new ConfigParser();
config.read(path.join(BASE_DIR, "txt", "config.ini"))

const seniors = JSON.parse(config.get("VARIABLES", "seniors"))
const masters = JSON.parse(config.get("VARIABLES", "masters"))
const master_cmds = JSON.parse(config.get("VARIABLES", "master_cmds"))
const bot = get_bot()

class CommandHandlerModule extends BaseModule {
    constructor() {
        super(MODULE_NAME, undefined, undefined, 1000)
    }

    parseArgs(inputString) {
        const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
        const args = [];
        let match;
        while ((match = regex.exec(inputString)) !== null) {
        args.push(match[1] || match[2] || match[3]);
        }
        return args;
    }

    check_access(cmd, args, lvl, module_cmd_access) {
        if (lvl === undefined || lvl < 0) {return false;}

        let access_object = module_cmd_access[cmd]
        if (access_object) {access_object = access_object[lvl]}

        if (!access_object) {return true;}

        const source_objects = module_cmd_access[cmd].slice(0, lvl)
        source_objects.reverse()
        for (let i=0; i < source_objects.length; i++) {
            access_object = merge_with_inherited(access_object, source_objects[i])
        }
        
        if (args.length === 0 && !access_object[""]) {return false;}

        let index_args = 0

        while (typeof access_object !== "string") {
            if (args.length === index_args) {return true;}
            access_object = access_object[args[index_args]]
            index_args++;
            if (!access_object) {return false;}

        }
        if (access_object === "access_before" && args.length === index_args) {return true;}
        if (access_object === "end") {return true;}
        return false;
        
    }

    check_allow_cmd(cmd, args) {
        if (args) {
            cmd = `${cmd} ${args.join(" ")}`
        }

        for (let i=0; i < master_cmds.length; i++) {
            if (cmd.startsWith(master_cmds[i])) {
                return true;
            }
        }
        return false
    }

    generate_help_message(num_page) {
        const modules = this.ModuleManager
        const CommandManager = this.CommandManager
        const help_list = Object.entries(modules.modules)
            .filter((elem) => CommandManager.modules_structure[elem[0]] && elem[1].cmd_processing)
            .map((elem) => [elem[0], elem[1].help])
        const info = this.ModuleManager.call_module("text").stats_split_into_pages(help_list, 3, num_page, "Информация о командах: ")
        if (info) {
            return info["answ"]
        } else {
            return "Ошибка"
        }
    }

    handle(sender, message) {
        console.log("Получено:", sender, message)
        if (!message.toLowerCase().includes("cmd ")) return false

        message = message.replace(/[c|C][m|M][d|D]/, "cmd")

        let rank_sender = this.ModuleManager.call_module("stats").get_stats(sender, "rank")
        if (seniors.includes(sender)) {
            rank_sender = 6;
        }
        if (!rank_sender) {
            rank_sender = 0;
            
        }

        const flags = []
        let chat_send
        let send_in_private_message
        const count_flags = 0

        const flags_match = message.split("cmd ")[0].matchAll(/-([^ -]*)(?: |$)/g)
        for (let flag of flags_match) {
          flag = flag[1].toLowerCase()
          if      (flag === "cc") { chat_send = "/cc " }
          else if (flag === "pc") { chat_send = "/pc " }
          else if (flag === "p")  { send_in_private_message = true }
          else if (flag === "l")  { chat_send = "" }
          else if (flag === "g" && (seniors.includes(sender) || rank_sender >= 6)) {
            chat_send = "!"
          } else {
            flags.push(flag)
          }
          if (count_flags === 5) break
        }

        console.log("Флаги:", flags, chat_send, send_in_private_message)

        const parts = message.split("cmd ")[1].split(" ")
        const cmd = parts[0].toLowerCase()
        const args = this.parseArgs(parts.slice(1).join(" "))
        const cmd_parameters = { cmd, rank_sender, seniors}

        if (!cmd || (rank_sender === 0 && cmd !== "bank")) return false

        console.log(`cmd ${cmd} args ${args}`)

        const update_action = {
          type: "answ",
          content: { chat_send, send_in_private_message }
        }

        const CommandManager = this.CommandManager
        const modules = this.ModuleManager

        if (cmd === "help") {
          const answ = args[0] === "help"
            ? "Возможные аргументы: [номер страницы]"
            : this.generate_help_message(Number(args[0]) || 1)
          this.actions.push({
            type: "answ",
            content: {
                recipient: sender,
                message: answ
            }
          })

        } else if (CommandManager.modules_structure[cmd]) {
          const module_object = modules.call_module(cmd, sender)
          const valid_command = CommandManager.validate_command(module_object.module_name, args)

          if (!valid_command.is_ok) {
            this.actions.push({
              type: "answ",
              content: {
                recipient: sender,
                message: valid_command.message_error
              }
            })
            return true
          }

          const has_access =
            module_object.cmd_access
              ? this.check_access(cmd, args, rank_sender, module_object.cmd_access)
              : rank_sender > 0

          if (!has_access) {
            if (rank_sender > 0) {
                this.actions.push({
                  type: "answ",
                  content: {
                    recipient: sender,
                    message: "У Вас недостаточно прав"
                  }
                })
            }
            return true
          }

          const cooldown_info = modules.call_module("cooldown").check_cooldown(sender, cmd, args)
          if (cooldown_info && !seniors.includes(sender) && !cooldown_info.is_ok) {
            this.actions.push(cooldown_info)
            return true
          }

          Promise.resolve(
            module_object.cmd_processing(sender, valid_command.args, cmd_parameters, valid_command.unused_args)
          )
            .then(resolved => bus.emit(
                "new_actions",
                {
                    actions: resolved,
                    module_name: undefined,
                    update_action
                }
            )).catch(console.error)

        } else if (this.check_allow_cmd(cmd, args) && masters.includes(sender)) {
          bot.chat(`${cmd} ${args.join(" ")}`)

        } else if (seniors.includes(sender)) {
          if (cmd === "js") {
            try { eval(args.join(" ")) }
            catch (error) { console.log(error) }
          } else {
            bot.chat(`${cmd} ${args.join(" ")}`.trim())
          }

        } else {
            this.actions.push({
              type: "answ",
              content: {
                recipient: sender,
                message: "Команда не найдена"
              }
            })
        }

        return true
    }
}

module.exports = CommandHandlerModule