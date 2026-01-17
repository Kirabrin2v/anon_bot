const ConfigParser = require('configparser');
const path = require("path");
const sqlite = require("better-sqlite3");

const text = require(path.join(__dirname,  '../text/text.js'))
const { random_choice } = require(path.join(BASE_DIR, 'utils', 'random.js'))

const module_name = "снежки";
const help = "Награда за пуляние снежков";

const structure = {
    balance: {
        _description: "Количество денег, заработанных за брошенные в игроков снежки"
    },
    stats: {
        _description: "Статистика попаданий"
    },
    list: {
        _description: "Последние попадания"
    },
    get: {
        _description: "Вывести все доступные деньги"
    },
    info: {
        _description: "Информация о механике"
    }
};

const db = new sqlite(
    path.join(__dirname, "snowballs.db")
);

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

var phrases = {};
phrases["auto_send_reward"] = JSON.parse(config.get("phrases", "auto_send_reward"))

let actions = [];

// ------------------- ИГРОКИ ----------------------------
function create_user_balance(nick, starting_balance = 0) {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO user_balance (nick, balance)
        VALUES (?, ?)
    `);
    stmt.run([nick, starting_balance]);
}

function delete_user_balance(nick) {
    const stmt = db.prepare(`
        DELETE FROM user_balance
        WHERE nick = ?
    `);
    stmt.run([nick]);
}

function ensure_user_balance(nick) {
    db.prepare(`
        INSERT OR IGNORE INTO user_balance (nick, balance)
        VALUES (?, 0)
    `).run(nick);
}

function add_balance(nick, amount) {
    ensure_user_balance(nick);

    const stmt = db.prepare(`
        UPDATE user_balance
        SET balance = balance + ?
        WHERE nick = ?
    `);
    stmt.run([amount, nick]);
}

function subtract_balance(nick, amount) {
    ensure_user_balance(nick);

    const stmt = db.prepare(`
        UPDATE user_balance
        SET balance = balance - ?
        WHERE nick = ?
    `);
    stmt.run([amount, nick]);
}

function get_balance(nick) {
    ensure_user_balance(nick);

    const row = db.prepare(`
        SELECT balance
        FROM user_balance
        WHERE nick = ?
    `).get(nick);
    return row?.balance ?? 0;
}

// ------------------- СНЕЖКИ ----------------------------
function add_hit(shooter, target, distance, position = null) {

    const insert = db.prepare(`
        INSERT INTO snowball_hits
        (shooter, target, distance, x, y, z, date_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run([
        shooter,
        target,
        distance,
        position?.x ?? null,
        position?.y ?? null,
        position?.z ?? null,
        Date.now()
    ]);
}

function get_hits({
    shooter,
    target,
    from_date,
    to_date,
    limit = 100
} = {}) {
    let conditions = [];
    let params = [];

    if (shooter) {
        conditions.push("shooter = ?");
        params.push(shooter);
    }
    if (target) {
        conditions.push("target = ?");
        params.push(target);
    }
    if (from_date) {
        conditions.push("date_time >= ?");
        params.push(from_date);
    }
    if (to_date) {
        conditions.push("date_time <= ?");
        params.push(to_date);
    }

    const where = conditions.length
        ? "WHERE " + conditions.join(" AND ")
        : "";

    const query = `
        SELECT shooter, target, distance, x, y, z, date_time
        FROM snowball_hits
        ${where}
        ORDER BY date_time DESC
        LIMIT ?
    `;

    return db.prepare(query).all([...params, limit]);
}

function get_hits_count(shooter, target) {
    const row = db.prepare(`
        SELECT COUNT(*) as cnt
        FROM snowball_hits
        WHERE shooter = ?
        AND target = ?
    `).get([shooter, target]);

    return row.cnt;
}

function get_player_stats(nick) {
    return {
        hits_done: db.prepare(`
            SELECT COUNT(*) as cnt
            FROM snowball_hits
            WHERE shooter = ?
        `).get(nick).cnt,

        hits_taken: db.prepare(`
            SELECT COUNT(*) as cnt
            FROM snowball_hits
            WHERE target = ?
        `).get([nick]).cnt
    };
}

function get_top_targets(shooter, limit = 5) {
    return db.prepare(`
        SELECT target, COUNT(*) as hits
        FROM snowball_hits
        WHERE shooter = ?
        GROUP BY target
        ORDER BY hits DESC
        LIMIT ?
    `).all([shooter, limit]);
}

function estimateSnowballStartPos(entity) {
    const pos = entity.position;
    const vel = entity.velocity ?? new Vec3(0, 0, 0);

    const dt = 0.05;

    return pos.minus(vel.scaled(dt));
}


const SNOWBALL_REWARD_CONFIG = {
    base_reward: 1,          // Базовая награда за попадание

    // Количество попаданий
    hits: {
        min_multiplier: 0.01,
        max_multiplier: 100.0,
        softness: 1.5      // "Мягкость" убывания (чем больше, тем медленнее падает)
    },

    // Расстояние
    distance: {
        max_distance: 40,
        multiplier: 1.5
    },

    // Скорость цели
    velocity: {
        max_speed: 0.8,
        multiplier: 1.3
    }
};

function calculate_snowball_reward({
    hits_count,
    distance,
    target_velocity,
}) {
    // МНОЖИТЕЛЬ ПО КОЛИЧЕСТВУ ПОПАДАНИЙ
    const hitsMultiplier = Math.max(
        SNOWBALL_REWARD_CONFIG.hits.min_multiplier,
        Math.min(
            SNOWBALL_REWARD_CONFIG.hits.max_multiplier,
            SNOWBALL_REWARD_CONFIG.hits.max_multiplier / Math.pow(hits_count + 1, 1 / SNOWBALL_REWARD_CONFIG.hits.softness)
        )
    );

    // МНОЖИТЕЛЬ ПО ДИСТАНЦИИ
    const clampedDistance = Math.min(distance, SNOWBALL_REWARD_CONFIG.distance.max_distance);
    const distanceFactor = clampedDistance / SNOWBALL_REWARD_CONFIG.distance.max_distance;
    const distanceMultiplier = 1 + distanceFactor * SNOWBALL_REWARD_CONFIG.distance.multiplier;

    // МНОЖИТЕЛЬ ПО СКОРОСТИ ЦЕЛИ
    let speed;
    if (typeof target_velocity === "number") {
        speed = target_velocity;
    } else {
        // Vec3
        speed = Math.sqrt(
            target_velocity.x ** 2 +
            target_velocity.y ** 2 +
            target_velocity.z ** 2
        );
    }

    const clampedSpeed = Math.min(speed, SNOWBALL_REWARD_CONFIG.velocity.max_speed);
    const speedFactor = clampedSpeed / SNOWBALL_REWARD_CONFIG.velocity.max_speed;
    const velocityMultiplier = 1 + speedFactor * SNOWBALL_REWARD_CONFIG.velocity.multiplier;

    // ОБЩЕЕ
    const reward =
        SNOWBALL_REWARD_CONFIG.base_reward *
        hitsMultiplier *
        distanceMultiplier *
        velocityMultiplier;

    return Math.round(reward);
}

function send_reward(nick, amount, phrase) {
    subtract_balance(nick, amount)

    if (!phrase) {
        phrase = random_choice(phrases["auto_send_reward"])
    }
    console.log(`Игрок ${nick} получил ${amount}$ с причиной: ${phrase}`)
    actions.push({
        "type": "survings",
        "content":{
            "nick": nick,
            "amount": amount,
            "reason": phrase
        }
    })
}

const snowballs = new Map()

var bot;
function initialize(constants) {
    console.log("Инициализация")
    bot = constants.bot

    const { get_players_and_distance }  = require(
        path.join(BASE_DIR, "./utils/entities.js")
    )

    bot.on('entitySpawn', (entity) => {
        try {
            if (entity.name === "snowball") {

                const startPointPos = estimateSnowballStartPos(entity);

                const shooter_and_dist = get_players_and_distance(
                    bot,
                    start_point = startPointPos,
                    max_distance = 2.0,
                    ignore_bot = true
                )[0];
                let shooter;
                if (shooter_and_dist) {
                    shooter = shooter_and_dist[0]
                } else {
                    return;
                }

                snowballs.set(entity.id, {
                    entity,
                    startPointPos,
                    lastServerPos: entity.position.clone(),
                    velocity: entity.velocity?.clone() ?? new Vec3(0, 0, 0),
                    lastUpdate: Date.now(),
                    predictedPos: entity.position.clone(),
                    shooter
                });
            }
        } catch (error) {
            console.log(error);
        }
    });

    bot.on('entityGone', (e) => {
        try {
            const data = snowballs.get(e.id)
            if (!data) return

            // сколько тиков прошло с последнего пакета
            const ticks = Math.min(
                Math.round((Date.now() - data.lastUpdate) / 50),
                20
            )

            let pos = data.lastPos.clone()
            let vel = data.velocity.clone()

            for (let i = 0; i < ticks; i++) {
                // физика снежка
                vel.y -= 0.03
                vel = vel.scaled(0.99)
                pos = pos.plus(vel)
            }

            const near_player = get_players_and_distance(bot, start_point=pos, max_distance=2, ignore_bot=false)[0]

            var target_player;
            if (near_player) {
                const target_nick = near_player[0]
                target_player = bot.players[target_nick]

                const distance = data.startPointPos.distanceTo(pos)
                const delta_position = pos.minus(data.startPointPos)

                const hits_count = get_hits_count(data.shooter, target_nick)
                const reward = calculate_snowball_reward({
                    hits_count,        // сколько раз shooter уже попадал в target
                    distance,          // фактическая дистанция попадания
                    target_velocity: target_player.entity.velocity,   // Vec3 или число (скорость)
                })
                console.log("Награда:", reward)
                add_balance(data.shooter, reward)

                const balance = get_balance(data.shooter)
                if (balance >= 1000) {
                    send_reward(data.shooter, balance)
                }

                // console.log('Снежок исчез около:', pos, 'Попадение в игрока:', target_player.username, "Игроком:", data.shooter, 'Расстояние:', distance, pos, data.startPointPos)
                add_hit(data.shooter, target_nick, distance, delta_position)
            }

            snowballs.delete(e.id)
        } catch (error) {
            console.log(error)
        }
    })

    bot.on('entityMoved', (entity) => {
        const data = snowballs.get(entity.id)
        if (!data) return


        data.lastPos = entity.position.clone()
        data.velocity = entity.velocity.clone()
        data.lastUpdate = Date.now()
    })
}

function cmd_processing(sender, args) {
    try {
        let answ;

        if (args[0] === "stats") {
            const stats = get_player_stats(sender)
            answ = `Снежков, достигшних цели: ${stats.hits_done}. Пойманных снежков: ${stats.hits_taken}`

        } else if (args[0] === "list") {
            let num_page = 1;
            if (args[1]) {
                num_page = Number(args[1])
            }

            const hits = get_hits({ limit: 50 });

            const hits_text = hits.map(h => {
                return [`${h.shooter} → ${h.target}`, `${h.distance.toFixed(1)}м`]
            })
            const split_into_pages = text.stats_split_into_pages(hits_text, 5, num_page, "Последние попадания: ")

            answ = split_into_pages["answ"]
        
        } else if (args[0] == "balance") {
            const balance = get_balance(sender)
            answ = `Ваш баланс: ${balance}$`
        
        } else if (args[0] == "get") {
            const balance = get_balance(sender)
            if (balance >= 100) {
                send_reward(sender, balance, "Ваша награда")
            } else {
                answ = `Вывод средств доступен от 100$. У Вас есть только ${balance}`
            }

        } else if (args[0] == "info") {
            answ = "За каждое попадание снежком в игрока пополняется внутренний баланс. От 1000$ автоматически выводится. Если пулять в новых игроков, платится больше."
        }
        if (answ) {
            actions.push({
                type: "answ",
                content: {
                    recipient: sender,
                    message: answ,
                    send_in_private_message: true
                }
            });
        }

    } catch (error) {
        actions.push({
            type: "error",
            content: {
                date_time: new Date(),
                module_name,
                error,
                args
            }
        });
    }
}



function get_actions() {
    return actions.splice(0);
}

module.exports = {
    module_name,
    cmd_processing,
    get_actions,
    help,
    structure,
    initialize,

    add_hit,
    get_hits,
    get_hits_count,
    get_player_stats,
    get_top_targets,

    create_user_balance,
    delete_user_balance,
    add_balance,
    subtract_balance,
    get_balance
    };

