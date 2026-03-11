import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTelegramMessage, setTelegramWebhook, getMainKeyboard, getMiniAppButton } from '@/lib/telegram'
import { logger } from '@/lib/logger'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8720645134:AAGOCNBOO4MqgfB10C5FfKnx1vg9oO-SuZc'
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://tgpinbot-production.up.railway.app'
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '' // Telegram chat ID админа для поддержки

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from?: {
      id: number
      is_bot: boolean
      first_name: string
      last_name?: string
      username?: string
      language_code?: string
    }
    chat: {
      id: number
      type: string
      first_name?: string
      last_name?: string
      username?: string
    }
    text?: string
  }
  callback_query?: {
    id: string
    from: {
      id: number
      is_bot: boolean
      first_name: string
      last_name?: string
      username?: string
    }
    data?: string
    message?: {
      chat: {
        id: number
      }
    }
  }
}

/**
 * Telegram Webhook Handler
 * Обрабатывает сообщения от пользователей
 */
export async function POST(request: NextRequest) {
  try {
    const body: TelegramUpdate = await request.json()

    await logger.info('telegram', 'Webhook received', { update_id: body.update_id })

    // Обработка обычных сообщений
    if (body.message?.text) {
      const chatId = body.message.chat.id
      const text = body.message.text.trim()
      const textLower = text.toLowerCase()
      const from = body.message.from

      // Команда /start
      if (textLower === '/start') {
        await handleStartCommand(chatId, from)
        return NextResponse.json({ ok: true })
      }

      // Команда /help или кнопка "Помощь"
      if (textLower === '/help' || text === '❓ Помощь') {
        await handleHelpCommand(chatId)
        return NextResponse.json({ ok: true })
      }

      // Команда /stats или кнопка "Моя статистика"
      if (textLower === '/stats' || text === '📊 Моя статистика') {
        await handleStatsCommand(chatId, from?.id)
        return NextResponse.json({ ok: true })
      }

      // Кнопка "Открыть приложение"
      if (text === '📱 Открыть приложение') {
        await handleOpenAppCommand(chatId)
        return NextResponse.json({ ok: true })
      }

      // Кнопка "Техподдержка"
      if (text === '💬 Техподдержка') {
        await handleSupportCommand(chatId, from?.id)
        return NextResponse.json({ ok: true })
      }

      // Если пользователь в режиме написания сообщения в поддержку
      const user = await db.user.findUnique({
        where: { telegramId: String(from?.id) }
      })

      if (user?.botState === 'support:waiting') {
        await handleSupportMessage(chatId, from?.id, text)
        return NextResponse.json({ ok: true })
      }

      // Неизвестная команда
      await sendTelegramMessage({
        chat_id: chatId,
        text: '🤖 Не понимаю эту команду. Используй кнопки внизу экрана!',
        reply_markup: getMainKeyboard(),
      })

      return NextResponse.json({ ok: true })
    }

    // Обработка callback queries (inline кнопки)
    if (body.callback_query) {
      const chatId = body.callback_query.message?.chat.id
      const data = body.callback_query.data
      const callbackId = body.callback_query.id

      if (chatId && data) {
        await logger.info('telegram', 'Callback received', { data, chatId })

        // Ответ на callback (убираем часики)
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: callbackId })
        })
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webhook error:', error)
    await logger.error('telegram', 'Webhook error', { error: String(error) })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

/**
 * GET - Установить webhook
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'setWebhook') {
      const host = request.headers.get('host') || 'tgpinbot-production.up.railway.app'
      const protocol = request.headers.get('x-forwarded-proto') || 'https'
      const webhookUrl = `${protocol}://${host}/api/telegram/webhook`

      const result = await setTelegramWebhook(webhookUrl)

      if (result.ok) {
        await logger.info('telegram', 'Webhook set successfully', { webhookUrl })
        return NextResponse.json({
          success: true,
          message: 'Webhook установлен!',
          webhookUrl,
        })
      } else {
        return NextResponse.json({
          success: false,
          error: result.description,
        }, { status: 400 })
      }
    }

    if (action === 'getMe') {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`)
      const data = await response.json()
      return NextResponse.json(data)
    }

    return NextResponse.json({
      message: 'Telegram Bot Webhook API',
      actions: ['setWebhook', 'getMe'],
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

/**
 * Обработка команды /start
 */
