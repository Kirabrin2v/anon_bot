const module_name = "site"

const axios = require('axios');

let commands = []

function slugify(text) {
  const toLower = text.toLowerCase();
  const transliterate = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e',
    'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k',
    'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
    'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '',
    'э': 'e', 'ю': 'yu', 'я': 'ya',
  };
  const slug = toLower.replace(/[а-яё]/g, char => transliterate[char])
                    .replace(/[^a-z0-9\-]/g, '-') // замена на тире
                    .replace(/-+/g, '-') // удаление лишних тире
                    .replace(/^-+|-+$/g, '') // удаление начальных и конечных тире
                    .trim();

  return slug;
}

function dict_to_list(structures) {
	let list_commands = []
	for (let module_name in structures) {
		list_commands.push({
			command: slugify(module_name),
			short_description: structures[module_name]._description,
			args: structures[module_name]
		})
	}
	return list_commands;
}

function initialize(constants) {
	const structures = constants.structures
	commands = dict_to_list(structures)
	console.log(commands)
}

function update_commands_db() {
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


module.exports = {initialize, module_name, update_commands_db}