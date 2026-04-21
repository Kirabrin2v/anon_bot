const CommandEngine = require("./command_engine.js")
const bus = require("./event_bus");


const CommandManager = new CommandEngine();

class ModuleManager {
	constructor () {
		this.modules = {}

		this.is_modules_load = false;

		this.actions = []

		setInterval(() => {
            if (this.actions.length > 0) {
                bus.emit("new_actions", { actions: this.actions.splice(0) })
            }
        })

	}
	async load_modules(modules_info) {
		const load_promises = modules_info.map(async (module_info) => {
			const path = module_info[0]
			let parameters, mod;
			try {
				parameters = module_info[1]
				const Module = require(path)
				mod = new Module(parameters)
				//console.log("реквайр", mod)
				mod.set_module_manager(this)
				if (mod.initialize) {
					mod.initialize(parameters)
				}
				if (mod.structure && !mod.only_tg) {
					CommandManager.modules_structure[mod.module_name] = mod.structure
					CommandManager.modules_structure[mod.module_name]._description = mod.help
				}
				this.modules[mod.module_name] = mod
				if (mod.interval_check_actions !== undefined) {
					setInterval(() => {
					  const new_actions = this.call_module(mod.module_name).get_actions()
					  if (new_actions) {
					    this.actions.push(...new_actions)
					  }
					}, mod.interval_check_actions)
				}
				console.log(`${mod.module_name} успешно импортирован\n`)
			
			} catch (error) {
				if (!mod) {mod = {}}
				console.log(`При импортировании модуля '${path}' возникла ошибка: ${error}`)
				this.actions.push({
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
		bus.emit("modules_load", {});
	}
	call_module(module_name, initiator) {
		const mod = this.modules[module_name]
		const manager = this;
		if (mod) {
			return new Proxy(mod, {
				get(target, prop) {
					const value = target[prop]

					if (typeof value === 'function') {
						return (...args) => {
							try {
								return value.apply(target, args)
							} catch (error) {
								manager.actions.push({
									type: "error",
									content: {
										date_time: new Date(),
										module_name: module_name,
										error: error,
										args: args,
										sender: initiator
									}
								})
								console.error(`[${initiator}] Ошибка при вызове ${prop} из модуля ${module_name}:`, error)
							}
						}
					} else {
						return value // просто значение, если не функция
					}
				}
			})

		} else {
			// console.log(`Модуля ${module_name} не существует`)
		}
		return new Proxy({}, {
			get(target, prop) {
				// Если кто-то попытается вызвать любую функцию на несуществующем модуле
				return (...args) => {
					// console.warn(`[${initiator || "system"}] Попытка вызвать метод "${prop}" у незагруженного модуля "${module_name}" с аргументами:`, args)
					return undefined
				}
			}
		})
	}
}


module.exports = { 
	ModuleManager: new ModuleManager(),
	CommandManager
}