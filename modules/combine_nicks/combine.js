const ConfigParser = require('configparser');

const config = new ConfigParser();
config.read("modules/combine_nicks/config.ini")

const module_name = "скрести"
const help = "Показывает совместимость людей и возможное имя их ребёнка"

const structure = {
	nick1: {
		"+": {
			nick2: {
				"=": {
					_default: true,
					_description: "Если указано, покажет возможное имя будущего ребёнка. Если не указано, покажет процент совместимости"
				},
				_type: "nick",
				_description: "Ник второго игрока"
			},
			_description: "Разделитель между никами"
		},
		_type: "nick",
		_description: "Ник первого игрока"
	}
}

var phrases = {};
phrases["compatibility"] = JSON.parse(config.get("phrases", "compatibility"))

let vow_letter = 'aeiouyаеёиоуыэюя1'
let con_letter = 'bcdfghjklmnpqrstvwxyzбвгджзйклмнпрстфхцчшщ'

function substitute_text(pattern, values) {
	return pattern.replace(/\{([^}]+)\}/g, (match, key) => values[key]);
	
}

function random_choice(array) {
	return array[Math.floor(Math.random() * array.length)]
}

function random_number (min_num, max_num) {
	return Math.floor(Math.random() * (max_num - min_num + 1)) + min_num;
}

function generate_nick(vows=vow_letter, cons=con_letter, num_block=false, len_nick=random_number(4, 8)) {
	let nick = "";
    let vow_or_con = random_choice(["vow", "con"])
    for (let i = 0; i < len_nick; i++) {
        if (vow_or_con == "vow") {
            nick += random_choice(vows)
            vow_or_con = "con";
		} else {
            nick += random_choice(cons)
            vow_or_con = "vow";
		}
	}
    return nick.toLowerCase()
}

function sum_nicks_charcode (nick1, nick2) {
	let nicks = nick1 + nick2
	let sum_unicode = 0;
	for (let i = 0; i < nicks.length; i++) {

		sum_unicode += nicks[i].charCodeAt() - i;
	}
	return sum_unicode**2 % 101;
}

function compare_nicks(nick1, nick2) {
	let count_match_symbols = 0
	let len_min_nick = Math.min(nick1.length, nick2.length)
	for (let i = 0; i < len_min_nick; i++) {
		if (nick1[i] == nick2[i]) {
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

function right_nick(nick) {
	let correct_symbols = 1;
	let uncorrect_symbols = 0;
	last_symbol_vow = vow_letter.includes(nick[0])

	for (let i = 1; i < nick.length; i++) {
		if (vow_letter.includes(nick[i])) {
			if (!last_symbol_vow) {
				correct_symbols++;
			} else {
				uncorrect_symbols++;
			}
			last_symbol_vow = true;
			
		} else if (con_letter.includes(nick[i])) {
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

const max_percent_delta = 15
const max_percent_similarity = 5
const max_percent_parts = 10
const max_percent_right_1 = 20
const max_percent_right_2 = 10
const max_percent_random = 45

function check_compatibility (nick1, nick2) {
	nick1 = nick1.toLowerCase()
	nick2 = nick2.toLowerCase()

	let delta_nicks = Math.round((16 - Math.abs(nick2.length - nick1.length)) / 16 * max_percent_delta)

	let similarity_nicks = Math.round(compare_nicks(nick1, nick2) * max_percent_similarity)

	let count_parts = Math.floor((16 - Math.abs(nick1.split(/[@#$&\-+_=]/).length - nick2.split(/[@#$&\-+_=]/).length)) / 16 * max_percent_parts)

	let right_nick1 = right_nick(nick1)
	let right_nick2 = right_nick(nick2)
	let right_nicks =  (1 - Math.abs(right_nick1 - right_nick2)) * max_percent_right_1
	right_nicks += (right_nick1 + right_nick2) / 2 * max_percent_right_2
	right_nicks = Math.ceil(right_nicks)

	let random_percent = Math.round(sum_nicks_charcode(nick1, nick2) / 100 * max_percent_random)

	// console.log(`${delta_nicks}/${max_percent_delta}`, `${similarity_nicks}/${max_percent_similarity}`,
	//  `${right_nicks}/${max_percent_right_1+max_percent_right_2}`, `${count_parts}/${max_percent_parts}`,
	//  `${random_percent}/${max_percent_random}`)

	return (delta_nicks + similarity_nicks + count_parts + right_nicks + random_percent)
}

function combine_nicks(nick1, nick2, mode) {
	if (mode == "random_symbols"){
		let nicks = (nick1 + nick2).toLowerCase();
		let cons = []
		let vows = []
		for (let i = 0; i < nicks.length; i++) {
			let sym = nicks[i]
			if (con_letter.includes(sym.toUpperCase()) && !cons.includes(sym)) {
				cons.push(sym)
				
			} else if (vow_letter.includes(sym.toUpperCase()) && !vows.includes(sym)) {
				vows.push(sym)
			}
			
		}
		if (vows.length == 0) {
			vows = nicks
		}
		if (cons.length == 0) {
			cons = nicks
		}
		return generate_nick(vows, cons)


	} else if (mode == "gen") {
		let significance_symbols = "-+=_~QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnmЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮЁйцукенгшщзхъфывапролджэячсмитьбюё0123456789".split("").sort(() => Math.random() - 0.5)
		let new_nick = "";
		let min_len_nick = Math.min(nick1.length, nick2.length)
		for (let i = 0; i < min_len_nick; i++) {
			let [sym1, sym2] = [nick1[i], nick2[i]]
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

function cmd_processing(sender, args, parameters) {
	try {
		let send_in_private_message = false;
		if (args.length == 0 || args[0] == "help") {
			send_in_private_message = true;
			answ = "Возможные аргументы: [nick1] + [nick2] [=]"
		} else {
			let nick1, nick2;
			if (args[1] == "+") {
				nick1 = args[0]
				nick2 = args[2]
			} else {
				nick1 = args[0]
				nick2 = args[1]
			}
			if (nick1 && nick2) {
				if (args.at(-1) == "=") {
					let new_nick = combine_nicks(nick1, nick2, random_choice(["random_symbols", "gen"]))
					answ = `${nick1} + ${nick2} = ${new_nick}`
				} else {
					let percent_compatibility = check_compatibility(nick1, nick2)
					answ = substitute_text(random_choice(phrases["compatibility"]), {"nick1": nick1, "nick2": nick2, "percent": percent_compatibility})
				}
			
			} else {
				answ = "Вы не ввели два ника, по которым нужно определить совместимость"
				send_in_private_message = true;
			}
		}
		
		return {"type": "answ", "content": {"recipient": sender, "message": answ, "send_in_private_message": send_in_private_message}}
	} catch (error) {
		return {"type": "error", "content": {"date_time": new Date(), "module_name": module_name, "error": error, "args": args}}
	}
}

module.exports = {module_name, cmd_processing, help, structure}