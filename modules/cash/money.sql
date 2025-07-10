BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "logs" (
	"ID"	INTEGER,
	"date_time"	TEXT,
	"payer"	TEXT,
	"payee"	TEXT,
	"amount"	INTEGER,
	"currency"	TEXT,
	"reason"	TEXT,
	PRIMARY KEY("ID")
);
COMMIT;
