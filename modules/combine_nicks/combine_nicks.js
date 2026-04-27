const ConfigParser = require('configparser');
const path = require("path")

const config = new ConfigParser();
config.read("modules/combine_nicks/config.ini")

const { random_choice, random_number } = require(path.join(BASE_DIR, "utils", "random.js"))
const { substitute_text } = require(path.join(BASE_DIR, "utils", "text.js"))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const MODULE_NAME = "скрести"
const HELP = "Показывает совместимость людей и возможное имя их ребёнка"
const STRUCTURE = {
	nick1: {
		"+": {
			nick2: {
				"=": {
					_default: false,
					_aliases: ["равно", "дети", "имя"],
					_description: "Если указано, покажет возможное имя будущего ребёнка. Если не указано, покажет процент совместимости"
				},
				_type: "nick",
				_description: "Ник второго игрока"
			},
			_aliases: ["и", "с", "плюс"],
			_description: "Разделитель между никами"
		},
		_type: "nick",
		_description: "Ник первого игрока"
	}
}

const phrases = {};
phrases["compatibility"] = JSON.parse(config.get("phrases", "compatibility"))


class CombineModule extends BaseModule {
	constructor () {
	    super(MODULE_NAME, HELP, STRUCTURE)

	    this.MAX_PERCENT_DELTA = 15
		this.MAX_PERCENT_SIMILARITY = 5
		this.MAX_PERCENT_PARTS = 10
		this.MAX_PERCENT_RIGHT_1 = 20
		this.MAX_PERCENT_RIGHT_2 = 10
		this.MAX_PERCENT_RANDOM = 45

		this.VOW_LETTER = 'aeiouyаеёиоуыэюя1'
		this.CON_LETTER = 'bcdfghjklmnpqrstvwxyzбвгджзйклмнпрстфхцчшщ'
	  }

	_process(sender, args, parameters) {
		let answ;
		const send_in_private_message = false;

		const nick1 = args[0].value
		const nick2 = args[2].value

		if (args[3].value) {
			const new_nick = this.combine_nicks(nick1, nick2, random_choice(["random_symbols", "gen"]))
			answ = `${nick1} + ${nick2} = ${new_nick}`
		} else {
			const percent_compatibility = this.check_compatibility(nick1, nick2)
			answ = substitute_text(
				random_choice(phrases["compatibility"]),
				{
					"nick1": nick1,
					"nick2": nick2,
					"percent": percent_compatibility
				}
			)

		}
			
		if (answ) {
			return {
				message: answ,
				send_in_private_message
			}
		}
	}

	generate_nick(vows=this.VOW_LETTER, cons=this.CON_LETTER, _num_block=false, len_nick=random_number(4, 8)) {
		let nick = "";
	    let vow_or_con = random_choice(["vow", "con"])
	    for (let i = 0; i < len_nick; i++) {
	        if (vow_or_con === "vow") {
	            nick += random_choice(vows)
	            vow_or_con = "con";
			} else {
	            nick += random_choice(cons)
	            vow_or_con = "vow";
			}
		}
	    return nick.toLowerCase()
	}

	sum_nicks_charcode(nick1, nick2) {
		const nicks = nick1 + nick2
		let sum_unicode = 0;
		for (let i = 0; i < nicks.length; i++) {

			sum_unicode += nicks[i].charCodeAt() - i;
		}
		return sum_unicode**2 % 101;
	}

	compare_nicks(nick1, nick2) {
		let count_match_symbols = 0
		const len_min_nick = Math.min(nick1.length, nick2.length)
		for (let i = 0; i < len_min_nick; i++) {
			if (nick1[i] === nick2[i]) {
				count_match_symbols++
			}
		}


		let max_matched_symbols = 0;
		let max_nick, min_nick;
		if (nick1.length > nick2.length) {
			max_nick = nick1;
			min_nick = nick2;
		} else {
			max_nick = nick2
			min_nick = nick1
		}
		for (let i = 0; i < min_nick.length; i++) {
			for (let j = i+1; j <= min_nick.length; j++) {
				if (max_nick.includes(min_nick.slice(i, j))) {
					max_matched_symbols = Math.max(max_matched_symbols, j-i)
					
				} else {
					break;
				}
			}
		}
		return Math.max(count_match_symbols, max_matched_symbols) / Math.max(nick1.length, nick2.length)
	}

