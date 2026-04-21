const nums_in_page_def = 5;
const num_page_def = 1;
const begin_text_def = "";
const separator_def = "; "

const COLORS = {
    reset: "\x1b[0m",

    // стили
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    italic: "\x1b[3m",
    underline: "\x1b[4m",

    // обычные цвета
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",

    // яркие цвета
    brightBlack: "\x1b[90m",
    brightRed: "\x1b[91m",
    brightGreen: "\x1b[92m",
    brightYellow: "\x1b[93m",
    brightBlue: "\x1b[94m",
    brightMagenta: "\x1b[95m",
    brightCyan: "\x1b[96m",
    brightWhite: "\x1b[97m",

    // фоны
    bgBlack: "\x1b[40m",
    bgRed: "\x1b[41m",
    bgGreen: "\x1b[42m",
    bgYellow: "\x1b[43m",
    bgBlue: "\x1b[44m",
    bgMagenta: "\x1b[45m",
    bgCyan: "\x1b[46m",
    bgWhite: "\x1b[47m",

    // яркие фоны
    bgBrightBlack: "\x1b[100m",
    bgBrightRed: "\x1b[101m",
    bgBrightGreen: "\x1b[102m",
    bgBrightYellow: "\x1b[103m",
    bgBrightBlue: "\x1b[104m",
    bgBrightMagenta: "\x1b[105m",
    bgBrightCyan: "\x1b[106m",
    bgBrightWhite: "\x1b[107m"
}

function stats_split_into_pages(stat_top, nums_in_page=nums_in_page_def, num_page=num_page_def, begin_text=begin_text_def, separator=separator_def) {
	let answ, is_ok;

	const length_arr = stat_top.length;
	const pages = []

	const index_first_element = nums_in_page * (num_page - 1)
	const index_last_element = index_first_element + (nums_in_page - 1) % (length_arr - index_first_element)
	if (index_first_element > -1 && index_first_element < length_arr) {

		const last_page = Math.ceil(length_arr / nums_in_page)
		
		for (let i = 0; i < length_arr; i += nums_in_page) {
			let ind_top = i
			pages.push(begin_text + stat_top.slice(i, i+nums_in_page).map((elem) => {
				ind_top++
				return `${ind_top}) ${elem.join(": ")}`;
				}).join(separator) + ` [${parseInt(i/nums_in_page) + 1}/${last_page}]`);
		}
		is_ok = true;
		answ = pages[num_page-1]
	} else {
		is_ok = false
		answ = "Такой страницы не существует";

	}
	return {"is_ok": is_ok, "answ": answ, "index_first_element": index_first_element, "index_last_element": index_last_element}
}

function date_to_text(
	date,
	show_seconds=true,
	show_minutes=true
) {
	const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    let date_text = `${year}-${month}-${day} ${hours}`
    if (show_minutes) {
    	date_text += `:${minutes}`
    }
    if (show_seconds) {
    	date_text += `:${seconds}`
    }

	return date_text
}

function substitute_text(pattern, values) {
	return pattern.replace(/\{([^}]+)\}/g, (match, key) => values[key]);
}

module.exports = { stats_split_into_pages, date_to_text, substitute_text, COLORS }