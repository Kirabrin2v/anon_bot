const sqlite = require("better-sqlite3");
const path = require("path");

const db = new sqlite(path.join(__dirname, "tasks.db"));

// Статусы задач хранятся в БД латиницей.
const STATUS_LABELS = {
    todo: "На заметке",
    in_progress: "В процессе",
    done: "Выполнено",
    rejected: "Не будет реализовано"
};

const ALLOWED_STATUSES = Object.keys(STATUS_LABELS);

const EDITABLE_FIELDS = {
    title: "title",
    description: "description",
    status: "status"
};

db.prepare(`CREATE TABLE IF NOT EXISTS tasks (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo'
)`).run();


function add_task(title, status, description) {
    if (!ALLOWED_STATUSES.includes(status)) {
        return { "is_ok": false, "message_error": "invalid_status" };
    }

    if (description === "") {
        description = undefined;
    }

    const insertTask = db.prepare(`INSERT INTO tasks
                                    (title, description, status)
                                    VALUES (?, ?, ?)`);

    const result = insertTask.run(title, description, status);
    return { "is_ok": true, "id": result.lastInsertRowid };
}

function get_task(id) {
    return db.prepare(`SELECT * FROM tasks WHERE ID = ?`).get(id);
}

function get_tasks() {
    return db.prepare(`SELECT * FROM tasks ORDER BY ID DESC`).all();
}

function edit_task(id, field, value) {
    const task = get_task(id);
    if (!task) {
        return { "is_ok": false, "message_error": "Задачи с указанным айди не существует" };
    }

    if (!EDITABLE_FIELDS[field]) {
        return { "is_ok": false, "message_error": "invalid_field" };
    }

    if (field === "status" && !ALLOWED_STATUSES.includes(value)) {
        return { "is_ok": false, "message_error": "invalid_status" };
    }

    const updateTask = db.prepare(`UPDATE tasks SET ${EDITABLE_FIELDS[field]} = ? WHERE ID = ?`);
    updateTask.run(value, id);
    return { "is_ok": true };
}


function main(type, parameters) {
    try {
        if (type === "add") {
            return add_task(parameters.title, parameters.status, parameters.description);

        } else if (type === "edit") {
            return edit_task(parameters.id, parameters.field, parameters.value);

        } else if (type === "get_tasks") {
            return { "is_ok": true, "tasks": get_tasks() };

        } else if (type === "get_task") {
            const task = get_task(parameters.id);
            if (!task) {
                return { "is_ok": false, "message_error": "Задачи с указанным айди не существует" };
            }
            return { "is_ok": true, "task": task };
        }

    } catch (error) {
        console.log(error);
        return { "is_ok": false, "message_error": "Возникла непредвиденная ошибка" };
    }
}

module.exports = { main, STATUS_LABELS, ALLOWED_STATUSES };
