// Пример кода для Telegram бота
// Файл: telegram-bot/index.ts

import TelegramBot from 'node-telegram-bot-api';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const WEBAPP_URL = process.env.WEBAPP_URL!; // https://your-domain.com

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Команда /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const firstName = msg.from?.first_name;
  const lastName = msg.from?.last_name;
  const username = msg.from?.username;

  // Создаём пользователя в БД
  await fetch(`${WEBAPP_URL}/api/user`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  // Отправляем приветствие с кнопкой WebApp
  await bot.sendMessage(chatId, 
    `👋 Привет, ${firstName}!\n\n` +
    `📌 У тебя сотни сохранённых идей в Pinterest?\n` +
    `😕 Не знаешь, с чего начать?\n\n` +
    `✨ Я помогу превратить мечты в реальные дела!\n\n` +
    `Нажми кнопку ниже, чтобы начать 👇`,
    {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🚀 Открыть приложение',
            web_app: { url: WEBAPP_URL }
          }
        ]],
        resize_keyboard: true
      }
    }
  );
});

// Обработка данных из WebApp
bot.on('web_app_data', async (msg) => {
  const chatId = msg.chat.id;
  const data = msg.web_app_data?.data;

  if (data) {
    const parsed = JSON.parse(data);
    
    if (parsed.action === 'task_completed') {
      await bot.sendMessage(chatId, 
        `🎉 Отлично! Задача выполнена!\n` +
        `+${parsed.points} очков\n` +
        `Уровень: ${parsed.level}`
      );
    }
  }
});

console.log('🤖 Bot is running!');
