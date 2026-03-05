# 🚀 Инструкция по запуску Pinterest-to-Action Bot

## Что нужно для запуска

### 1️⃣ База данных PostgreSQL (Supabase)

**Почему не SQLite?**
SQLite хранит данные в файле. На Vercel файлы нельзя изменять — они только для чтения. Поэтому нужна облачная база.

**Настройка Supabase:**

1. Зайди на [supabase.com](https://supabase.com) и авторизуйся через GitHub
2. Нажми **"New Project"**
3. Заполни:
   - Name: `pinterest-action-bot`
   - Database Password: **сохрани этот пароль!**
   - Region: выбери ближайший (Europe West или Singapore)
4. Нажми **"Create new project"** и подожди ~2 минуты

5. Получи строку подключения:
   - Зайди в **Project Settings** → **Database**
   - В разделе **Connection string** выбери **URI**
   - Скопируй строку вида: `postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres`
   - Замени `[YOUR-PASSWORD]` на свой пароль из шага 3

6. Добавь в `.env`:
```bash
DATABASE_URL="postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres"
```

---

### 2️⃣ Telegram Bot Token

1. Открой [@BotFather](https://t.me/BotFather) в Telegram
2. Отправь `/newbot`
3. Придумай имя бота (например: "Pinterest Action Bot")
4. Придумай username (например: `PinterestActionBot`)
5. **Скопируй токен** вида: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

6. Добавь в `.env`:
```bash
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
```

---

### 3️⃣ Инициализация базы данных

После настройки `.env` выполни:

```bash
cd /home/z/my-project

# Создать миграции и применить к базе
bunx prisma migrate dev --name init

# Заполнить достижения (если есть seed)
bunx prisma db seed
```

---

### 4️⃣ Деплой на Vercel

1. Зайди на [vercel.com](https://vercel.com) и авторизуйся через GitHub
2. Нажми **"Add New..."** → **"Project"**
3. Импортируй свой репозиторий
4. В разделе **Environment Variables** добавь:
   - `DATABASE_URL` — строка из Supabase
   - `TELEGRAM_BOT_TOKEN` — токен от BotFather
5. Нажми **"Deploy"**
6. После деплоя скопируй URL (например: `https://pinterest-action-bot.vercel.app`)

---

### 5️⃣ Настройка Mini App в Telegram

Теперь нужно связать бота с твоим WebApp:

1. Открой [@BotFather](https://t.me/BotFather)
2. Отправь `/myapps`
3. Выбери **"Create New App"**
4. Заполни:
   - App title: `Pinterest Action`
   - Short name: `pinterestaction`
   - Web App URL: `https://твой-домен.vercel.app`
5. Получишь `link` вида: `https://t.me/твой_бот?startapp=xxx`

Теперь можно добавить кнопку Menu Button:
```
/setmenubutton
Выбери бота
Введи текст: "Открыть пины 📌"
Введи URL: https://твой-домен.vercel.app
```

---

## 🏃 Локальный запуск (для разработки)

```bash
# Установить зависимости
bun install

# Сгенерировать Prisma клиент
bunx prisma generate

# Применить миграции
bunx prisma migrate dev

# Запустить dev сервер
bun run dev
```

Приложение будет доступно на `http://localhost:3000`

---

## 📋 Чек-лист перед запуском

- [ ] Создан проект в Supabase
- [ ] Получена строка подключения DATABASE_URL
- [ ] Создан бот через @BotFather
- [ ] Получен токен TELEGRAM_BOT_TOKEN
- [ ] Выполнены миграции (`prisma migrate deploy`)
- [ ] Засеяны достижения (`prisma db seed`)
- [ ] Проект задеплоен на Vercel
- [ ] Настроен Mini App в @BotFather
- [ ] Добавлена Menu Button

---

## 🔧 Структура .env файла

```bash
# База данных PostgreSQL (Supabase)
DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres"

# Telegram Bot Token
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"

# URL приложения (автоматически на Vercel)
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
NEXTAUTH_SECRET="random-string-32-chars"
NEXTAUTH_URL="https://your-app.vercel.app"
```

---

## ❓ Возможные проблемы

### Ошибка "Can't reach database server"
- Проверь правильность DATABASE_URL
- Убедись, что проект в Supabase не на паузе
- Проверь, что IP не заблокирован (Supabase → Settings → Database → Connection Pooling)

### Ошибка "Prisma Client could not be generated"
```bash
bunx prisma generate
```

### На Vercel не работают API routes
- Проверь, что все переменные окружения добавлены в Vercel
- Проверь логи в Vercel Dashboard → Deployments → Function Logs

---

## 💰 Стоимость

- **Supabase Free Tier**: 500 MB базы, 5 GB bandwidth — достаточно для старта
- **Vercel Free Tier**: 100 GB bandwidth, неограниченные деплои
- **Telegram Mini App**: бесплатно

**Итого: $0/месяц для MVP!** 🎉
