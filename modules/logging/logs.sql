BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "script_logs" (
	"ID"	INTEGER,
	"date_time"	TEXT,
	"type_message"	TEXT,
	"message"	TEXT,
	PRIMARY KEY("ID" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "error_logs" (
	"ID"	INTEGER,
	"date_time"	TEXT,
	"module_name"	TEXT,
	"short_error"	TEXT,
	"full_error"	TEXT,
	"args"	TEXT,
	"sender"	TEXT,
	PRIMARY KEY("ID" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "players_logs" (
	"ID"	INTEGER,
	"date_time"	TEXT,
	"location"	TEXT,
	"type_chat"	TEXT,
	"nickname"	TEXT,
	"message"	TEXT,
	"full_message"	TEXT,
	"is_old"	INTEGER DEFAULT 0,
	PRIMARY KEY("ID" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "server_logs" (
	"ID"	INTEGER,
	"date_time"	TEXT,
	"type_sender"	TEXT,
	"message"	TEXT,
	PRIMARY KEY("ID" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "players_and_server_json" (
	"ID"	INTEGER,
	"date_time"	TEXT NOT NULL,
	"sender"	TEXT NOT NULL,
	"message"	TEXT NOT NULL,
	PRIMARY KEY("ID" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "players_logs_json" (
	"ID"	INTEGER,
	"date_time"	TEXT NOT NULL,
	"nickname"	TEXT NOT NULL,
	"message"	TEXT NOT NULL,
	PRIMARY KEY("ID")
);
COMMIT;
