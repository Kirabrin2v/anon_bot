const path = require("path")

const { reg_full_nickname } = require(path.join(BASE_DIR, "regex.js"))

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

  flattenArgs(args) {
    const result = [];

    for (const arg of args) {
        switch (arg.type) {
            case "flag":
                result.push(arg.name);
                break;

            case "multiple":
                if (Array.isArray(arg.value)) {
                    result.push(...arg.value);
                }
                break;

            case "text":
                if (arg.value !== undefined && arg.value !== "") {
                    result.push(arg.value);
                }
                break;

            case "value":
                if (arg.value !== undefined) {
                    result.push(arg.value);
                }
                break;
        }
    }

    return result;
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

    if (currentStructure._need_rank !== undefined) {
      if (!this._checkRank(currentStructure._need_rank, user_rank)) {
        return {
          is_ok: false,
          args: [],
          unused_args: inputArgs,
          message_error: `Недостаточно прав для команды /${module_name}\nТребуемый ранг: ${currentStructure._need_rank}`
        };
      }
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
      const key = this._findKey(currentStructure, arg);

      let is_matched = key && !currentStructure[key]._type;

      if (is_matched) {
        currentStructure = currentStructure[key];
        if (currentStructure._need_rank !== undefined) {
          if (!this._checkRank(currentStructure._need_rank, user_rank)) {
            return {
              is_ok: false,
              args: result.args,
              unused_args: inputArgs.slice(i),
              message_error: `Недостаточно прав.\nТребуемый ранг: ${currentStructure._need_rank}`
            };
          }
        }
        //const fullName = [...path, arg].join('.');
        if (Object.prototype.hasOwnProperty.call(currentStructure, "_default")) {
          result.args.push({ name: key, value: !currentStructure["_default"] });
        } else {
          result.args.push({ name: key, value: true, type: "flag" })
        }
        usedArgs.add(key);
        path.push(key);
        i++;
        continue;
      }

      // 2 Проверка на составной аргумент (_multiple)
      for (const key in currentStructure) {
        if (key.startsWith('_')) {continue;}

        const node = currentStructure[key];

        if (node._multiple && node._type) {

          const values = [];
          let localI = i;

          while (localI < inputArgs.length) {
            const val = inputArgs[localI];

            // Первый же неподходящий — это ошибка
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

          // Записываем результат
          result.args.push({
            name: key,
            value: values.length > 0 ? values : (node._default || []),
            type: "multiple"
          });

          // После multiple парсинг заканчивается
          return result;
        }
      }
      // 2.6 text-type (забрать всё)
      for (const key in currentStructure) {
        if (key.startsWith('_')) {continue;}

        const node = currentStructure[key];

        if (node._type === "text") {
          const remaining = inputArgs.slice(i).join(" ");

          result.args.push({
            name: key,
            value: remaining,
            type: "text"
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

        if (node._need_rank !== undefined) {
          if (!this._checkRank(node._need_rank, user_rank)) {
            return {
              is_ok: false,
              args: result.args,
              unused_args: inputArgs.slice(i),
              message_error: `Недостаточно прав.\nТребуемый ранг: ${node._need_rank}`
            };
          }
        }

        result.args.push({
          name: matchedKey,
          value: arg !== undefined ? arg : node._default,
          type: "value"
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

    if (requiredKeys.length > 0 && requiredKeys.length === availableKeys.length) {
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
    if (expectedType === 'nick') {return value.match(reg_full_nickname);}
    if (expectedType === 'bool') {return value === true || value === false;}
    return false; // кастомные типы можно обрабатывать тут
  }


  _generateHelpMessage(module_name, usedArgs, _result) {
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



module.exports = CommandEngine