class BaseCmd {
    constructor(module_obj, module_name, structure, interval_check_actions) {
        this.module_obj = module_obj;
        this.module_name = module_name
        this.structure = structure
        
        this.actions = []
        this.interval_check_actions = interval_check_actions
        this.get_actions = () => {
            return this.actions.splice(0);
        };

        this.CommandManager = null;
    }

    set_command_manager(CommandManager) {
        this.CommandManager = CommandManager;
    }

    // Общий шаблон
    async cmd_processing(sender, args, cmd, msg_obj) {
        const rank = this.get_rank(sender, this.module_name)
        console.log("Ранг", rank)
        const valid_command = this.CommandManager.validate_command(this.module_name, args, rank)
        if (valid_command["is_ok"]) {
            try {
                const result = await this._process(sender, valid_command.args, valid_command.unused_args, cmd, msg_obj);
                if (!result) {return;}

                let answ;
                let message_type = "text";
                if (typeof result === "object") {
                    answ = result.message
                    if (result.message_type !== undefined) {
                        message_type = result.message_type
                    }
                } else {
                    answ = result
                }
                if (message_type === "text") {
                    this.module_obj.send_message_tg(sender, answ)
                } else if (message_type === "document") {
                    this.module_obj.send_message_tg(sender, answ, undefined, true)
                }
            } catch (error) {
                this.module_obj.actions.push({
                    type: "error",
                    content: {
                        date_time: new Date(),
                        module_name: this.module_obj.module_name,
                        error: error,
                        args: [sender, args]
                    }
                })
                this.module_obj.send_message_tg(sender, `Во время выполнения команды '${this.module_name}' возникла ошибка.`)
            }
        } else {
            this.module_obj.send_message_tg(sender, valid_command["message_error"])
        }
    }


    // Метод для переопределения
    _process(_sender, _args, _unused_args, _cmd, _msg_obj) {
        return null;
    }

    get_rank(tg_id, module_name) {
        const access_lvls_module = this.module_obj.access_lvls[module_name]
        console.log("access_lvls", this.module_obj.access_lvls)
        if (access_lvls_module) {
            for (let i=0; i < access_lvls_module.length; i++) {
                if (access_lvls_module[i].includes(tg_id)) {
                    return i;
                }
            }
        }
        if (this.module_obj.player_settings[tg_id]) {
            return 0;
        }
        return -1;
    }
}



module.exports = BaseCmd