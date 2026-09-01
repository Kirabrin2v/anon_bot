const path = require("path")
const { parse_html } = require("@telegraf/entity")

const BaseCmd = require(path.join(__dirname, "..", "base.js"))
const bus = require(path.join(BASE_DIR, "event_bus.js"))
const tasks_db = require(path.join(__dirname, "manage_db.js"))
const { STATUS_LABELS, ALLOWED_STATUSES } = tasks_db


const CMD_NAME = "tasks"
const TASKS_PER_PAGE = 10

// Сопоставление того, как пользователь может назвать поле для редактирования,
// с внутренним (латинским) именем поля в БД
const FIELD_ALIASES = {
    "title": "title",
    "название": "title",
    "имя": "title",
    "description": "description",
    "описание": "description",
    "status": "status",
    "статус": "status"
}

const STRUCTURE = {
    list: {
        _description: "Показать список актуальных задач"
    },

    detail: {
        id: {
            _type: "int",
            _description: "ID задачи"
        },
        _description: "Показать подробную информацию о задаче"
    },

    create: {
        title: {
            status: {
                description: {
                    _type: "text",
                    _description: "Подробное описание задачи. Поддерживается Markdown"
                },
                _type: "string",
                _description: `Статус задачи. Доступные варианты: ${ALLOWED_STATUSES.join(", ")}`
            },
            _type: "string",
            _description: "Название задачи"
        },
        _description: "Создать новую задачу",
        _need_rank: 1
    },

    edit: {
        id: {
            field: {
                value: {
                    _type: "text",
                    _description: "Новое значение. Для статуса указывается латиницей"
                },
                _type: "string",
                _description: "Что изменить: название (title), описание (description) или статус (status)"
            },
            _type: "int",
            _description: "ID задачи"
        },
        _description: "Изменить задачу",
        _need_rank: 1
    },

    _description: "Управление задачами"
};


class TasksCmd extends BaseCmd {
    constructor(module_obj) {
        super(module_obj, CMD_NAME, STRUCTURE)

        bus.on("callback_query", (obj) => this.handle_callback_query(obj.query))
    }

    async _process(sender, args) {
        if (args[0].name === "list") {
            return this.build_list_message(1)
        }

        if (args[0].name === "detail") {
            const task_id = args[1].value
            return this.build_detail_message(task_id)
        }

        if (args[0].name === "create") {
            return this.create_task(args)
        }

        if (args[0].name === "edit") {
            return this.edit_task(args)
        }

        return null
    }

    create_task(args) {
        const title = args[1].value
        const status = args[2].value
        const description = args[3].value

        if (!ALLOWED_STATUSES.includes(status)) {
            return this.invalid_status_message()
        }

        try {
            parse_html(description)
        } catch (error) {
            return `Некорректная HTML-разметка: ${error.message}`
        }

        const info = tasks_db.main("add", { title, status, description })
        if (!info.is_ok) {
            if (info.message_error === "invalid_status") {
                return this.invalid_status_message()
            }
            return info.message_error
        }

        return `Задача успешно создана. ID задачи: ${info.id}`
    }

    edit_task(args) {
        const task_id = args[1].value
        const raw_field = args[2].value
        const value = args[3].value

        const field = FIELD_ALIASES[raw_field.toLowerCase()]
        if (!field) {
            return "Некорректное поле для изменения. Доступные варианты: название (title), описание (description), статус (status)"
        }

        if (field === "status" && !ALLOWED_STATUSES.includes(value)) {
            return this.invalid_status_message()
        }

        if (field === "description") {
            try {
                parse_html(value)
            } catch (error) {
                return `Некорректная HTML-разметка: ${error.message}`
            }
        }

        const info = tasks_db.main("edit", { id: task_id, field, value })
        if (!info.is_ok) {
            if (info.message_error === "invalid_status") {
                return this.invalid_status_message()
            }
            return info.message_error
        }

        return "Задача успешно изменена"
    }

    invalid_status_message() {
        let text = "Некорректный статус. Доступные статусы:\n"
        for (const status of ALLOWED_STATUSES) {
            text += `${status} - ${STATUS_LABELS[status]}\n`
        }
        return text
    }

    build_list_message(page) {
        const info = tasks_db.main("get_tasks")
        if (!info.is_ok) {
            return info.message_error
        }

        const tasks = info.tasks
        const total_pages = Math.max(1, Math.ceil(tasks.length / TASKS_PER_PAGE))
        page = Math.min(Math.max(page, 1), total_pages)

        const start = (page - 1) * TASKS_PER_PAGE
        const page_tasks = tasks.slice(start, start + TASKS_PER_PAGE)

        let text
        if (page_tasks.length === 0) {
            text = "Список задач пуст"
        } else {
            text = page_tasks
                .map(task => `${task.ID}) ${task.title} [${STATUS_LABELS[task.status] || task.status}]`)
                .join("\n")
            text += `\n\n${page}/${total_pages} страниц`
        }

        const keyboard = this.build_pagination_keyboard(page, total_pages)

        return { message: text, keyboard }
    }

    build_detail_message(task_id) {
        const info = tasks_db.main("get_task", { id: task_id })
        if (!info.is_ok) {
            return info.message_error
        }

        const task = info.task

        let text = `${task.ID}) ${task.title}\n`
        text += `Статус: ${STATUS_LABELS[task.status] || task.status}\n`
        if (task.description) {
            text += `\n${task.description}`
        }

        const keyboard = {
            inline_keyboard: [
                [{ text: "Список задач", callback_data: "tasks_page:1" }]
            ]
        }

        return { message: text, keyboard, parse_mode: "HTML" }
    }

    build_pagination_keyboard(page, total_pages) {
        if (total_pages <= 1) {
            return undefined
        }

        const row = []
        if (page > 1) {
            row.push({ text: "<<<", callback_data: "tasks_page:1" })
            row.push({ text: "<", callback_data: `tasks_page:${page - 1}` })
        }
        if (page < total_pages) {
            row.push({ text: ">", callback_data: `tasks_page:${page + 1}` })
            row.push({ text: ">>>", callback_data: `tasks_page:${total_pages}` })
        }

        if (row.length === 0) {
            return undefined
        }

        return { inline_keyboard: [row] }
    }

    handle_callback_query(query) {
        const [action, page] = query.data.split(":")
        if (action !== "tasks_page") {
            return
        }

        const tg_id = query.from.id
        const page_num = parseInt(page, 10)

        const result = this.build_list_message(page_num)

        this.module_obj.edit_message_tg(tg_id, query.message.message_id, result.message, result.keyboard)

        if (this.module_obj.tg.answerCallbackQuery) {
            this.module_obj.tg.answerCallbackQuery(query.id).catch(() => {})
        }
    }
}

module.exports = TasksCmd