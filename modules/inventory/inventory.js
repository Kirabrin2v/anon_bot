const path = require("path");
const ConfigParser = require('configparser');

const { get_bot } = require(path.join(BASE_DIR, 'init.js'))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const MODULE_NAME = "инвентарь";
const HELP = "Проверка и фильтрация предметов брони по чёрному/белому спискам";
const INTERVAL_CHECK_ACTIONS = 1000;
const STRUCTURE = {
    info: {
        _description: "Информация о механике фильтрации брони"
    }
};

const bot = get_bot();

const CONFIG_PATH = path.join(__dirname, "config.ini");
const config = new ConfigParser();
config.read(CONFIG_PATH);

const ARMOR_SLOTS = {
    5: "helmet",
    6: "chestplate",
    7: "leggings",
    8: "boots"
};

const TRUE_VALUES = ["true", "1", "yes", "on"];


class InventoryModule extends BaseModule {
    constructor () {
        super(MODULE_NAME, HELP, STRUCTURE, INTERVAL_CHECK_ACTIONS)

        this.armor_rules = this.load_armor_rules();

        // Защита от повторной/параллельной обработки одного и того же слота,
        // пока асинхронная операция (перекладывание/выброс) ещё не завершилась.
        this.processing_slots = new Set();

        this.start_events()
    }

    read_bool(section, key, has_section) {
        if (!has_section) { return false; }

        let raw;
        try {
            raw = config.get(section, key);
        } catch (error) {
            console.log(`[инвентарь] Ошибка чтения [${section}].${key}:`, error);
            return false;
        }

        if (raw === null || raw === undefined) { return false; }

        return TRUE_VALUES.includes(String(raw).trim().toLowerCase());
    }

