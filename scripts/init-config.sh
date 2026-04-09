#!/bin/bash
# Создаёт файл с настройками

echo "[VARIABLES]
host = mnrt.teslacraft.org
port = 25565

#Порт для отслежвания состояния клавиатуры/мыши
port_keyboard_event = 8800
active_nick = *НИК_БОТА*

interval_send_cmds = 900
interval_check_surv = 5000

seniors = []
masters = []
master_cmds = ["/swarp", "/warp", "/top"]
ignore_cmds = ["/tca log", "/tca check", "/bal", "/seen"]

#Сервер для РУЧУП
run_local_server = False

[TESLA]
ranks = [null, "Рядовой", "Ефрейтор", "Мл. Сержант", "Сержант", "Ст. Сержант", "Прапорщик", "Ст. Прапорщик", "Лейтенант", "Ст. Лейтенант", "Капитан", "Майор", "Подполковник", "Полковник", "Генерал", "Маршал", "Император"]
price_TCA = 10000

[PROXY]
host = *IP*
port = *PORT*
login = *LOGIN*
password = *PASSWORD*

[*НИК_БОТА*]
bot_password = *ПАРОЛЬ*
bot_pin = *ПИН-КОД*
" > txt/config.ini
