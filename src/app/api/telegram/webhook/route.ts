import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTelegramMessage, setTelegramWebhook } from '@/lib/telegram'
import { logger } from '@/lib/logger'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8720645134:AAGOCNBOO4MqgfB10C5FfKnx1vg9oO-SuZc'

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
      const text = body.message.text.trim().toLowerCase()
      const from = body.message.from

      // Команда /start
      if (text === '/start') {
        await handleStartCommand(chatId, from)
        return NextResponse.json({ ok: true })
      }

      // Команда /help
      if (text === '/help') {
        await handleHelpCommand(chatId)
        return NextResponse.json({ ok: true })
      }

      // Команда /stats
      if (text === '/stats') {
        await handleStatsCommand(chatId, from?.id)
        return NextResponse.json({ ok: true })
      }

      // Неизвестная команда
      await sendTelegramMessage({
        chat_id: chatId,
        text: '🤖 Не понимаю эту команду. Напиши /help для списка команд.',
      })
      
      return NextResponse.json({ ok: true })
    }

    // Обработка callback queries (кнопки)
    if (body.callback_query) {
      const chatId = body.callback_query.message?.chat.id
      const data = body.callback_query.data
      
      if (chatId && data) {
        await logger.info('telegram', 'Callback received', { data, chatId })
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

👇 Открой Mini App через кнопку ниже или напиши /help для списка команд.`

    await sendTelegramMessage({
      chat_id: chatId,
      text: welcomeText,
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
 * Обработка команды /help
 */
async function handleHelpCommand(chatId: number) {
  const helpText = `📚 <b>Команды бота:</b>

/start — Начать работу и включить уведомления
/help — Показать эту справку
/stats — Твоя статистика

📌 <b>Как пользоваться:</b>
1. Открой Mini App через кнопку в меню
2. Добавляй идеи из Pinterest
3. Создавай задачи с напоминаниями
4. Получай уведомления вовремя!

💡 Вопросы? Пиши в поддержку!`

  await sendTelegramMessage({
    chat_id: chatId,
    text: helpText,
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
      })
      return
    }

    const statsText = `📊 <b>Твоя статистика</b>

⭐ Очки: <b>${user.points}</b>
🆙 Уровень: <b>${user.level}</b>

📌 Сохранено идей: <b>${user._count.pins}</b>
✅ Выполнено задач: <b>${user._count.tasks}</b>
${user.isPremium ? '\n👑 Статус: <b>Premium</b>' : ''}

Продолжай в том же духе! 🚀`

    await sendTelegramMessage({
      chat_id: chatId,
      text: statsText,
    })
  } catch (error) {
    console.error('Error in stats command:', error)
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Ошибка получения статистики.',
    })
  }
}
