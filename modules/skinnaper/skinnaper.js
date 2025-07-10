const module_name = "skinnaper"
const help = "Ворует скины"
const structure = {
	nick: {
		version: {
			_type: "int",
			_default: 1,
			_description: "Версия скина. Если игрок менял скин N раз, то N - последняя версия, а 1 - самая первая"
		},
		_type: "nick",
		_description: "Ник игрока, скин которого нужно получить"
	}
}

const fetch = require('node-fetch');
const fs = require('fs');

const path = require('path')

let actions = []

function date_to_text(date) {
	const year = date.getFullYear();
    const month = String(date.getMonth()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    // const seconds = String(date.getSeconds()).padStart(2, '0');
	return `${year}-${month}-${day} ${hours}:${minutes}`
}

function downloadFile(url, path) {
	try {
	  return fetch(url).then(res => {
	    res.body.pipe(fs.createWriteStream(path));
	  });
	} catch (error) {
		return downloadFile(url, path)
	}
}

function cmd_processing(sender, raw_args, parameters, args) {
	const seniors = parameters.seniors
	let answ;
	console.log(args)
	if (args[0].name == "nick") {
		const nick = args[0].value
		const version = args[1].value - 1

		const pathdir = path.join(__dirname, `skins/${nick}`)
		console.log(pathdir)

		let is_exist = true;
		try {
			const is_exist = fs.statSync(pathdir)
		} catch (error) {
			is_exist = false;
		}

		if (is_exist) {
			const urls = fs.readFileSync(path.join(pathdir, "urls.txt"), 'utf-8').split("\n")
			if (urls[version]) {
				answ = `${version + 1}-ая версия скина игрока ${nick}: ${urls[version]}`
			} else {
				answ = `${version + 1}-ой версии скина игрока ${nick} не существует. Он менял скин лишь ${urls.length - 2} раз`
			}

		} else {
			answ = "Я ещё ни разу не видел этого игрока, поэтому не могу показать его скин"
		}
	}

	return {
		type: "answ",
		content: {
			message: answ,
			recipient: sender
		}}
}

function processing_skin_url(nick, skin_url) {
	try {
		if (nick.length == 0 || nick == "Kanaderi") return;
		
		const pathdir = path.join(__dirname, `skins/${nick}`)
		const date_text = date_to_text(new Date())
		fs.stat(pathdir, (err, stats) => {
			if (err == null) {
				const urls = fs.readFileSync(path.join(pathdir, "urls.txt"), 'utf-8').split("\n")
				if (!urls.includes(skin_url)) {
					downloadFile(skin_url, `${pathdir}/${date_text}.jpg`)
					fs.appendFile(path.join(pathdir, "urls.txt"), skin_url + "\n", 'utf-8', (err) => {
						if (err) console.log(err)
					})
				} 
		}
			else {
				fs.mkdirSync(pathdir, { recursive: true });
				fs.writeFileSync(path.join(pathdir, "urls.txt"), skin_url + "\n", 'utf-8')
				downloadFile(skin_url, `${pathdir}/${date_text}.jpg`)
			}
		})
	} catch (error) {
		actions.push({type: "error",
			content: {
				date_time: new Date(),
				module_name: module_name,
				error: error,
				args: [nick, skin_url]}})
	}
}

function get_actions() {
	return actions.splice(0)
}

function diagnostic_eval (eval_expression) {
	try {
		return eval(eval_expression)
	} catch (error) {
		return error
	}
}

module.exports = {module_name, cmd_processing, diagnostic_eval, processing_skin_url, get_actions, help, structure}