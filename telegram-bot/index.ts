import TelegramBot from 'node-telegram-bot-api';
import 'dotenv/config';

// Конфигурация
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBAPP_URL = process.env.WEBAPP_URL || 'http://localhost:3000';

if (!BOT_TOKEN) {
  console.error('❌ Ошибка: Установите TELEGRAM_BOT_TOKEN в .env');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ============= КОМАНДЫ =============

// /start - Приветствие
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from!;

  console.log(`👤 Новый пользователь: ${user.first_name} (@${user.username})`);

  await bot.sendMessage(chatId, 
    `👋 *Привет, ${user.first_name}!*\n\n` +
    `📌 У тебя сотни сохранённых идей в Pinterest?\n` +
    `😕 Не знаешь, с чего начать?\n` +
    `😩 Мечты остаются просто картинками?\n\n` +
    `✨ *Pinterest to Action* превратит твои сохранёнки в реальные дела!\n\n` +
    `🎯 Что умеет бот:\n` +
    `• 📎 Сохранять идеи из Pinterest\n` +
    `• 🤖 AI сам определит категорию\n` +
    `• ⏰ Напомнит о задачах\n` +
    `• 🏆 Наградит за выполнение\n\n` +
    `Нажми кнопку ниже, чтобы начать 👇`,
    {
      parse_mode: 'Markdown',
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

// /help - Помощь
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(chatId,
    `📚 *Как пользоваться ботом*\n\n` +
    `1️⃣ *Сохраняй идеи*\n` +
    `   Нажми "Добавить" и вставь ссылку из Pinterest\n\n` +
    `2️⃣ *Создавай задачи*\n` +
    `   Превращай сохранёнки в конкретные дела\n\n` +
    `3️⃣ *Получай напоминания*\n` +
    `   Бот напомнит в нужное время\n\n` +
    `4️⃣ *Выполняй и получай награды*\n` +
    `   Очки, уровни, достижения!\n\n` +
    `💎 *Premium:* безлимит пинов и двойные очки`,
    { parse_mode: 'Markdown' }
  );
});

// /premium - Информация о подписке
bot.onText(/\/premium/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(chatId,
    `👑 *Premium подписка*\n\n` +
    `✨ *Преимущества:*\n` +
    `• ♾️ Безлимитные пины\n` +
    `• ⏰ Безлимитные напоминания\n` +
    `• 🎯 Двойные очки за всё\n` +
    `• 🏆 Эксклюзивные достижения\n\n` +
    `💰 *Тарифы:*\n` +
    `• Месяц — 299₽\n` +
    `• Год — 1 999₽ (выгода 40%)\n` +
    `• Навсегда — 4 999₽\n\n` +
    `Для оформления напишите @your_support`,
    { parse_mode: 'Markdown' }
  );
});

// /stats - Статистика пользователя
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id.toString();

  try {
    const response = await fetch(`${WEBAPP_URL}/api/user?telegramId=${telegramId}`);
    const user = await response.json();

    await bot.sendMessage(chatId,
      `📊 *Твоя статистика*\n\n` +
      `⭐ Уровень: ${user.level}\n` +
      `⚡ Очки: ${user.points}\n` +
      `📌 Пинов: ${user._count?.pins || 0}\n` +
      `✅ Задач выполнено: ${user._count?.tasks || 0}\n` +
      `👑 Premium: ${user.isPremium ? 'Да' : 'Нет'}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    await bot.sendMessage(chatId, '❌ Ошибка получения статистики');
  }
});

// ============= WEBAPP DATA =============

bot.on('web_app_data', async (msg) => {
  const chatId = msg.chat.id;
  const data = msg.web_app_data?.data;

  if (!data) return;

  try {
    const parsed = JSON.parse(data);

    switch (parsed.action) {
      case 'task_completed':
        await bot.sendMessage(chatId,
          `🎉 *Отлично!*\n\n` +
          `✅ Задача выполнена\n` +
          `⚡ +${parsed.points} очков\n` +
          `⭐ Уровень: ${parsed.level}`,
          { parse_mode: 'Markdown' }
        );
        break;

      case 'pin_added':
        await bot.sendMessage(chatId,
          `📌 *Новая идея сохранена!*\n\n` +
          `🏷 Категория: ${parsed.category}\n` +
          `⚡ +10 очков`,
          { parse_mode: 'Markdown' }
        );
        break;

      case 'achievement_unlocked':
        await bot.sendMessage(chatId,
          `🏆 *Достижение разблокировано!*\n\n` +
          `${parsed.icon} ${parsed.name}\n` +
          `${parsed.description}\n` +
          `⚡ +${parsed.points} очков`,
          { parse_mode: 'Markdown' }
        );
        break;

      case 'premium_purchase':
        await bot.sendMessage(chatId,
          `👑 *Premium активирован!*\n\n` +
          `✨ Добро пожаловать в клуб!\n` +
          `Все премиум функции доступны.`,
          { parse_mode: 'Markdown' }
        );
        break;
    }
  } catch (error) {
    console.error('WebApp data error:', error);
  }
});

// ============= НАПОМИНАНИЯ =============

// Функция отправки напоминания
export async function sendReminder(telegramId: string, task: {
  title: string;
  description?: string;
  category?: string;
}) {
  const categoryEmoji: Record<string, string> = {
    recipe: '🍳',
    fashion: '👗',
    home: '🏠',
    fitness: '🧘‍♀️',
    diy: '🎨',
    travel: '✈️',
    beauty: '✨'
  };

  const emoji = categoryEmoji[task.category || ''] || '📌';

  await bot.sendMessage(telegramId.toString(),
    `⏰ *Напоминание!*\n\n` +
    `${emoji} *${task.title}*\n` +
    `${task.description || ''}\n\n` +
    `Нажми кнопку, чтобы открыть 👇`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '📱 Открыть приложение',
            web_app: { url: WEBAPP_URL }
          }
        ], [
          {
            text: '✅ Выполнено',
            callback_data: `done_${Date.now()}`
          }
        ]]
      }
    }
  );
}

// Обработка callback кнопок
bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat.id;
  const data = query.data;

  if (data?.startsWith('done_')) {
    await bot.answerCallbackQuery(query.id, {
      text: '🎉 Отлично! +5 очков!',
      show_alert: false
    });

    if (chatId) {
      await bot.sendMessage(chatId, 
        '✅ Задача отмечена как выполненная!'
      );
    }
  }
});

// ============= ЗАПУСК =============

console.log('');
console.log('🤖 Pinterest to Action Bot запущен!');
console.log(`🌐 WebApp URL: ${WEBAPP_URL}`);
console.log('');

// Экспорт для использования в других модулях
export { bot };
