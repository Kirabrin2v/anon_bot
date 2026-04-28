const path = require("path")

const CommandEngine = require(path.join(BASE_DIR, "command_engine.js"))


class TelegramCommandEngine extends CommandEngine {
  _checkRank(required, actual) {
      if (required === undefined) {
        required = 0;
      }
      if (actual === undefined) {return false;}
      return actual >= required;
    }

  get_available_commands(tg_id, get_rank) {
    const result = {};

    for (const module_name in this.modules_structure) {
      let user_rank;
      if (get_rank !== undefined) {
        user_rank = get_rank(tg_id, module_name)
      }
      const rank = get_rank()
      const root = this.modules_structure[module_name];

      if (!root || typeof root !== "object") {continue;}


      if (!this._checkRank(root._need_rank, user_rank)) {
        continue;
      }

      const description =
        root._description || "Без описания";

      result[module_name] = description;
    }

    return result;
  }

  _generateHelpMessage(module_name, usedArgs, result = null) {
    let current = this.modules_structure[module_name];

    // ----------- ПЕРЕХОД ПО СТРУКТУРЕ (с alias) -----------
    for (const arg of usedArgs) {
      const key = this._findKey(current, arg);

      if (key && typeof current[key] === 'object') {
        current = current[key];
      } else {
        break;
      }
    }

    let text = `Команда: /${module_name}\n\n`;

    // ------------------ РАСПОЗНАННЫЕ ------------------
    if (result && result.args.length > 0) {
      const parsed = result.args
        .map(arg => {
          if (arg.value === undefined || arg.value === "") {
            return `  ${arg.name}: (пусто или некорректно)`;
          }
          return `  ${arg.name}: ${arg.value}`;
        })
        .join('\n');

      text += `Распознано:\n${parsed}\n\n`;
    }

    // ------------------ НЕИСПОЛЬЗОВАННЫЕ ------------------
    if (result && result.unused_args && result.unused_args.length > 0) {
      text += `Не распознано:\n${result.unused_args.join(', ')}\n\n`;
    }

    // ------------------ ОПИСАНИЕ ------------------
    if (current._description) {
      text += `${current._description}\n\n`;
    }

    // ------------------ ОЖИДАЕМЫЕ АРГУМЕНТЫ ------------------
    const options = Object.entries(current)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, value]) => {
        if (typeof value !== 'object') {return `• ${key}`;}

        const isBranch = !('_type' in value);

        if (isBranch) {
          return `${key} — подкоманда`;
        }

        let line = `🔹 ${key} <${value._type}>`;

        if (value._default !== undefined) {
          line += ` (по умолчанию: ${value._default})`;
        }

        if (value._optional || value._default !== undefined) {
          line += ` [необязательный]`;
        }

        if (value._description) {
          line += ` — ${value._description}`;
        }

        return line;
      });

    if (options.length > 0) {
      text += `Ожидается:\n${options.join('\n')}`;
    }

    return text;
  }

  // Полный help (если нет аргументов или help)
  _generateFullHelp(module_name) {
    const root = this.modules_structure[module_name];
    let text = `Команда: /${module_name}\n`;
    if (root._description) {
        text += `${root._description}\n`;
    }
    text += "\n";

    const walk = (node, path = [], indent = 0) => {
        const keys = Object.keys(node).filter(k => !k.startsWith("_"));

        for (const key of keys) {
            const child = node[key];
            const pad = "  ".repeat(indent);
            const connector = indent === 0 ? "🔹 " : `${pad}└ `;

            if (!child._type) {
                const line = [...path, key].join(" ");
                text += `${connector}${line}\n`;
                if (child._description) {
                    text += `${"  ".repeat(indent + 1)}└ ${child._description}\n`;
                }
                walk(child, [...path, key], indent + 1);
                if (indent === 0) { text += "\n"; }

            } else {
                const argStr = `${key} <${child._type}>`;
                const line = [...path, argStr].join(" ");
                text += `${connector}${line}`;
                if (child._default !== undefined) {
                    text += ` (по умолчанию: ${child._default})`;
                }
                text += "\n";
                if (child._description) {
                    text += `${"  ".repeat(indent + 1)}└ ${child._description}\n`;
                }

                const subKeys = Object.keys(child).filter(k => !k.startsWith("_"));
                if (subKeys.length > 0) {
                    walk(child, [...path, argStr], indent + 1);
                }
                if (indent === 0) { text += "\n"; }
            }
        }
    };

    walk(root, [], 0);
    return text;
  }
  // Переопределяем validate для полного help
  validate_command(module_name, inputArgs, user_rank = undefined) {
    const currentStructure = this.modules_structure[module_name]
    if (!this._checkRank(currentStructure._need_rank, user_rank)) {
      return {
        is_ok: false,
        args: [],
        unused_args: [],
        message_error: `Команды ${module_name} не существует`
      };
    }
    if (
      (inputArgs.length === 0 &&
        Object.keys(currentStructure)
        .filter(key => !key
          .startsWith('_')).length > 0) ||
      (inputArgs.length === 1 && inputArgs[0] === "help")
    ) {
      return {
        is_ok: false,
        args: [],
        unused_args: [],
        message_error: this._generateFullHelp(module_name)
      };
    }

    return super.validate_command(module_name, inputArgs, user_rank);
  }
}

module.exports = TelegramCommandEngine
