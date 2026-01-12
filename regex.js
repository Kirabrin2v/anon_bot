const reg_bal_survings = new RegExp(String.raw`^Ваш баланс сурвингов: \$([0-9,]{1,10}\.[0-9]{0,2})`)
const reg_bal_TCA = new RegExp(String.raw`^Баланс баллов TCA: ([0-9]{1,5})`)

const reg_nickname = String.raw`([А-яA-Za-z0-9~!@#$^*\-_=+ёЁ]{1,16})`;
const reg_message = String.raw`(.{1,256})`;
const reg_me_send = new RegExp(`^\\[${reg_nickname} -> Мне\\] ${reg_message}`)
const reg_i_send = new RegExp(`^\\[Я -> ${reg_nickname}\\] ${reg_message}`)

const reg_encrypted_ip = String.raw`[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}`;
const reg_lookup = new RegExp(`^ஜ♒♒♒  ${reg_nickname} \\| ${reg_encrypted_ip}  ♒♒♒ஜ\n ` +
"Статус: (.*)\n " +
"Звание: (?:\\[([А-яA-z\. ]*)\\].*){0,1}\n" +
"(?: Клан:   (.*)\n){0,1}\n " +
"Забанен:   (.*)\n " +
"Имеет мут: (.*)\n\n " +
"Регистрация: (.*) \\(Мск\\)\n " +
"Был в сети:  (.*) \\(Мск\\)\n" +
"(?: Местонахождение: (.*)\n){0,1} " +
"История: ([0-9]{1,4}) бан.*\n         " +
"([0-9]{1,4}) кик.*\n         " +
"([0-9]{1,4}) мут.*\n         " +
"([0-9]{1,4}) варн.*\n" +
"(?: Последние предупреждения:\n(?:  (.*)\n){0,1}" +
"(?:  (.*)\n){0,1}" +
"(?:  (.*)\n){0,1}){0,1}" +
`ஜ♒♒♒  ${reg_nickname} \\| ${reg_encrypted_ip}  ♒♒♒ஜ`)

const reg_vic_anagrams = String.raw`\[Викторина\] Расшифруйте первым анаграмму (.*) , чтобы выиграть!`
const reg_vic_fast = String.raw`\[Викторина\] Напечатайте первым "(.*)", чтобы выиграть!`
const reg_vic_example = String.raw`\[Викторина\] Решите первым пример (.*), чтобы выиграть!`
const reg_vic_quest = String.raw`\[Викторина\] (.*)`

const reg_vic_question = new RegExp("^\\[Викторина\\] Для ответа используйте команду /Answ <Ответ>\n" +
									`(?:(?:${reg_vic_anagrams})|(?:${reg_vic_fast})|(?:${reg_vic_example})|(?:${reg_vic_quest}))`)

const reg_vic_answ = new RegExp("^[Викторина] Для ответа используйте команду /Answ <Ответ>\n" +
								"[Викторина] Время для ответа закончилось. Правильный ответ: (.*)")

const reg_tryme_info = new RegExp("^\\*{61}\n" + 
String.raw`Всего вопросов: [0-9]*\n` +
String.raw`Ответов: (True|False)\n` +
String.raw`Категория: (Custom|Easy|Normal|Medium|Hard|Default)\n` +
String.raw`Прошло времени до ответа: ([0-9]{1,3}\.[0-9]{1,2}) sec\n` +
String.raw`До следущего вопроса: [0-9]{1,3}\.[0-9]{1,2} sec\n` +
String.raw`Номер вопроса: ([0-9]|none)\n` +
String.raw`Вопрос: (.*)\n` +
"\\*{61}")

const reg_seen = new RegExp(`^${reg_nickname} (Онлайн|Офлайн) в течение ((?:(?:[0-9]* дн\\. )?[0-9]{2}:[0-9]{2}(?::[0-9]{2})?)|(?:[0-9]{1,2} с))\\n` + 
	`Сервер (.*)\\. Координаты: Мир [^ ,.]*, (\\-?[0-9]+), (\\-?[0-9]+), (\\-?[0-9]+)`)

const reg_survings_send = new RegExp(`^\\$([0-9,]*\\.[0-9]*) отправлено игроку ${reg_nickname}`)
const reg_TCA_send = new RegExp(`^Вы перевели ([0-9]*) балл(?:а||ов){1,2} TCA игроку ${reg_nickname}`)

const reg_log_line = String.raw`\- ([0-9]{2}\.[0-9]{2}\.[0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}) (\+|\-)([0-9]{1,5}) TCA \(([0-9]{1,5}) TCA\) Передача баллов (?:от игрока|игроку) ${reg_nickname}`
const reg_tca_accept = new RegExp(`^Лог последних операций с баллами TCA:\n` +
								(reg_log_line + "\n").repeat(15).slice(0, -1)
								)

const reg_survings_accept = new RegExp(`^${reg_nickname} отправил Вам \\$([0-9,]*\\.[0-9]*)\n` +
										"Причина: (.*)")

const reg_warn = new RegExp(`^${reg_nickname} был предупреждён блюстителем ${reg_nickname}\\.\nПричина: (.*)`)
const reg_ban = new RegExp(`^${reg_nickname} был забанен на (.*) блюстителем ${reg_nickname}\\.\nПричина: (.*)`)
const reg_mute = new RegExp(`^Выдан временный мут игроку ${reg_nickname} на (.*) блюстителем ${reg_nickname}\\.\nПричина: (.*)`)
const reg_kick = new RegExp(`^${reg_nickname} был кикнут с сервера блюстителем ${reg_nickname}\\.\nПричина: (.*)`)


module.exports = {
	reg_bal_survings,
	reg_bal_TCA,

	reg_nickname,
	reg_message,
	reg_me_send,
	reg_i_send,

	reg_encrypted_ip,
	reg_lookup,

	reg_vic_anagrams,
	reg_vic_fast,
	reg_vic_example,
	reg_vic_quest,
	reg_vic_question,
	reg_vic_answ,
	reg_tryme_info,
	
	reg_seen,

	reg_survings_send,
	reg_TCA_send,
	reg_log_line,
	reg_tca_accept,
	reg_survings_accept,

	reg_warn,
	reg_ban,
	reg_mute,
	reg_kick
}