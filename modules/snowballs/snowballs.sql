BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "snowball_hits" (
	"ID"	INTEGER,
	"shooter"	TEXT NOT NULL,
	"target"	TEXT NOT NULL,
	"distance"	REAL NOT NULL,
	"x"	REAL,
	"y"	REAL,
	"z"	REAL,
	"date_time"	INTEGER NOT NULL,
	PRIMARY KEY("ID" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "user_balance" (
	"ID"	INTEGER,
	"nick"	TEXT UNIQUE,
	"balance"	INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY("ID" AUTOINCREMENT)
);
CREATE INDEX IF NOT EXISTS "idx_date" ON "snowball_hits" (
	"date_time"
);
CREATE INDEX IF NOT EXISTS "idx_shooter" ON "snowball_hits" (
	"shooter"
);
CREATE INDEX IF NOT EXISTS "idx_shooter_target" ON "snowball_hits" (
	"shooter",
	"target"
);
CREATE INDEX IF NOT EXISTS "idx_target" ON "snowball_hits" (
	"target"
);
COMMIT;