	right_nick(nick) {
		let correct_symbols = 1;
		let uncorrect_symbols = 0;
		let last_symbol_vow = this.VOW_LETTER.includes(nick[0])

		for (let i = 1; i < nick.length; i++) {
			if (this.VOW_LETTER.includes(nick[i])) {
				if (!last_symbol_vow) {
					correct_symbols++;
				} else {
					uncorrect_symbols++;
				}
				last_symbol_vow = true;
				
			} else if (this.CON_LETTER.includes(nick[i])) {
				if (last_symbol_vow) {
					correct_symbols++;
				} else {
					uncorrect_symbols++;
				}
				last_symbol_vow = false;
			}
		}
		return correct_symbols / (correct_symbols + uncorrect_symbols)
	}

	check_compatibility(nick1, nick2) {
		nick1 = nick1.toLowerCase()
		nick2 = nick2.toLowerCase()

		const delta_nicks = Math.round((16 - Math.abs(nick2.length - nick1.length)) / 16 * this.MAX_PERCENT_DELTA)

		const similarity_nicks = Math.round(this.compare_nicks(nick1, nick2) * this.MAX_PERCENT_SIMILARITY)

		const count_parts = Math.floor((16 - Math.abs(nick1.split(/[@#$&\-+_=]/).length - nick2.split(/[@#$&\-+_=]/).length)) / 16 * this.MAX_PERCENT_PARTS)

		const right_nick1 = this.right_nick(nick1)
		const right_nick2 = this.right_nick(nick2)
		let right_nicks =  (1 - Math.abs(right_nick1 - right_nick2)) * this.MAX_PERCENT_RIGHT_1
		right_nicks += (right_nick1 + right_nick2) / 2 * this.MAX_PERCENT_RIGHT_2
		right_nicks = Math.ceil(right_nicks)

		const random_percent = Math.round(this.sum_nicks_charcode(nick1, nick2) / 100 * this.MAX_PERCENT_RANDOM)

		return (delta_nicks + similarity_nicks + count_parts + right_nicks + random_percent)
	}

	combine_nicks(nick1, nick2, mode) {
		if (mode === "random_symbols"){
			const nicks = (nick1 + nick2).toLowerCase();
			let cons = []
			let vows = []
			for (let i = 0; i < nicks.length; i++) {
				const sym = nicks[i]
				if (this.CON_LETTER.includes(sym.toUpperCase()) && !cons.includes(sym)) {
					cons.push(sym)
					
				} else if (this.VOW_LETTER.includes(sym.toUpperCase()) && !vows.includes(sym)) {
					vows.push(sym)
				}
				
			}
			if (vows.length === 0) {
				vows = nicks
			}
			if (cons.length === 0) {
				cons = nicks
			}
			return this.generate_nick(vows, cons)


		} else if (mode === "gen") {
			const significance_symbols = "-+=_~QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnmЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮЁйцукенгшщзхъфывапролджэячсмитьбюё0123456789".split("").sort(() => Math.random() - 0.5)
			let new_nick = "";
			const min_len_nick = Math.min(nick1.length, nick2.length)
			for (let i = 0; i < min_len_nick; i++) {
				const [sym1, sym2] = [nick1[i], nick2[i]]
				if (significance_symbols.indexOf(sym1) < significance_symbols.indexOf(sym2)) {
					new_nick += sym1
				} else {
					new_nick += sym2
				}
				
			}
			if (nick1.length > nick2.length) {
				new_nick += nick1.slice(nick2.length)
			} else {
				new_nick += nick2.slice(nick1.length)
			}
			return new_nick.toLowerCase();
		}
	}
}

module.exports = CombineModule