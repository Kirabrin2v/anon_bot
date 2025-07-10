const module_name = "text"

const nums_in_page_def = 5;
const num_page_def = 1;
const begin_text_def = "";
const separator_def = "; "

function stats_split_into_pages(stat_top, nums_in_page=nums_in_page_def, num_page=num_page_def, begin_text=begin_text_def, separator=separator_def) {
	let answ, is_ok;

	let length_arr = stat_top.length;
	let pages = []

	let index_first_element = nums_in_page * (num_page - 1)
	let index_last_element = index_first_element + (nums_in_page - 1) % (length_arr - index_first_element)
	if (index_first_element > -1 && index_first_element < length_arr) {

		let last_page = Math.ceil(length_arr / nums_in_page)
		
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

function date_to_text(date) {
	const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

module.exports = {module_name, stats_split_into_pages, date_to_text}