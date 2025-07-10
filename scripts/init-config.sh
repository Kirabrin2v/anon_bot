#!/bin/bash
# Создаёт файл с настройками

echo "[VARIABLES]
price_TCA = 10000
#Порт для отслежвания состояния клавиатуры/мыши
port_keyboard_event = 8800

#Вставить свои данные
[bot_nick]
bot_password = bot_password
bot_pin = bot_pin" > txt/config.ini