async function handleStartCommand(chatId: number, from?: TelegramUpdate['message']['from']) {
  if (!from) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: '👋 Привет! Я бот для управления идеями из Pinterest.',
      reply_markup: getMainKeyboard(),
    })
    return
  }

  const telegramId = String(from.id)
  const firstName = from.first_name
  const lastName = from.last_name
  const username = from.username

  try {
    const user = await db.user.upsert({
      where: { telegramId },
      create: {
        telegramId,
        telegramChatId: String(chatId),
        firstName,
        lastName,
        username,
      },
      update: {
        telegramChatId: String(chatId),
        firstName,
        lastName,
        username,
      },
    })

    await logger.info('telegram', 'User started bot', {
      telegramId,
      chatId,
      userId: user.id
    })

    const welcomeText = `👋 Привет, ${firstName}!

Я бот <b>Pinterest Ideas</b> — помогаю сохранять идеи и напоминать о задачах!

📌 <b>Что я умею:</b>
• Сохранять идеи из Pinterest
• Напоминать о задачах
• Отслеживать прогресс и достижения

🔔 <b>Уведомления включены!</b>
Теперь я буду присылать напоминания о твоих задачах.

👇 Нажми кнопку ниже, чтобы открыть приложение!`

    // Отправляем приветствие с inline кнопкой для Mini App
    await sendTelegramMessage({
      chat_id: chatId,
      text: welcomeText,
      reply_markup: getMiniAppButton(MINI_APP_URL),
    })

    // Затем отправляем главное меню (Reply Keyboard)
    await sendTelegramMessage({
      chat_id: chatId,
      text: '📱 Используй кнопки внизу для быстрого доступа:',
      reply_markup: getMainKeyboard(),
    })
  } catch (error) {
    console.error('Error in start command:', error)
    await logger.error('telegram', 'Error in start command', { error: String(error), telegramId })

    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Произошла ошибка. Попробуй позже.',
    })
  }
}

/**
 * Обработка кнопки "Открыть приложение"
 */
async function handleOpenAppCommand(chatId: number) {
  const text = `🚀 <b>Открыть приложение</b>

Нажми кнопку ниже, чтобы открыть Mini App:`

  await sendTelegramMessage({
    chat_id: chatId,
    text,
    reply_markup: getMiniAppButton(MINI_APP_URL),
  })
}

/**
 * Обработка команды /help
 */
async function handleHelpCommand(chatId: number) {
  const helpText = `📚 <b>Как пользоваться ботом</b>

📌 <b>Сохранение идей:</b>
1. Открой приложение через кнопку
2. Вставь ссылку из Pinterest
3. Идея сохранится автоматически!

✅ <b>Задачи и напоминания:</b>
1. Создай задачу в приложении
2. Укажи время напоминания
3. Получи уведомление вовремя!

⭐ <b>Очки и уровни:</b>
• +10 очков за сохранение идеи
• +5-15 очков за выполнение задачи
• Открывай достижения!

👑 <b>Premium:</b>
• Умные напоминания
• Двойные очки
• Эксклюзивные достижения

💡 <b>Подсказка:</b> Используй кнопки внизу экрана для быстрой навигации!`

  await sendTelegramMessage({
    chat_id: chatId,
    text: helpText,
    reply_markup: getMainKeyboard(),
  })
}

/**
 * Обработка команды /stats
 */
async function handleStatsCommand(chatId: number, telegramUserId?: number) {
  if (!telegramUserId) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Не могу определить твой аккаунт.',
      reply_markup: getMainKeyboard(),
    })
    return
  }

  try {
    const user = await db.user.findUnique({
      where: { telegramId: String(telegramUserId) },
      include: {
        _count: {
          select: {
            pins: true,
            tasks: { where: { status: 'completed' } },
          },
        },
      },
    })

    if (!user) {
      await sendTelegramMessage({
        chat_id: chatId,
        text: '❌ Аккаунт не найден. Напиши /start для регистрации.',
        reply_markup: getMainKeyboard(),
      })
      return
    }

    const statsText = `📊 <b>Твоя статистика</b>

⭐ Очки: <b>${user.points}</b>
🆙 Уровень: <b>${user.level}</b>

📌 Сохранено идей: <b>${user._count.pins}</b>
✅ Выполнено задач: <b>${user._count.tasks}</b>
${user.isPremium ? '\n👑 Статус: <b>Premium</b>' : ''}

🚀 Продолжай в том же духе!`

    await sendTelegramMessage({
      chat_id: chatId,
      text: statsText,
      reply_markup: getMainKeyboard(),
    })
  } catch (error) {
    console.error('Error in stats command:', error)
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Ошибка получения статистики.',
      reply_markup: getMainKeyboard(),
    })
  }
}

