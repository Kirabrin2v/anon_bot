const reg_nickname = String.raw`^([А-яA-Za-z0-9~!@#$^*\-_=+ёЁ]{1,16})$`;

class CommandEngine {
  constructor() {
    this.modules_structure = {}
  }

  _findKey(current, arg) {
    if (arg in current) {return arg;}

    for (const key of Object.keys(current)) {
      if (current[key]._aliases?.includes(arg)) {
        return key;
      }
    }

    return null;
  }

  _checkRank(required, actual) {
    if (required === undefined) {return true;}
    if (actual === undefined) {return false;}
    return actual >= required;
  }

  validate_command(module_name, inputArgs, user_rank = undefined) {
    const result = {
      is_ok: true,
      args: [],
      unused_args: []
    };

    const usedArgs = new Set();
    let currentStructure = this.modules_structure[module_name];
    const path = [];
    let i = 0;

    if (!this._checkRank(currentStructure._need_rank, user_rank)) {
      return {
        is_ok: false,
        args: [],
        unused_args: inputArgs,
        message_error: `Недостаточно прав для команды /${module_name}\nТребуемый ранг: ${currentStructure._need_rank}`
      };
    }

    while (i < inputArgs.length) {
      const arg = inputArgs[i];
      if (arg === "help") {
        result.is_ok = false;

        // Досчитываем unused_args
        result.unused_args = inputArgs.slice(i + 1);

        result.message_error = this._generateHelpMessage(
          module_name,
          result.args.map(arg => arg.name),
          result
        );

        return result;
      }
      // 1. Если аргумент — это имя ветки (без _type), переходим внутрь
      let is_matched = arg in currentStructure && !currentStructure[arg]._type;
      if (!is_matched) {
        const keys = Object.keys(currentStructure)
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i]
          if (currentStructure[key]._aliases && currentStructure[key]._aliases.includes(arg)) {
            is_matched = true;
            currentStructure = currentStructure[key];
            break;
          }
        }
      } else {
        currentStructure = currentStructure[arg];
      }
      if (is_matched) {
        if (!this._checkRank(currentStructure._need_rank, user_rank)) {
          return {
            is_ok: false,
            args: result.args,
            unused_args: inputArgs.slice(i),
            message_error: `Недостаточно прав.\nТребуемый ранг: ${currentStructure._need_rank}`
          };
        }
        //const fullName = [...path, arg].join('.');
        if (currentStructure.hasOwnProperty("_default")) {
          result.args.push({ name: arg, value: !currentStructure["_default"] });
        } else {
          result.args.push({ name: arg, value: true })
        }
        usedArgs.add(arg);
        path.push(arg);
        i++;
        continue;
      }

      // 2. СНАЧАЛА проверяем _type у текущего узла
      if (currentStructure._type) {
        if (this._checkType(currentStructure._type, arg)) {
          result.args.push({
            name: path[path.length - 1],
            value: arg
          });

          usedArgs.add(arg);
          i++;
          continue;
        } else {
          break;
        }
      }
      // 2.5 Проверка на составной аргумент (_multiple)
      for (const key in currentStructure) {
        if (key.startsWith('_')) {continue;}

        const node = currentStructure[key];

        if (node._multiple && node._type) {

          const values = [];
          let localI = i;

          while (localI < inputArgs.length) {
            const val = inputArgs[localI];

            if (!this._checkType(node._type, val)) {
              return {
                is_ok: false,
                args: result.args,
                unused_args: inputArgs.slice(localI),
                message_error: `Аргумент "${key}" ожидает <${node._type}>, но получил "${val}"`
              };
            }

            values.push(val);
            usedArgs.add(val);
            localI++;
          }

          // записываем результат
          result.args.push({
            name: key,
            value: values.length > 0 ? values : (node._default || [])
          });

          // двигаем индекс
          i = localI;

          return result;
        }
      }

      // 2.6 rest аргумент (забрать всё)
      for (const key in currentStructure) {
        if (key.startsWith('_')) {continue;}

        const node = currentStructure[key];

        if (node._rest) {
          const remaining = inputArgs.slice(i).join(" ");

          result.args.push({
            name: key,
            value: remaining
          });

          usedArgs.add(...inputArgs.slice(i));
          i = inputArgs.length;

          currentStructure = node;
          path.push(key);
          break;
        }
      }

