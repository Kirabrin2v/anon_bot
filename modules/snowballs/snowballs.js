const ConfigParser = require('configparser');
const path = require("path");
const sqlite = require("better-sqlite3");
const Vec3 = require("vec3");

const { get_bot } = require(path.join(BASE_DIR, 'init.js'))
const { stats_split_into_pages } = require(path.join(BASE_DIR, "utils", "text.js"))
const { random_choice } = require(path.join(BASE_DIR, 'utils', 'random.js'))
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const MODULE_NAME = "снежки";
const HELP = "Награда за пуляние снежков";
const INTERVAL_CHECK_ACTIONS = 1000;
const STRUCTURE = {
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
const bot = get_bot()

const db = new sqlite(
    path.join(__dirname, "snowballs.db")
);

const config = new ConfigParser();
config.read(path.join(__dirname, "config.ini"))

const phrases = {};
phrases["auto_send_reward"] = JSON.parse(config.get("phrases", "auto_send_reward"))


class SnowballsModule extends BaseModule {
    constructor () {
        super(MODULE_NAME, HELP, STRUCTURE, INTERVAL_CHECK_ACTIONS)

        this.SNOWBALL_REWARD_CONFIG = {
            base_reward: 1,

            hits: {
                min_multiplier: 0.01,
                max_multiplier: 100.0,
                softness: 1.5
            },

            distance: {
                max_distance: 40,
                multiplier: 1.5
            },

            velocity: {
                max_speed: 0.8,
                multiplier: 1.3
            }
        };
        this.snowballs = new Map()
        this.start_events()
    }

    create_user_balance(nick, starting_balance = 0) {
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO user_balance (nick, balance)
            VALUES (?, ?)
        `);
        stmt.run([nick, starting_balance]);
    }

    delete_user_balance(nick) {
        const stmt = db.prepare(`
            DELETE FROM user_balance
            WHERE nick = ?
        `);
        stmt.run([nick]);
    }

    ensure_user_balance(nick) {
        db.prepare(`
            INSERT OR IGNORE INTO user_balance (nick, balance)
            VALUES (?, 0)
        `).run(nick);
    }

    add_balance(nick, amount) {
        this.ensure_user_balance(nick);

        const stmt = db.prepare(`
            UPDATE user_balance
            SET balance = balance + ?
            WHERE nick = ?
        `);
        stmt.run([amount, nick]);
    }

    subtract_balance(nick, amount) {
        this.ensure_user_balance(nick);

        const stmt = db.prepare(`
            UPDATE user_balance
            SET balance = balance - ?
            WHERE nick = ?
        `);
        stmt.run([amount, nick]);
    }

    get_balance(nick) {
        this.ensure_user_balance(nick);

        const row = db.prepare(`
            SELECT balance
            FROM user_balance
            WHERE nick = ?
        `).get(nick);
        return row?.balance ?? 0;
    }

    add_hit(shooter, target, distance, position = null) {
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

    get_hits({
        shooter,
        target,
        from_date,
        to_date,
        limit = 100
    } = {}) {
        const conditions = [];
        const params = [];

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

    get_hits_count(shooter, target) {
        const row = db.prepare(`
            SELECT COUNT(*) as cnt
            FROM snowball_hits
            WHERE shooter = ?
            AND target = ?
        `).get([shooter, target]);

        return row.cnt;
    }

    get_player_stats(nick) {
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

    get_top_targets(shooter, limit = 5) {
        return db.prepare(`
            SELECT target, COUNT(*) as hits
            FROM snowball_hits
            WHERE shooter = ?
            GROUP BY target
            ORDER BY hits DESC
            LIMIT ?
        `).all([shooter, limit]);
    }

    estimateSnowballStartPos(entity) {
        const pos = entity.position;
        const vel = entity.velocity ?? new Vec3(0, 0, 0);

        const dt = 0.05;

        return pos.minus(vel.scaled(dt));
    }

    calculate_snowball_reward({
        hits_count,
        distance,
        target_velocity,
    }) {
        const hitsMultiplier = Math.max(
            this.SNOWBALL_REWARD_CONFIG.hits.min_multiplier,
            Math.min(
                this.SNOWBALL_REWARD_CONFIG.hits.max_multiplier,
                this.SNOWBALL_REWARD_CONFIG.hits.max_multiplier / Math.pow(hits_count + 1, 1 / this.SNOWBALL_REWARD_CONFIG.hits.softness)
            )
        );

        const clampedDistance = Math.min(distance, this.SNOWBALL_REWARD_CONFIG.distance.max_distance);
        const distanceFactor = clampedDistance / this.SNOWBALL_REWARD_CONFIG.distance.max_distance;
        const distanceMultiplier = 1 + distanceFactor * this.SNOWBALL_REWARD_CONFIG.distance.multiplier;

        let speed;
        if (typeof target_velocity === "number") {
            speed = target_velocity;
        } else {
            speed = Math.sqrt(
                target_velocity.x ** 2 +
                target_velocity.y ** 2 +
                target_velocity.z ** 2
            );
        }

        const clampedSpeed = Math.min(speed, this.SNOWBALL_REWARD_CONFIG.velocity.max_speed);
        const speedFactor = clampedSpeed / this.SNOWBALL_REWARD_CONFIG.velocity.max_speed;
        const velocityMultiplier = 1 + speedFactor * this.SNOWBALL_REWARD_CONFIG.velocity.multiplier;

        const reward =
            this.SNOWBALL_REWARD_CONFIG.base_reward *
            hitsMultiplier *
            distanceMultiplier *
            velocityMultiplier;

        return Math.round(reward);
    }

    send_reward(nick, amount, phrase) {
        this.subtract_balance(nick, amount)

        if (!phrase) {
            phrase = random_choice(phrases["auto_send_reward"])
        }
        console.log(`Игрок ${nick} получил ${amount}$ с причиной: ${phrase}`)
        this.actions.push({
            type: "survings",
            content:{
                nick: nick,
                amount: amount,
                reason: phrase
            }
        })
    }

    start_events() {
        bot.on('entitySpawn', (entity) => {
            try {
                if (entity.name === "snowball") {

                    const startPointPos = this.estimateSnowballStartPos(entity);

                    const shooter_and_dist = this.ModuleManager.call_module("entities").get_players_and_distance(
                        bot,
                        startPointPos,
                        2.0,
                        true
                    )[0];

                    let shooter;
                    if (shooter_and_dist) {
                        shooter = shooter_and_dist[0]
                    } else {
                        return;
                    }

                    this.snowballs.set(entity.id, {
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
                const data = this.snowballs.get(e.id)
                if (!data) {return}

                const ticks = Math.min(
                    Math.round((Date.now() - data.lastUpdate) / 50),
                    20
                )

                let pos = data.lastPos.clone()
                let vel = data.velocity.clone()

                for (let i = 0; i < ticks; i++) {
                    vel.y -= 0.03
                    vel = vel.scaled(0.99)
                    pos = pos.plus(vel)
                }

                const near_player = this.ModuleManager.call_module("entities").get_players_and_distance(bot, pos, 2, false)[0]

                let target_player;
                if (near_player) {
                    const target_nick = near_player[0]
                    target_player = bot.players[target_nick]

                    const distance = data.startPointPos.distanceTo(pos)
                    const delta_position = pos.minus(data.startPointPos)

                    const hits_count = this.get_hits_count(data.shooter, target_nick)
                    const reward = this.calculate_snowball_reward({
                        hits_count,
                        distance,
                        target_velocity: target_player.entity.velocity,
                    })

                    this.add_balance(data.shooter, reward)

                    const balance = this.get_balance(data.shooter)
                    if (balance >= 1000) {
                        this.send_reward(data.shooter, balance)
                    }

                    this.add_hit(data.shooter, target_nick, distance, delta_position)
                }

                this.snowballs.delete(e.id)
            } catch (error) {
                console.log(error)
            }
        })

        bot.on('entityMoved', (entity) => {
            const data = this.snowballs.get(entity.id)
            if (!data) {return}

            data.lastPos = entity.position.clone()
            data.velocity = entity.velocity.clone()
            data.lastUpdate = Date.now()
        })
    }

    _process(sender, args) {
        let answ;

        if (args[0].name === "stats") {
            const stats = this.get_player_stats(sender)
            answ = `Снежков, достигшних цели: ${stats.hits_done}. Пойманных снежков: ${stats.hits_taken}`

        } else if (args[0].name === "list") {
            num_page = args[1].value

            const hits = this.get_hits({ limit: 50 });

            const hits_text = hits.map(h => {
                return [`${h.shooter} → ${h.target}`, `${h.distance.toFixed(1)}м`]
            })
            const split_into_pages = stats_split_into_pages(hits_text, 5, num_page, "Последние попадания: ")

            answ = split_into_pages["answ"]
        
        } else if (args[0].name === "balance") {
            const balance = this.get_balance(sender)
            answ = `Ваш баланс: ${balance}$`
        
        } else if (args[0].name === "get") {
            const balance = this.get_balance(sender)
            if (balance >= 100) {
                this.send_reward(sender, balance, "Ваша награда")
            } else {
                answ = `Вывод средств доступен от 100$. У Вас есть только ${balance}`
            }

        } else if (args[0].name === "info") {
            answ = "За каждое попадание снежком в игрока пополняется внутренний баланс. От 1000$ автоматически выводится. Если пулять в новых игроков, платится больше."
        }
        if (answ) {
            return answ
        }
    }
}

module.exports = SnowballsModule

