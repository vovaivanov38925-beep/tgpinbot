import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { 
  sendTelegramMessage, 
  setTelegramWebhook,
  sendPinterestSyncNotification,
  sendPinterestSyncError,
  sendConnectedBoardsList
} from '@/lib/telegram'
import { logger } from '@/lib/logger'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8720645134:AAGOCNBOO4MqgfB10C5FfKnx1vg9oO-SuZc'

/**
 * Отправить сообщение с клавиатурой меню
 */
async function sendTelegramMessageWithKeyboard(chatId: number, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          keyboard: [
            [
              { text: '📥 Синхронизировать доску' },
              { text: '📥 Мои доски' }
            ],
            [
              { text: '📊 Моя статистика' },
              { text: '❓ Помощь' }
            ]
          ],
          resize_keyboard: true,
          one_time_keyboard: false,
        },
      }),
    })

    return await response.json()
  } catch (error) {
    console.error('Failed to send message with keyboard:', error)
    // Fallback to simple message
    return sendTelegramMessage({ chat_id: chatId, text })
  }
}

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

      // Команда /stats или кнопка "Моя статистика"
      if (text === '/stats' || text.includes('моя статистика')) {
        await handleStatsCommand(chatId, from?.id)
        return NextResponse.json({ ok: true })
      }

      // Команда /help или кнопка "Помощь"
      if (text === '/help' || text.includes('помощь')) {
        await handleHelpCommand(chatId)
        return NextResponse.json({ ok: true })
      }

      // Команда /sync или кнопка "Синхронизировать доску"
      if (text === '/sync' || text.includes('синхронизировать')) {
        await handleSyncRequest(chatId)
        return NextResponse.json({ ok: true })
      }

      // Команда /boards или кнопка "Мои доски"
      if (text === '/boards' || text.includes('мои доски')) {
        await handleMyBoardsCommand(chatId, from?.id)
        return NextResponse.json({ ok: true })
      }

      // Проверка на ссылку Pinterest доски
      if (text.includes('pinterest.')) {
        await handlePinterestUrl(chatId, body.message.text.trim(), from?.id)
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
async function handleStartCommand(chatId: number, from?: { id: number; is_bot: boolean; first_name: string; last_name?: string; username?: string; language_code?: string }) {
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
• Синхронизировать доски Pinterest
• Напоминать о задачах
• Отслеживать прогресс и достижения

🔔 <b>Уведомления включены!</b>
Теперь я буду присылать напоминания о твоих задачах.

👇 Открой Mini App через кнопку в меню или используй кнопки ниже!`

    // Отправляем сообщение с клавиатурой
    await sendTelegramMessageWithKeyboard(chatId, welcomeText)
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
/sync — Синхронизировать доску Pinterest
/boards — Список подключённых досок

📌 <b>Как пользоваться:</b>
1. Открой Mini App через кнопку в меню
2. Добавляй идеи из Pinterest
3. Синхронизируй свои доски Pinterest
4. Создавай задачи с напоминаниями
5. Получай уведомления вовремя!

📥 <b>Синхронизация Pinterest:</b>
Просто отправь ссылку на публичную доску Pinterest:
pinterest.com/username/board-name

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

/**
 * Запрос на синхронизацию - показать инструкции
 */
async function handleSyncRequest(chatId: number) {
  const text = `📥 <b>Синхронизация с Pinterest</b>

Чтобы импортировать идеи из доски Pinterest:

1️⃣ Открой доску в Pinterest
2️⃣ Скопируй ссылку на доску
3️⃣ Отправь ссылку мне в чат

<b>Формат ссылки:</b>
pinterest.com/username/board-name

💡 Все пины с доски будут добавлены в твою коллекцию!`

  await sendTelegramMessage({ chat_id: chatId, text })
}

/**
 * Показать подключённые доски пользователя
 */
async function handleMyBoardsCommand(chatId: number, telegramUserId?: number) {
  if (!telegramUserId) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Не могу определить твой аккаунт. Напиши /start',
    })
    return
  }

  try {
    const user = await db.user.findUnique({
      where: { telegramId: String(telegramUserId) },
      include: {
        pinterestBoards: {
          orderBy: { lastSyncAt: 'desc' },
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

    await sendConnectedBoardsList(chatId, user.pinterestBoards)
  } catch (error) {
    console.error('Error in boards command:', error)
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Ошибка получения списка досок.',
    })
  }
}

/**
 * Обработка ссылки на Pinterest доску - синхронизация
 */
async function handlePinterestUrl(chatId: number, originalUrl: string, telegramUserId?: number) {
  if (!telegramUserId) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Не могу определить твой аккаунт. Напиши /start для регистрации.',
    })
    return
  }

  // Отправляем сообщение о начале синхронизации
  await sendTelegramMessage({
    chat_id: chatId,
    text: '🔄 <b>Начинаю синхронизацию...</b>\n\nЭто может занять несколько секунд.',
  })

  try {
    // Находим пользователя
    const user = await db.user.findUnique({
      where: { telegramId: String(telegramUserId) },
    })

    if (!user) {
      await sendTelegramMessage({
        chat_id: chatId,
        text: '❌ Аккаунт не найден. Напиши /start для регистрации.',
      })
      return
    }

    // Скрейпим доску Pinterest
    const scrapeResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://tgpinbot-production.up.railway.app'}/api/pinterest/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardUrl: originalUrl }),
    })

    const scrapeResult = await scrapeResponse.json()

    if (!scrapeResult.success || scrapeResult.pins.length === 0) {
      await sendPinterestSyncError(chatId, scrapeResult.error || 'Не удалось найти пины на доске')
      return
    }

    // Синхронизируем пины с базой
    const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://tgpinbot-production.up.railway.app'}/api/pinterest/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        boardUrl: originalUrl,
        pins: scrapeResult.pins,
        boardName: scrapeResult.boardName,
        boardUsername: scrapeResult.boardUsername,
      }),
    })

    const syncResult = await syncResponse.json()

    if (!syncResult.success) {
      await sendPinterestSyncError(chatId, syncResult.error || 'Ошибка синхронизации')
      return
    }

    // Отправляем уведомление о результате
    await sendPinterestSyncNotification(
      chatId,
      syncResult.board?.name || scrapeResult.boardName,
      syncResult.totalPins,
      syncResult.newPinsAdded,
      syncResult.pointsEarned
    )

    await logger.info('telegram', 'Pinterest board synced', {
      telegramUserId,
      boardUrl: originalUrl,
      pinsCount: scrapeResult.pins.length,
      newPins: syncResult.newPinsAdded,
    })
  } catch (error) {
    console.error('Error syncing Pinterest board:', error)
    await sendPinterestSyncError(chatId, 'Произошла ошибка при синхронизации. Попробуй позже.')
    await logger.error('telegram', 'Pinterest sync error', { error: String(error), telegramUserId })
  }
}