      // 3. Ищем подходящий по типу аргумент среди дочерних
      let matchedKey = null;

      for (const key in currentStructure) {
        if (key.startsWith('_')) {continue;}

        const node = currentStructure[key];

        // строго: если есть _type — проверяем только тип
        if (node._type) {
          if (this._checkType(node._type, arg)) {
            matchedKey = key;
            break;
          }
        }
        // если нет _type, но optional — можно принять
        else if (node._optional) {
          matchedKey = key;
          break;
        }
      }

      if (matchedKey) {
        const node = currentStructure[matchedKey];

        if (!this._checkRank(node._need_rank, user_rank)) {
          return {
            is_ok: false,
            args: result.args,
            unused_args: inputArgs.slice(i),
            message_error: `❌ Недостаточно прав.\nТребуемый ранг: ${node._need_rank}`
          };
        }

        result.args.push({
          name: matchedKey,
          value: arg !== undefined ? arg : node._default
        });

        currentStructure = node;
        path.push(matchedKey);
        usedArgs.add(arg);
        i++;
      } else {
        break; // нет совпадений — дальше проверка обязательных
      }
    }
    // Проверка обязательных аргументов на текущем уровне
    const availableKeys = Object.keys(currentStructure).filter(k => !k.startsWith('_'));
    const requiredKeys = availableKeys.filter(k => {
      const node = currentStructure[k];
      const optional = node._optional || node._default !== undefined;
    
      return !optional; //  && node._type; // ветки не проверяем на обязательность
    });

    if (requiredKeys.length > 0 && requiredKeys.length == availableKeys.length) {
      result.is_ok = false;
      result.message_error = this._generateHelpMessage(module_name, result.args.map(arg => arg.name), result)
      //result.message_error = `Ожидался один из аргументов: ${Object.keys(currentStructure).filter(k => !k.startsWith('_')).join(', ')}`;
      return result;

    }

    // Подставляем _default, если есть
    for (const key of availableKeys) {
      const node = currentStructure[key];
      //const fullName = [...path, key].join('.');
      const alreadyIncluded = result.args.some(arg => arg.name === key);
      // console.log(alreadyIncluded, [fullName])

      if (!alreadyIncluded && node._default !== undefined) {
        result.args.push({ name: key, value: node._default });
        break;
      }
    }

    // Сохраняем неиспользованные аргументы
    result.unused_args = inputArgs.slice(i);

    return result;
  }



  _checkType(expectedType, value) {
    if (expectedType === 'int') {return Number.isInteger(Number(value));}
    if (expectedType === 'string' || expectedType === 'text') {return typeof value === 'string';}
    if (expectedType === 'float') {return !isNaN(parseFloat(value));}
    if (expectedType === 'nick') {return value.match(reg_nickname);}
    if (expectedType === 'bool') {return value === true || value === false;}
    return false; // кастомные типы можно обрабатывать тут
  }


  _generateHelpMessage(module_name, usedArgs, result) {
    let current = this.modules_structure[module_name];

    for (const arg of usedArgs) {
      const key = this._findKey(current, arg);

      if (key && typeof current[key] === 'object') {
        current = current[key];
      } else {
        break;
      }
    }

    const parts = [];

    if (current._description) {
      parts.push(current._description.trim());
    }

    const options = Object.entries(current)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, value]) => {
        if (typeof value !== 'object') {return key;}

        const isBranch = !('_type' in value);
        if (isBranch) {return key;}

        let desc = `[${key} <${value._type}>`;
        if (value._default !== undefined) {
          desc += ` (по умолчанию: ${value._default})`;
        }
        if (value._optional || value._default !== undefined) {
          desc += ` {необязательный}`;
        }
        desc += `]`;
        return desc;
      });

    if (options.length > 0) {
      parts.push('Доступные аргументы: ' + options.join(', '));
    }

    return parts.join('. ') + '.';
  }
}