/**
 * Обработка кнопки "Техподдержка"
 */
async function handleSupportCommand(chatId: number, telegramUserId?: number) {
  if (!telegramUserId) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Не могу определить твой аккаунт.',
      reply_markup: getMainKeyboard(),
    })
    return
  }

  try {
    // Устанавливаем режим ожидания сообщения
    await db.user.update({
      where: { telegramId: String(telegramUserId) },
      data: { botState: 'support:waiting' }
    })

    const supportText = `💬 <b>Техподдержка</b>

Напиши своё сообщение или вопрос, и я передам его команде поддержки!

📝 <i>Опиши проблему как можно подробнее.</i>

⚠️ <i>Отправка сообщения отменит текущие напоминания.</i>
Чтобы отменить — нажми любую кнопку меню.`

    await sendTelegramMessage({
      chat_id: chatId,
      text: supportText,
    })
  } catch (error) {
    console.error('Error in support command:', error)
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Ошибка. Попробуй позже.',
      reply_markup: getMainKeyboard(),
    })
  }
}

/**
 * Обработка сообщения в поддержку
 */
async function handleSupportMessage(chatId: number, telegramUserId: number | undefined, message: string) {
  if (!telegramUserId || !ADMIN_CHAT_ID) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Не удалось отправить сообщение. Попробуй позже.',
      reply_markup: getMainKeyboard(),
    })
    
    // Сбрасываем состояние
    if (telegramUserId) {
      await db.user.update({
        where: { telegramId: String(telegramUserId) },
        data: { botState: null }
      })
    }
    return
  }

  try {
    // Получаем информацию о пользователе
    const user = await db.user.findUnique({
      where: { telegramId: String(telegramUserId) }
    })

    if (!user) {
      await sendTelegramMessage({
        chat_id: chatId,
        text: '❌ Аккаунт не найден.',
        reply_markup: getMainKeyboard(),
      })
      return
    }

    // Формируем сообщение для админа
    const adminMessage = `📩 <b>Сообщение в поддержку</b>

👤 <b>Пользователь:</b> ${user.firstName || 'Без имени'} ${user.lastName || ''}
🆔 <b>Username:</b> ${user.username ? '@' + user.username : 'нет'}
📌 <b>ID:</b> <code>${telegramUserId}</code>
${user.isPremium ? '👑 Premium\n' : ''}

💬 <b>Сообщение:</b>
${message}

---
💬 <i>Чтобы ответить, перешли это сообщение пользователю или напиши напрямую.</i>`

    // Отправляем админу
    await sendTelegramMessage({
      chat_id: ADMIN_CHAT_ID,
      text: adminMessage,
    })

    // Подтверждение пользователю
    await sendTelegramMessage({
      chat_id: chatId,
      text: `✅ <b>Сообщение отправлено!</b>

Спасибо за обращение! Команда поддержки ответит тебе в ближайшее время.

📧 Обычно мы отвечаем в течение 24 часов.`,
      reply_markup: getMainKeyboard(),
    })

    // Сбрасываем состояние
    await db.user.update({
      where: { telegramId: String(telegramUserId) },
      data: { botState: null }
    })

    await logger.info('telegram', 'Support message sent', {
      telegramUserId,
      messageLength: message.length
    })
  } catch (error) {
    console.error('Error sending support message:', error)
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Ошибка отправки. Попробуй позже.',
      reply_markup: getMainKeyboard(),
    })

    // Сбрасываем состояние
    await db.user.update({
      where: { telegramId: String(telegramUserId) },
      data: { botState: null }
    })
  }
}
