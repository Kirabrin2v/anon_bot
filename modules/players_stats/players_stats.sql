BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "stats" (
	"nickname"	TEXT,
	"rank"	INTEGER,
	"messages"	INTEGER,
	"cmds"	INTEGER,
	"donate"	INTEGER,
	"casino"	INTEGER,
	"name"	TEXT,
	"credit"	INTEGER,
	"warns"	INTEGER,
	"echo"	INTEGER,
	"twinks"	TEXT,
	PRIMARY KEY("nickname")
);
COMMIT;