const STRUCTURE = {
    _need_rank: 1,
  add: {
    цитата: {
      _type: "text",
      _multiple: true,
      _description: "Ваша личная цитата"
    },
    _description: "Предложить свою цитату для использования её ботом",
  },
  rep: {
    id: {
      "+": {
        _description: "Повысить рейтинг"
      },
      "-": {
        _description: "Понизить рейтинг"
      },
      "del": {
        _description: "Отменить уже поставленный рейтинг"
      },
      _type: "int",
      _description: "Айди цитаты, рейтинг которой нужно изменить"
    },
    _description: "Изменить рейтинг цитаты. Рейтинг влияет на частоту появления цитаты в чате: меньше рейтинг - реже появляется"
  },
  list: {
    by: {
      nick: {
        "номер_страницы": {
          _type: "int",
          _default: 1
        },
        _type: "nick",
        _description: "Ник игрока, цитаты которого нужно показать"
      },
      _description: "Цитаты конкретного игрока"
    },
    all: {
      "номер_страницы": {
        _type: "int",
        _default: 1
      },
      _description: "Все цитаты"
    },
    _description: "Показывает список цитат"
  },
  by: {
    nick: {
      _type: "nick",
      _description: "Ник игрока, цитату которого нужно отправить"
    },
    _description: "Отправляет случайную цитату выбранного игрока"
  },
  id: {
    id: {
      _type: "int",
      _description: "Айди цитаты, которую нужно отправить"
    },
    _description: "Отправляет цитату с указанным айди"
  }
}


class TelegramCommandEngine extends CommandEngine {
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
            return `✔ ${arg.name}: (пусто или некорректно)`;
          }
          return `✔ ${arg.name}: ${arg.value}`;
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

    let text = `Команда: /${module_name}\n\n`;

    const walk = (node, path = [], indent = 0) => {
      const keys = Object.keys(node).filter(k => !k.startsWith("_"));

      // Сначала выводим текущую команду (родителя)
      if (path.length > 0 && node._description) {
        const line = path.join(" ");
        text += `${"  ".repeat(indent)}${line} — ${node._description}\n`;
      }

      for (const key of keys) {
        const child = node[key];

        if (!child._type) {
          // Подкоманда
          walk(child, [...path, key], indent + (path.length > 0 ? 1 : 0));
        } else {
          // Аргумент
          const argStr = `${key}<${child._type}>`;

          // Сначала строка аргумента
          const line = [...path, argStr].join(" ");
          const desc = child._description || node._description || "";

          text += `${"  ".repeat(indent + 1)}${line} — ${desc}\n`;

          // Потом возможные подветки
          const subKeys = Object.keys(child).filter(k => !k.startsWith("_"));
          for (const subKey of subKeys) {
            const subNode = child[subKey];

            const subLine = [...path, argStr, subKey].join(" ");
            const subDesc = subNode._description || "";

            text += `${"  ".repeat(indent + 2)}${subLine} — ${subDesc}\n`;
          }
        }
      }
    };

    // Верхний уровень
    Object.keys(root)
      .filter(k => !k.startsWith("_"))
      .forEach(key => {
        walk(root[key], [key], 0);
      });

    return text;
  }

  // Переопределяем validate для полного help
  validate_command(module_name, inputArgs, user_rank = undefined) {
    const currentStructure = this.modules_structure[module_name]
    if (
      (inputArgs.length === 0 && Object.keys(currentStructure).length > 0) ||
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

const STRUCTURE2 = {
  _description: "Управление логами и списком отслеживаемых игроков",

  log: {
    filename: {
      _type: "string",
      _description: "Имя лог-файла"
    },
    _description: "Получить файл логов",
    _need_rank: 1
  },

  list: {
    nicks: {
      _type: "nick",
      _multiple: true,
      _description: "Список ников через пробел"
    },
    _description: "Установить или посмотреть список отслеживаемых игроков",
    _need_rank: 2
  }
}

const TgManager = new TelegramCommandEngine()

TgManager.modules_structure["quotes"] = STRUCTURE2

console.log(TgManager.validate_command("quotes", ["list", " s s s s s s s s s s s s s s s s s s s s s s s s s s s s s s s s s s s s"], 23))
