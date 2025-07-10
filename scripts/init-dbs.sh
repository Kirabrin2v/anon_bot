#!/bin/bash
# Для каждого .sql-файла создаёт пустую БД с указанной структурой

find ./modules -name '*.sql' | while read schema; do
    db_path="${schema%.sql}.db"
    echo "Creating DB: $db_path"
    sqlite3 "$db_path" < "$schema"
done
