# 🚀 Запуск Pinterest-to-Action Bot

## 📋 Требования

- Node.js 18+ или Bun
- Telegram аккаунт
- (Опционально) ngrok для локальной разработки

---

## ⚡ Быстрый старт

### 1. Создать Telegram бота

```
Откройте @BotFather в Telegram:

→ /newbot
← Название бота?
→ Pinterest to Action
← Username бота?
→ pinterest_action_bot (или свой)
← Готово! Сохраните токен.
```

### 2. Настроить переменные окружения

Создайте файл `.env` в корне проекта:

```env
TELEGRAM_BOT_TOKEN=123456789:ABC-DEF...
WEBAPP_URL=https://your-app.vercel.app
DATABASE_URL="file:./db/custom.db"
```

### 3. Запустить WebApp

```bash
# Установить зависимости (если ещё нет)
bun install

# Применить миграции БД
bun run db:push

# Заполнить достижения
bunx tsx prisma/seed.ts

# Запустить сервер
bun run dev
```

Приложение будет доступно на http://localhost:3000

### 4. Получить публичный URL

**Вариант А: ngrok (для разработки)**
```bash
ngrok http 3000
# Скопируйте https://xxxx.ngrok.io
```

**Вариант Б: Vercel (для продакшена)**
```bash
vercel
# Получите https://your-app.vercel.app
```

### 5. Настроить WebApp в боте

В @BotFather:

```
→ /setmenubutton
← Выберите бота
→ pinterest_action_bot
← Текст кнопки
→ 🚀 Открыть приложение
← URL
→ https://your-url.com
```

### 6. Запустить Telegram бота

```bash
cd telegram-bot
bun install
bun run index.ts
```

---

## 🌐 Развёртывание на Vercel

### 1. Установить Vercel CLI
```bash
bun install -g vercel
```

### 2. Деплой
```bash
vercel
```

### 3. Настроить переменные окружения

В dashboard Vercel добавьте:
- `TELEGRAM_BOT_TOKEN`
- `WEBAPP_URL` (URL вашего Vercel приложения)
- `DATABASE_URL` (или используйте Vercel Postgres)

### 4. Обновить URL в боте

В @BotFather обновите Menu Button URL на новый.

---

## 📁 Структура проекта

```
├── src/
│   ├── app/
│   │   ├── page.tsx          # WebApp интерфейс
│   │   ├── api/              # API endpoints
│   │   │   ├── user/         # Пользователи
│   │   │   ├── pins/         # Пины
│   │   │   ├── tasks/        # Задачи
│   │   │   ├── achievements/ # Достижения
│   │   │   ├── reminders/    # Напоминания
│   │   │   └── ai/           # AI-категоризация
│   └── lib/
│       ├── db.ts             # Prisma клиент
│       └── store.ts          # Zustand store
├── telegram-bot/
│   └── index.ts              # Telegram бот
├── prisma/
│   ├── schema.prisma         # Схема БД
│   └── seed.ts               # Начальные данные
└── .env                       # Переменные окружения
```

---

## 🔧 API Endpoints

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/api/user` | GET | Получить/создать пользователя |
| `/api/pins` | GET/POST | Пины пользователя |
| `/api/tasks` | GET/POST/PATCH | Задачи |
| `/api/achievements` | GET/POST | Достижения |
| `/api/reminders` | GET | Напоминания |
| `/api/ai/categorize` | GET/POST | AI-категоризация |

---

## 📱 Функции бота

### Команды:
- `/start` - Приветствие + кнопка WebApp
- `/help` - Помощь
- `/premium` - Информация о подписке
- `/stats` - Статистика пользователя

### Напоминания:
Бот отправляет уведомления в Telegram в указанное время:
```
⏰ Напоминание!

🍳 Приготовить торт
Попробовать рецепт из Pinterest

[Открыть приложение] [✅ Выполнено]
```

---

## 🎮 Геймификация

| Действие | Очки |
|----------|------|
| Сохранение пина | +10 |
| Выполнение задачи | +5 |
| Достижение | +10-500 |

### Уровни:
- Каждые 100 очков = новый уровень
- Premium = двойные очки

---

## 💎 Premium

| План | Цена | Особенности |
|------|------|-------------|
| Месяц | 299₽ | Безлимит пинов |
| Год | 1 999₽ | -40% скидка |
| Навсегда | 4 999₽ | Один раз |

---

## 🐛 Отладка

```bash
# Проверить код
bun run lint

# Посмотреть логи БД
bunx prisma studio

# Тест API
curl http://localhost:3000/api/user?telegramId=test123
```

---

## 📞 Поддержка

При возникновении проблем проверьте:
1. Правильность TELEGRAM_BOT_TOKEN
2. Доступность WEBAPP_URL из интернета
3. Правильность настройки Menu Button в BotFather
