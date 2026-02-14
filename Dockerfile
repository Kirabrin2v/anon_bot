FROM node:20

# Создаём рабочую директорию
WORKDIR /app

# Устанавливаем зависимости
COPY package*.json ./
RUN npm install
RUN npm install -g forever

# Копируем весь проект
COPY . .

# Устанавливаем SQLite3
RUN apt-get update && apt-get install -y sqlite3

# Создаём БД по шаблонам
RUN chmod +x scripts/init-dbs.sh && ./scripts/init-dbs.sh

# Создаём необходимые для модулей файлы
RUN chmod +x scripts/init-quiz.sh && ./scripts/init-quiz.sh
RUN chmod +x scripts/init-quotes.sh && ./scripts/init-quotes.sh
RUN chmod +x scripts/init-SAGO.sh && ./scripts/init-SAGO.sh
RUN chmod +x scripts/init-config.sh && ./scripts/init-config.sh
RUN chmod +x scripts/init-gpt.sh && ./scripts/init-gpt.sh

CMD ["forever", "new_anon.js"]
