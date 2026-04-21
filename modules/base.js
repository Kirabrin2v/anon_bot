const path = require("path");

const bus = require(path.join(BASE_DIR, "event_bus.js"));


class BaseModule {
    constructor(module_name, help_text, structure=undefined, interval_check_actions=undefined) {
        this.module_name = module_name;
        this.help = help_text
        this.structure = structure
        
        this.actions = []
        this.interval_check_actions = interval_check_actions

        this.get_actions = () => {
            return this.actions.splice(0);
        };
        
        setInterval(() => {
            if (this.actions.length > 0) {
                bus.emit("new_actions", { actions: this.actions.splice(0) })
            }

        })

        this.ModuleManager = null;
    }

    set_module_manager(ModuleManager) {
        this.ModuleManager = ModuleManager;
    }

    diagnostic_eval(eval_expression) {
        try {
            return eval(eval_expression)
        } catch (error) {
            return error
        }
    }

    // Общий шаблон
    async cmd_processing(sender, args, cmd_parameters, valid_args, unused_args) {
        const result = await this._process(sender, args, cmd_parameters, valid_args, unused_args);

        if (!result) {return;}

        // если вернули просто строку — отправляем ответ
        if (typeof result === "string") {
            return {
                type: "answ",
                content: {
                    message: result,
                    recipient: sender
                }
            };
        }

        // если вернули объект
        const {
            message,
            recipient = sender,
            type = "answ",
            ...extra
        } = result;

        return {
            type,
            content: {
                message,
                recipient,
                ...extra
            }
        };
    }
    // Метод для переопределения
    _process(sender, args, cmd_parameters, valid_args, unused_args) {
        return null;
    }

    server_answ_processing(cmd, server_answ, values, identifier, is_confirmed) {
        try {
            return this._server_answ_processing(cmd, server_answ, values, identifier, is_confirmed)
        } catch (error) {
            this.actions.push({
                type: "error",
                content: {
                    date_time: new Date(),
                    module_name: this.module_name,
                    error: error,
                    args: [cmd, server_answ, values, identifier, is_confirmed]
                }
            })
        }
    }

    _server_answ_processing(cmd, server_answ, values, identifier, is_confirmed) {

    }
}

module.exports = { BaseModule }