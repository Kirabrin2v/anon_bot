BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "logs" (
	"ID"	INTEGER,
	"date_time"	TEXT,
	"name_bank"	TEXT,
	"nickname"	TEXT,
	"amount"	INTEGER,
	"currency"	TEXT,
	PRIMARY KEY("ID")
);
CREATE TABLE IF NOT EXISTS "bank" (
	"ID"	INTEGER,
	"name_bank"	TEXT,
	"main_password"	TEXT,
	"visitor_password"	TEXT,
	PRIMARY KEY("ID" AUTOINCREMENT)
);
COMMIT;
