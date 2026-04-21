const axios = require('axios');
const path = require('path');

const { BaseModule } = require(path.join(__dirname, "..", "base.js"))
const { slugify } = require(path.join(BASE_DIR, "utils", "text.js"))


const MODULE_NAME = "site"


class SiteModule extends BaseModule {
	constructor () {
        super(MODULE_NAME)
    }
	update_commands_db() {
		const structures = this.CommandEngine.modules_structure
		const commands = this.dict_to_list(structures)
		axios.post('http://192.168.0.108:8000/api/update_commands/', commands, {
		  headers: {
		    'Content-Type': 'application/json',
		    // 'Authorization': 'Token <your_token>', // если используется авторизация
		  }
		})
		.then(response => {
		  console.log('Успешно отправлено:', response.data);
		})
		.catch(error => {
		  console.error('Ошибка при отправке:', error.response?.data || error.message);
		});

	}
	dict_to_list(structures) {
		const list_commands = []
		for (const module_name in structures) {
			list_commands.push({
				command: slugify(module_name),
				short_description: structures[module_name]._description,
				args: structures[module_name]
			})
		}
		return list_commands;
	}
}

module.exports = SiteModule