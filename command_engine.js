const reg_nickname = String.raw`([А-яA-Za-z0-9~!@#$^*\-_=+ёЁ]{1,16})`;

let modules_structure = {}

function validate_command(module_name, inputArgs) {
  const result = {
    is_ok: true,
    args: [],
    unused_args: []
  };

  const usedArgs = new Set();
  let currentStructure = modules_structure[module_name];
  let path = [];
  let i = 0;

  while (i < inputArgs.length) {
    const arg = inputArgs[i];
    if (arg === "help") {
      result.is_ok = false;
      result.message_error = generateHelpMessage(module_name, result.args.map(arg => arg.name))
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

    // 2. Ищем подходящий по типу аргумент
    let matchedKey = null;

    for (const key in currentStructure) {
      if (key.startsWith('_')) continue;
      const node = currentStructure[key];
      if (node._type && checkType(node._type, arg) || (node._optional)) {
        matchedKey = key;
        break;
      }
    }

    if (matchedKey) {
      //const fullName = [...path, matchedKey].join('.');
      result.args.push({ name: matchedKey, value: arg || currentStructure[matchedKey]._default });
      currentStructure = currentStructure[matchedKey];
      path.push(matchedKey);
      usedArgs.add(arg);
      i++;
    } else {
      break; // нет совпадений — проверим на обязательные поля
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
    result.message_error = generateHelpMessage(module_name, result.args.map(arg => arg.name))
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
  result.unused_args = inputArgs.filter(arg => !usedArgs.has(arg));

  return result;
}



function checkType(expectedType, value) {
  if (expectedType === 'int') return Number.isInteger(Number(value));
  if (expectedType === 'string' || expectedType === 'text') return typeof value === 'string';
  if (expectedType === 'float') return !isNaN(parseFloat(value));
  if (expectedType === 'nick') return value.match(reg_nickname);
  if (expectedType === 'bool') return value === true || value === false;
  return false; // кастомные типы можно обрабатывать тут
}


function generateHelpMessage(module_name, usedArgs) {
  let current = modules_structure[module_name];

  for (const arg of usedArgs) {
    if (arg in current && typeof current[arg] === 'object') {
      current = current[arg];
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
      if (typeof value !== 'object') return key;

      const isBranch = !('_type' in value);
      if (isBranch) return key;

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

// const input = ["пополнитьы"];
// const result = validateCommand(structure, input, checkType);

// console.log(JSON.stringify(result, null, 2));

module.exports = {modules_structure, validate_command}