    read_list(section, key, has_section) {
        if (!has_section) { return []; }

        let raw;
        try {
            raw = config.get(section, key);
        } catch (error) {
            console.log(`[инвентарь] Ошибка чтения [${section}].${key}:`, error);
            return [];
        }

        if (raw === null || raw === undefined || raw === "") { return []; }

        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.log(`[инвентарь] Не удалось распарсить JSON в [${section}].${key}: "${raw}"`, error);
            return [];
        }
    }

    /**
     * Читает config.ini и формирует правила для каждого слота брони.
     *
     * Формат идентификатора предмета в whitelist/blacklist:
     *   "minecraft:diamond_helmet"        - любой предмет с этим id
     *   "minecraft:player_head"           - любая голова игрока
     *   "minecraft:player_head@Notch"     - голова конкретно игрока Notch
     *                                        (регистр ника не важен)
     */
    load_armor_rules() {
        const rules = {};

        const sections = typeof config.sections === "function" ? config.sections() : [];

        if (!sections.length) {
            console.log(`[инвентарь] ВНИМАНИЕ: config.ini не прочитан или пуст (путь: ${CONFIG_PATH}). Все списки будут отключены и пусты!`);
        }

        for (const slot_name of Object.values(ARMOR_SLOTS)) {
            const section = slot_name;
            const has_section = typeof config.hasSection === "function"
                ? config.hasSection(section)
                : sections.includes(section);

            if (!has_section) {
                console.log(`[инвентарь] Секция [${section}] не найдена в config.ini.`);
            }

            const whitelist_raw = this.read_list(section, "whitelist", has_section);
            const blacklist_raw = this.read_list(section, "blacklist", has_section);

            rules[slot_name] = {
                whitelist_enabled: this.read_bool(section, "whitelist_enabled", has_section),
                blacklist_enabled: this.read_bool(section, "blacklist_enabled", has_section),
                whitelist: whitelist_raw.map((raw) => this.parse_identifier(raw)),
                blacklist: blacklist_raw.map((raw) => this.parse_identifier(raw))
            };

            console.log(`[инвентарь] Правила для [${section}]:`, rules[slot_name]);
        }

        return rules;
    }

    /**
     * Разбирает строку идентификатора из конфига на id предмета и владельца
     * (владелец имеет смысл только для голов игроков).
     *
     * "minecraft:player_head@Notch" -> { id: "minecraft:player_head", owner: "notch" }
     * "minecraft:diamond_helmet"    -> { id: "minecraft:diamond_helmet", owner: null }
     */
    parse_identifier(raw) {
        const [id, owner] = String(raw).split("@");
        return {
            id: id.trim().toLowerCase(),
            owner: owner ? owner.trim().toLowerCase() : null
        };
    }

    /**
     * Определяет, является ли предмет головой игрока.
     *
     * В новом протоколе (>=1.13) это отдельный предмет "player_head".
     * В старом протоколе (<=1.12.2) ВСЕ черепа имеют один и тот же id
     * "skull" (числовой id 397), а конкретный тип черепа (скелет, зомби,
     * игрок, крипер, дракон) кодируется через item.metadata:
     *   0 - скелет, 1 - иссохший скелет, 2 - зомби, 3 - игрок, 4 - крипер,
     *   5 - дракон.
     * Именно поэтому раньше get_item_id() всегда возвращал "minecraft:skull"
     * для ЛЮБОЙ головы, и сравнение с "minecraft:player_head" из конфига
     * никогда не проходило - до сверки ника дело даже не доходило.
     */
    is_player_head(item) {
        if (!item) { return false; }
        const name = String(item.name).toLowerCase();

        if (name === "player_head") { return true; }
        if (name !== "skull") { return false; }

        if (item.metadata === 3) { return true; }

        // Подстраховка на случай, если metadata недоступна/имеет другой
        // формат в конкретной версии - проверяем наличие владельца в NBT.
        return this.get_skull_owner(item) !== null;
    }

    /**
     * Возвращает нормализованный id предмета в формате "minecraft:item_name".
     * Головы игроков всегда нормализуются к "minecraft:player_head",
     * независимо от того, как предмет называется в конкретной версии
     * протокола (см. is_player_head).
     */
    get_item_id(item) {
        if (!item) { return null; }
        if (this.is_player_head(item)) { return "minecraft:player_head"; }
        if (item.name.includes(":")) { return item.name.toLowerCase(); }
        return `minecraft:${item.name}`.toLowerCase();
    }

    /**
     * Достаёт владельца головы игрока из NBT предмета, если это голова.
     * Поддерживает несколько известных вариантов структуры NBT/компонентов
     * в разных версиях протокола.
     */
    get_skull_owner(item) {
        if (!item || !item.nbt) { return null; }

        try {
            const value = item.nbt.value;
            const skull_owner = value?.SkullOwner?.value;

            // Головы, выданные кастомным плагином (например, "магазин голов"):
            // SkullOwner.Name у них - служебное значение вроде "$TCS", одинаковое
            // у всех таких голов, а РЕАЛЬНЫЙ ник владельца записан отдельно
            // в SkullOwner.Properties.tcu[0].Value (совпадает с ником в
            // display.Name предмета). Проверяем это в первую очередь.
            const custom_owner = skull_owner?.Properties?.value?.tcu?.value?.value?.[0]?.Value?.value;
            if (custom_owner) { return String(custom_owner).toLowerCase(); }

            // Старый формат (<=1.20.4): tag.SkullOwner.Name
            // Служебные значения вида "$TCS" (начинаются с "$") пропускаем -
            // это маркер плагина, а не настоящий ник.
            const legacy_name = skull_owner?.Name?.value;
            if (legacy_name && !String(legacy_name).startsWith("$")) {
                return String(legacy_name).toLowerCase();
            }

            // Вариант с полем в нижнем регистре
            const legacy_name_lower = skull_owner?.name?.value;
            if (legacy_name_lower && !String(legacy_name_lower).startsWith("$")) {
                return String(legacy_name_lower).toLowerCase();
            }

            // Компонентный формат (>=1.20.5): profile.name
            const profile_name = value?.profile?.value?.name?.value;
            if (profile_name && !String(profile_name).startsWith("$")) {
                return String(profile_name).toLowerCase();
            }
        } catch (error) {
            return null;
        }

        return null;
    }

    /**
     * Проверяет, соответствует ли предмет конкретной записи из
     * белого/чёрного списка.
     */
    matches_identifier(item, identifier) {
        const item_id = this.get_item_id(item);
        if (item_id !== identifier.id) { return false; }

        if (identifier.owner) {
            const owner = this.get_skull_owner(item);
            return owner === identifier.owner;
        }

        return true;
    }

    /**
     * Определяет, разрешён ли предмет в данном слоте брони согласно конфигу.
     * Чёрный список имеет приоритет над белым.
     */
    is_item_allowed(item, slot_name) {
        const rules = this.armor_rules[slot_name];
        if (!rules) { return true; }

        if (rules.blacklist_enabled) {
            const is_blacklisted = rules.blacklist.some((identifier) => this.matches_identifier(item, identifier));
            if (is_blacklisted) { return false; }
        }

        if (rules.whitelist_enabled) {
            const is_whitelisted = rules.whitelist.some((identifier) => this.matches_identifier(item, identifier));
            if (!is_whitelisted) { return false; }
        }

        return true;
    }

    /**
     * Ищет первый свободный слот в основном инвентаре (включая хотбар).
     */
    find_empty_inventory_slot() {
        const start = bot.inventory.inventoryStart ?? 9;
        const end = bot.inventory.inventoryEnd ?? 44;

        for (let slot = start; slot <= end; slot++) {
            if (!bot.inventory.slots[slot]) {
                return slot;
            }
        }

        return null;
    }

    /**
     * Перекладывает предмет из слота брони в инвентарь, а если свободных
     * слотов нет - выбрасывает его.
     */
    async handle_disallowed_item(armor_slot, item, slot_name) {
        if (this.processing_slots.has(armor_slot)) { return; }
        this.processing_slots.add(armor_slot);

        try {
            const free_slot = this.find_empty_inventory_slot();

            if (free_slot !== null) {
                await bot.moveSlotItem(armor_slot, free_slot);
                console.log(`[инвентарь] "${this.get_item_id(item)}" убран из слота "${slot_name}" в инвентарь (не прошёл проверку).`);
            } else {
                // mode 4, button 1 - протокольный дроп всего стака из слота
                await bot.clickWindow(armor_slot, 1, 4);
                console.log(`[инвентарь] "${this.get_item_id(item)}" выброшен из слота "${slot_name}" (не прошёл проверку, инвентарь полон).`);
            }
        } catch (error) {
            console.log(error);
        } finally {
            this.processing_slots.delete(armor_slot);
        }
    }

    /**
     * Проверяет всю уже надетую броню. Нужно, потому что событие
     * "updateSlot" срабатывает только на ИЗМЕНЕНИЕ слота - если запрещённый
     * предмет уже был надет на момент коннекта/респауна, updateSlot для него
     * никогда не произойдёт, и он никогда не будет проверен.
     */
    check_all_armor() {
        if (!bot.inventory) { return; }

        for (const [slot_str, slot_name] of Object.entries(ARMOR_SLOTS)) {
            const slot = Number(slot_str);
            const item = bot.inventory.slots[slot];
            if (!item) { continue; }

            if (!this.is_item_allowed(item, slot_name)) {
                this.handle_disallowed_item(slot, item, slot_name);
            }
        }
    }

    start_events() {
        // bot.inventory появляется только после того, как бот законнектился
        // и получил окно инвентаря (событие 'spawn'). На момент загрузки
        // модулей его может ещё не быть, поэтому подписываемся отложенно.
        const attach_listener = () => {
            console.log("Начинаю слушать инвентарь")
            if (!bot.inventory) { return; }

            bot.inventory.on("updateSlot", (slot, old_item, new_item) => {
                try {
                    const slot_name = ARMOR_SLOTS[slot];
                    if (!slot_name) { return; }
                    if (!new_item) { return; }

                    if (!this.is_item_allowed(new_item, slot_name)) {
                        this.handle_disallowed_item(slot, new_item, slot_name);
                    }
                } catch (error) {
                    console.log(error);
                }
            });
        };

        const init = () => {
            attach_listener();
            this.check_all_armor();
        };

        if (bot.inventory) {
            init();
        } else {
            bot.once("spawn", init);
        }

        // Дополнительно проверяем броню после каждого респауна (смерть и
        // т.п.) - сервер может выдать/восстановить броню в обход updateSlot.
        bot.on("spawn", () => this.check_all_armor());
    }

    _process(sender, args) {
        let answ;

        if (args[0]?.name === "info") {
            answ = "Каждый слот брони (шлем, нагрудник, поножи, ботинки) имеет свой набор из чёрного и белого списков в config.ini. " +
                "Чёрный список запрещает предмет всегда, белый (если включён) - разрешает только перечисленные предметы. " +
                "Предметы, не прошедшие проверку, перекладываются в инвентарь, а если он полон - выбрасываются.";
        }

        if (answ) {
            return answ;
        }
    }
}

module.exports = InventoryModule