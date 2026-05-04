const path = require("path");
const ConfigParser = require('configparser');


class ChatSchema {
  constructor(nickname_reg, message_reg) {
    this.patterns = {
      me_send:  new RegExp(String.raw`^\[${nickname_reg} -> Мне\] ${message_reg}`),
      i_send:   new RegExp(String.raw`^\[Я -> ${nickname_reg}\] ${message_reg}`),

      // [тип] [?] [клан] [звание] ник: сообщение  — клан и звание опциональны
      standard: new RegExp(
        String.raw`^\[([^\]]+)\] ` +           // тип чата
        String.raw`(?:\[[^\]]*\] )?` +          // [?] — один опциональный тег
        String.raw`(?:\[([^\]]+)\] )?` +        // клан (опционально)
        String.raw`(?:\[([^\]]+)\] )?` +        // звание (опционально)
        String.raw`${nickname_reg}: ` +
        String.raw`${message_reg}`
      )
    }

    this.CLAN_CHATS = ["Лк", "Гл"]
    this.KNOWN_CHATS = ["Пати-чат", "Лк", "Гл"]
  }

  parse(raw_message) {
    let m;

    m = raw_message.match(this.patterns.me_send)
    if (m) {return { type_chat: "Приват", sender: m[1], recipient: bot_username,  message: m[2] }}

    m = raw_message.match(this.patterns.i_send)
    if (m) {return { type_chat: "Приват", sender: bot_username,  recipient: m[1], message: m[2] }}

    m = raw_message.match(this.patterns.standard)
    if (m) {
      const type_chat = this.KNOWN_CHATS.includes(m[1]) ? m[1] : "Клан-чат"
      const has_clan  = this.CLAN_CHATS.includes(type_chat)

      return {
        type_chat,
        clan:    has_clan ? (m[2] ?? null) : null,
        rank:    has_clan ? (m[3] ?? null) : null,
        sender:  m[4],
        message: m[5]
      }
    }

    return null
  }

  search(messages, filters) {
    return messages
      .map(raw => ({ raw, parsed: this.parse(raw) }))
      .filter(({ parsed }) =>
        parsed && Object.entries(filters).every(([k, v]) => parsed[k] === v)
      )
  }
}


const config = new ConfigParser();
config.read(path.join(BASE_DIR, "txt", "config.ini"))

const bot_username = config.get("VARIABLES", "active_nick");

const reg_bal_survings = new RegExp(String.raw`^Ваш баланс сурвингов: \$([0-9,]{1,10}\.[0-9]{0,2})`)
const reg_bal_TCA = new RegExp(String.raw`^Баланс баллов TCA: ([0-9]{1,5})`)

const reg_nickname = String.raw`([А-яA-Za-z0-9~!@#$^*\-_=+ёЁ]{1,16})`;
const reg_full_nickname = new RegExp(`^${reg_nickname}$`);
const reg_message = String.raw`(.{1,256})`;
const reg_me_send = new RegExp(`^\\[${reg_nickname} -> Мне\\] ${reg_message}`)
const reg_i_send = new RegExp(`^\\[Я -> ${reg_nickname}\\] ${reg_message}`)

const chatSchema = new ChatSchema(reg_nickname, reg_message)

const reg_spawnmob_help = new RegExp(
    `^    \\n` +
    `Справка:\\n` +
    `Команда: \\/SpawnMob <Кол-во> <Моб>\\[:НД\\] \\[Наездник\\[:НД\\]\\.\\.\\.\\]\\n` +
    `Возможные мобы:\\n` +
    `armor_stand, bat, blaze, boat, cave_spider, chest_minecart, chicken, cow, creeper, donkey, elder_guardian, ender_crystal, ender_dragon, enderman, endermite, evocation_illager, furnace_minecart, ghast, giant, guardian, hopper_minecart, horse, husk, illusion_illager, iron_golem, llama, magma_cube, minecart, mooshroom, mule, ocelot, parrot, pig, polar_bear, rabbit, sheep, shulker, silverfish, skeleton, skeleton_horse, slime, snowman, spider, squid, stray, tnt_minecart, vex, villager, vindication_illager, witch, wither, wither_skeleton, wolf, zombie, zombie_horse, zombie_pigman, zombie_villager\\n` +
    `Узнать возможные НД моба можно командой \\/SpawnMob 1 <Моб>: .+\\n` +  // ← .+ вместо \\s*
    `\\(Поставив пробел между названиями мобов, они будут заспавнены друг на друге\\)$`
);
const reg_spawnmob_region_error = new RegExp(`^Вы можете спавнить мобов только в своём регионе$`)
const reg_spawnmob_rank_error = new RegExp(`^Необходимо иметь звание, как минимум, полковник$`)
const reg_spawnmob_success = new RegExp(`^Вы заспавнили (\\d+) существ.?$`)

const reg_near = new RegExp(`^Окружающие игроки: ((?:(?:${reg_nickname}\\([0-9]{1,4}m\\)(?:, )?)+)|(?:ничего))$`)

const reg_encrypted_ip = String.raw`[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}`;
const reg_lookup = new RegExp(`^ஜ♒♒♒  ${reg_nickname} \\| ${reg_encrypted_ip}  ♒♒♒ஜ\n ` +
"Статус: (.*)\n " +
"Звание: (?:\\[([А-яA-z. ]*)\\].*){0,1}\n" +
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

const reg_vic_prefix = String.raw`\[Викторина\] `
const reg_vic_anagrams = new RegExp("Расшифруйте первым анаграмму (.*) , чтобы выиграть!")
const reg_vic_fast = new RegExp("Напечатайте первым \"(.*)\", чтобы выиграть!")
const reg_vic_example = new RegExp("Решите первым пример (.*), чтобы выиграть!")
const reg_vic_quest = new RegExp("(.*)")

const reg_vic_question = new RegExp("^\\[Викторина\\] Для ответа используйте команду /Answ <Ответ>\n" +
									`(?:(?:${reg_vic_prefix}${reg_vic_anagrams})|(?:${reg_vic_prefix}${reg_vic_fast})|(?:${reg_vic_prefix}${reg_vic_example})|(?:${reg_vic_prefix}${reg_vic_quest}))`)

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
  reg_full_nickname,
	reg_message,
	reg_me_send,
	reg_i_send,

	reg_near,

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
	reg_kick,

  reg_spawnmob_help,
  reg_spawnmob_region_error,
  reg_spawnmob_rank_error,
  reg_spawnmob_success,

	chatSchema
}