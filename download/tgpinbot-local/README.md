# Pinterest to Action - Telegram Mini App

## Быстрый старт

### 1. Установи Node.js или Bun
- Node.js: https://nodejs.org/ (версия 18+)
- Bun: https://bun.sh/ (быстрее)

### 2. Установка зависимостей
```bash
npm install
# или
bun install
```

### 3. Настрой базы данных
```bash
# Скопируй .env.example в .env
cp .env.example .env

# Создай базу данных
npx prisma db push
# или
bunx prisma db push
```

### 4. Запусти
```bash
npm run dev
# или
bun run dev
```

### 5. Открой в браузере
http://localhost:3000

## Функции
- ✅ Сохранение пинов из Pinterest
- ✅ Автоматическое извлечение изображений
- ✅ Задачи с напоминаниями
- ✅ AI категоризация
- ✅ Система очков и уровней

## Для продакшена
1. Создай базу на Supabase
2. Добавь DATABASE_URL и DIRECT_URL в .env
3. Задеплой на Vercel/Railway
