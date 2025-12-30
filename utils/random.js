function random_number (min_num, max_num) {
	return Math.floor(Math.random() * (max_num - min_num + 1)) + min_num;
}


function random_choice(array) {
	return array[Math.floor(Math.random() * array.length)]
}

module.exports = {random_number, random_choice}