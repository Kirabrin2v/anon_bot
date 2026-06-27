const sqlite = require("better-sqlite3");


const JSON_TYPES = new Set(["LIST", "DICT", "JSON"]);
const BOOL_TYPES = new Set(["BOOLEAN"]);


function getTableSchema(db, table) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  const schema = {};
  for (const row of rows) {
    schema[row.name] = row.type.split(/\s+/)[0].toUpperCase();
  }
  return schema;
}

function serialize(data, schema) {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    const type = schema[key];
    if (JSON_TYPES.has(type)) {
      result[key] = JSON.stringify(value);
    } else if (BOOL_TYPES.has(type)) {
      result[key] = value ? 1 : 0;
    } else {
      result[key] = value;
    }
  }
  return result;
}

function deserialize(row, schema) {
  if (!row) return null;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const type = schema[key];
    if (JSON_TYPES.has(type)) {
      try {
        result[key] = value != null ? JSON.parse(value) : null;
      } catch {
        result[key] = value; // fallback
      }
    } else if (BOOL_TYPES.has(type)) {
      result[key] = value != null ? Boolean(value) : null;
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Создаёт обёртку над таблицей с авто-(де)сериализацией
function createTableWrapper(db, table) {
  const schema = getTableSchema(db, table);

  return {
    schema,

    get(where = {}) {
      const keys = Object.keys(where);
      const sql = keys.length
        ? `SELECT * FROM ${table} WHERE ${keys.map(k => `${k} = ?`).join(" AND ")} LIMIT 1`
        : `SELECT * FROM ${table} LIMIT 1`;
      const row = db.prepare(sql).get(...Object.values(where));
      return deserialize(row, schema);
    },

    all(where = {}) {
      const keys = Object.keys(where);
      const sql = keys.length
        ? `SELECT * FROM ${table} WHERE ${keys.map(k => `${k} = ?`).join(" AND ")}`
        : `SELECT * FROM ${table}`;
      const rows = db.prepare(sql).all(...Object.values(where));
      return rows.map(row => deserialize(row, schema));
    },

    insert(data) {
      const serialized = serialize(data, schema);
      const keys = Object.keys(serialized);
      const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
      return db.prepare(sql).run(...Object.values(serialized));
    },

    update(data, where = {}) {
      const serialized = serialize(data, schema);
      const setKeys = Object.keys(serialized);
      const whereKeys = Object.keys(where);
      const sql = `UPDATE ${table} SET ${setKeys.map(k => `${k} = ?`).join(", ")} WHERE ${whereKeys.map(k => `${k} = ?`).join(" AND ")}`;
      return db.prepare(sql).run(...Object.values(serialized), ...Object.values(where));
    },
  };
}


function createUserRow(db, table, tg_id, wrapper) {
  return new Proxy({}, {
    get(_, field) {
      const user = wrapper.get({ tg_id });
      if (!user) return undefined;
      return user[field];
    },

    set(_, field, value) {
      wrapper.update({ [field]: value }, { tg_id });
      return true;
    }
  });
}

function createUsersProxy(db, tableName = "users") {
  const wrapper = createTableWrapper(db, tableName);

  return new Proxy({}, {
    get(_, tg_id) {
      if (typeof tg_id === "symbol") return undefined;
      tg_id = Number(tg_id);
      if (isNaN(tg_id)) return undefined;

      const exists = wrapper.get({ tg_id });
      if (!exists) return undefined;
      return createUserRow(db, tableName, tg_id, wrapper);
    },

    set(_, tg_id, data) {
      tg_id = Number(tg_id);
      const exists = wrapper.get({ tg_id });
      if (exists) {
        wrapper.update(data, { tg_id });
      } else {
        wrapper.insert({ tg_id, ...data });
      }
      return true;
    },

    deleteProperty(_, tg_id) {
      tg_id = Number(tg_id);
      db.prepare(`DELETE FROM users WHERE tg_id = ?`).run(tg_id);
      return true;
    }
  });
}

module.exports = { createUsersProxy };
