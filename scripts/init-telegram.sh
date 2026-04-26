#!/bin/bash
# Создаёт конфиг для модуля telegram

echo '[VARIABLES]
tg_key = *Токен, полученный у BotFather*

#Айди чатов, в которые будут приходить уведомления и который имеет полный доступ к боту
seniors = []
#Айди чатов, которые имеют повышенные привилегии
masters = []

base_server_cmds = ["lookup", "seen", "near"]
#Название команды - ключ, а индекс списка, в котором находится айди, во внешнем списке - уровень доступа к команде
access_lvls = {"tracker": [[], []], "detector": [[], []], "notify": [[], []]}' > modules/telegram/config.ini

echo '[*tg_id*]
chat_on=true
punishments_on=true
whitelist_on=false
whitelist_nicks=[]
blacklist_on=false
blacklist_nicks=[]
nick=Брин
notify_aliases=[]
allowed_chats=["Лк","Гл","Клан-чат","Пати-чат","Приват"]
' > modules/telegram/player_settings.ini

echo > modules/telegram/cmds/events/manage_events.txt