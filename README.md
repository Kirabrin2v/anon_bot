# 🤖 anon_bot

**anon_bot** — это Minecraft-бот, написанный на Node.js с использованием библиотеки Mineflayer.  
Он обладает расширяемой модульной архитектурой, легко запускается через Docker и настраивается всего за несколько шагов.

---

## 🚀 Быстрый старт

---

### 🐧 Установка и запуск на Linux

1. **Обновите систему:**

```bash
sudo apt update && sudo apt upgrade
```

2. **Установите зависимости:**

```bash
sudo apt install git docker-compose
```

3. **Клонируйте репозиторий:**

```bash
git clone https://github.com/Kirabrin2v/anon_bot.git
cd anon_bot
```

4. **Соберите контейнер:**

```bash
docker-compose build
```

5. **Настройте параметры (см. ниже)**

6. **Запустите бота:**

```bash
docker-compose up
```

---

### 🪟 Установка и запуск на Windows

1. **Установите [Git for Windows](https://git-scm.com/download/win)**
2. **Установите [Docker Desktop](https://www.docker.com/products/docker-desktop/)**  
   - После установки перезагрузите систему, если потребуется.  
   - Убедитесь, что Docker работает (иконка кита в трее).
3. **Откройте Git Bash** или Windows Terminal и выполните:

```bash
git clone https://github.com/Kirabrin2v/anon_bot.git
cd anon_bot
docker-compose build
# Настройте параметры (см. ниже)
docker-compose up
```

---

## ⚙️ Настройка проекта

Перед запуском нужно внести несколько обязательных настроек.

### 🔐 1. `txt/config.ini`

Создайте или отредактируйте файл `txt/config.ini`:

```ini
[VARIABLES]
price_TCA = 10000
port_keyboard_event = 8800

[bot_nick]
bot_password = ваш_пароль
bot_pin = ваш_пин_код  ; если используется
```

---

### 📛 2. Укажите ник бота в Minecraft

Откройте файл `new_anon.js` и укажите:

```js
const bot_username = "Ваш_ник";
```

---

### 👑 3. Настройте права доступа

В `new_anon.js` укажите ники пользователей с расширенными правами:

```js
const seniors = ["nick"]; // Полный доступ
const masters = ["nick"]; // Только команды из master-cmds
```

---

## ▶️ Запуск проекта

После всех настроек:

```bash
docker-compose up
```

Бот будет запущен в контейнере и подключится к Minecraft-серверу.

Если нужно остановить:

```bash
docker-compose down
```

---

## 📁 Структура проекта

```
anon_bot/
│
├── new_anon.js            # Главный файл
├── txt/
│   └── config.ini         # Конфигурация авторизации и переменных
├── modules/               # Модули (js, ini, db, json)
├── scripts/               # Скрипты инициализации
├── Dockerfile             # Сборка контейнера
└── docker-compose.yml     # Запуск через Docker Compose
```

---

## 📦 Используемые технологии

- Node.js + Mineflayer
- Docker / Docker Compose
- SQLite3 (с автоинициализацией схем)

---

## ❓ Поддержка

Нашли баг или хотите предложить улучшение?  
Создайте [issue на GitHub](https://github.com/Kirabrin2v/anon_bot/issues).

---

## 📄 Лицензия

Проект распространяется под лицензией **MIT**.
