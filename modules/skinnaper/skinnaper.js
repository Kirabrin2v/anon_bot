const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path')

const { date_to_text } = require(path.join(BASE_DIR, "utils", "text.js"))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))
const bus = require(path.join(BASE_DIR, "event_bus.js"))

const MODULE_NAME = "skinnaper"
const HELP = "Ворует скины"
const INTERVAL_CHECK_ACTIONS = 1000
const STRUCTURE = {
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


class SkinnaperModule extends BaseModule {
	constructor () {
        super(MODULE_NAME, HELP, STRUCTURE, INTERVAL_CHECK_ACTIONS)

        bus.on("player_spawn", (obj) => {
        	this.processing_skin_url(
        		obj.player.username,
        		obj.player.skinData.url
    		)
        })
    }

    downloadFile(url, path) {
		try {
		  return fetch(url).then(res => {
		    res.body.pipe(fs.createWriteStream(path));
		  });
		} catch {
			return this.downloadFile(url, path)
		}
	}

	_process(sender, args, parameters) {
		let answ;
		if (args[0].name === "nick") {
			const nick = args[0].value
			const version = args[1].value - 1

			const pathdir = path.join(__dirname, `skins/${nick}`)

			let is_exist;
			try {
				is_exist = fs.statSync(pathdir)
			} catch {
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

		return answ
	}

	processing_skin_url(nick, skin_url) {
		try {
			if (nick.length === 0 || nick === "Kanaderi") {return;}
			
			const pathdir = path.join(__dirname, `skins/${nick}`)
			const date_text = date_to_text(new Date(), false)
			fs.stat(pathdir, (err, _stats) => {
				if (err === null) {
					const urls = fs.readFileSync(path.join(pathdir, "urls.txt"), 'utf-8').split("\n")
					if (!urls.includes(skin_url)) {
						this.downloadFile(skin_url, `${pathdir}/${date_text}.jpg`)
						fs.appendFile(path.join(pathdir, "urls.txt"), skin_url + "\n", 'utf-8', (err) => {
							if (err) {console.log(err)}
						})
					} 
			}
				else {
					fs.mkdirSync(pathdir, { recursive: true });
					fs.writeFileSync(path.join(pathdir, "urls.txt"), skin_url + "\n", 'utf-8')
					this.downloadFile(skin_url, `${pathdir}/${date_text}.jpg`)
				}
			})
		} catch(error) {
			this.actions.push({
				type: "error",
				content: {
					date_time: new Date(),
					module_name: this.module_name,
					error: error,
					args: [nick, skin_url]
				}
			})
		}
	}
}


module.exports = SkinnaperModule