const path = require("path")

const CommandEngine = require(path.join(__dirname, "command_engine.js"))
const { ModuleManagerConstuctor } = require(path.join(BASE_DIR, "module_manager.js"))

const CommandManager = new CommandEngine();
const actions = []

class TelegramModuleManager extends ModuleManagerConstuctor {
    constructor () {
        super()
        this.modules = {}
        this.alias_index = new Map();

        this.TelegramModule = null;

        this.is_modules_load = false;

    }
    async load_modules(paths, TelegramModule) {
        console.log("Загрузка команд ТГ", paths)
        const load_promises = paths.map(async (path) => {
            let mod;
            try {
                const Module = require(path)
                mod = new Module(TelegramModule)
                mod.set_command_manager(CommandManager)
                if (mod.initialize) {
                    mod.initialize()
                }

                if (mod.structure) {
                    CommandManager.modules_structure[mod.module_name] = mod.structure

                    this.register_aliases(mod.module_name, mod.structure)
                }
                this.modules[mod.module_name] = mod

            } catch (error) {
                if (!mod) {mod = {}}
                console.log(`При импортировании модуля '${path}' возникла ошибка: ${error}`)
                actions.push({
                    type: "error",
                    content: {
                        date_time: new Date(),
                        module_name: mod.module_name || path,
                        error: error,
                        args: []
                    }
                })
            }
        })
        await Promise.all(load_promises)
        this.is_modules_load = true;
    }

    register_aliases(module_name, structure) {
        if (!structure) {return;}

        const aliases = structure._aliases;

        if (Array.isArray(aliases)) {
            for (const alias of aliases) {
                this.alias_index.set(alias, module_name);
            }
        }
    }

    get_module_name(alias) {
        const module_name = this.alias_index.get(alias)
        if (module_name) {return module_name;}
        if (this.modules[alias]) {return alias;}
        return null;
    }
}

function get_module_manager_actions() {
    return actions.splice(0);
}

module.exports = { 
    ModuleManager: new TelegramModuleManager(),
    CommandManager,
    get_module_manager_actions
}