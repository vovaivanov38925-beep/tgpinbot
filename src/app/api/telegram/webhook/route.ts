import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTelegramMessage, setTelegramWebhook, getMainKeyboard, getMiniAppButton } from '@/lib/telegram'
import { logger } from '@/lib/logger'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const MINI_APP_URL = process.env.MINI_APP_URL!
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID! // Telegram chat ID админа для поддержки

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
      message_id: number
    }
  }
}

// Категории для поддержки
const SUPPORT_CATEGORIES = {
  general: { label: '📢 Общий вопрос', emoji: '📢' },
  bug: { label: '🐛 Баг/Ошибка', emoji: '🐛' },
  feature: { label: '💡 Предложение', emoji: '💡' },
  payment: { label: '💳 Оплата', emoji: '💳' },
  account: { label: '👤 Аккаунт', emoji: '👤' },
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

      // Кнопка "Мои обращения"
      if (text === '📋 Мои обращения') {
        await handleMyTicketsCommand(chatId, from?.id)
        return NextResponse.json({ ok: true })
      }

      // Проверяем состояние пользователя в базе
      const user = await db.user.findUnique({
        where: { telegramId: String(from?.id) }
      })

      if (user?.botState) {
        // Если пользователь выбирает категорию
        if (user.botState === 'support:select_category') {
          const categoryKey = Object.keys(SUPPORT_CATEGORIES).find(
            key => text === SUPPORT_CATEGORIES[key as keyof typeof SUPPORT_CATEGORIES].label
          )
          if (categoryKey) {
            await handleCategorySelection(chatId, from?.id, categoryKey)
            return NextResponse.json({ ok: true })
          }
          // Если нажали кнопку меню - отмена
          if (text === '❌ Отмена') {
            await db.user.update({
              where: { telegramId: String(from?.id) },
              data: { botState: null }
            })
            await sendTelegramMessage({
              chat_id: chatId,
              text: '❌ Создание обращения отменено.',
              reply_markup: getMainKeyboard(),
            })
            return NextResponse.json({ ok: true })
          }
        }

        // Если пользователь пишет сообщение в поддержку (после выбора категории)
        if (user.botState.startsWith('support:waiting')) {
          await handleSupportMessage(chatId, from?.id, text)
          return NextResponse.json({ ok: true })
        }

        // Если пользователь отвечает на тикет
        if (user.botState.startsWith('support:reply:')) {
          const ticketId = user.botState.replace('support:reply:', '')
          await handleTicketReply(chatId, from?.id, ticketId, text)
          return NextResponse.json({ ok: true })
        }
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
      const fromId = body.callback_query.from.id

      if (data) {
        await logger.info('telegram', 'Callback received', { data, chatId })

        // Ответ на callback (убираем часики)
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: callbackId })
        })

        // Обработка callbacks для тикетов
        if (data.startsWith('ticket_')) {
          await handleTicketCallback(chatId, fromId, data)
        }
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
 * Обработка кнопки "Техподдержка" - выбор категории
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
    // Устанавливаем режим выбора категории
    await db.user.update({
      where: { telegramId: String(telegramUserId) },
      data: { botState: 'support:select_category' }
    })

    const categoryButtons = {
      keyboard: [
        [{ text: SUPPORT_CATEGORIES.general.label }],
        [{ text: SUPPORT_CATEGORIES.bug.label }, { text: SUPPORT_CATEGORIES.feature.label }],
        [{ text: SUPPORT_CATEGORIES.payment.label }, { text: SUPPORT_CATEGORIES.account.label }],
        [{ text: '❌ Отмена' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    }

    const supportText = `💬 <b>Техническая поддержка</b>

Прежде чем создать обращение, выбери категорию:

📢 <b>Общий вопрос</b> — любой вопрос о работе приложения
🐛 <b>Баг/Ошибка</b> — сообщение о проблеме
💡 <b>Предложение</b> — идея для улучшения
💳 <b>Оплата</b> — вопросы по подписке
👤 <b>Аккаунт</b> — проблемы с аккаунтом

👇 Выбери категорию:`

    await sendTelegramMessage({
      chat_id: chatId,
      text: supportText,
      reply_markup: categoryButtons,
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
 * Обработка выбора категории
 */
async function handleCategorySelection(chatId: number, telegramUserId: number | undefined, category: string) {
  if (!telegramUserId) return

  try {
    // Сохраняем категорию в botState
    await db.user.update({
      where: { telegramId: String(telegramUserId) },
      data: { botState: `support:waiting:${category}` }
    })

    const categoryInfo = SUPPORT_CATEGORIES[category as keyof typeof SUPPORT_CATEGORIES]

    const text = `${categoryInfo.emoji} <b>${categoryInfo.label}</b>

📝 Опиши свою проблему или вопрос как можно подробнее.

💡 <i>Чем подробнее описание, тем быстрее мы сможем помочь!</i>

Для отмены нажми любую кнопку меню.`

    await sendTelegramMessage({
      chat_id: chatId,
      text,
    })
  } catch (error) {
    console.error('Error in category selection:', error)
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Ошибка. Попробуй позже.',
      reply_markup: getMainKeyboard(),
    })
  }
}

/**
 * Обработка сообщения в поддержку - создание тикета
 */
async function handleSupportMessage(chatId: number, telegramUserId: number | undefined, message: string) {
  if (!telegramUserId) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Не удалось создать обращение.',
      reply_markup: getMainKeyboard(),
    })
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

    // Извлекаем категорию из botState
    const category = user.botState?.split(':')[2] || 'general'

    // Создаём тикет
    const ticket = await db.supportTicket.create({
      data: {
        userId: user.id,
        telegramId: String(telegramUserId),
        chatId: String(chatId),
        category,
        firstMessage: message,
        lastMessage: message,
        lastMessageAt: new Date(),
        lastMessageFrom: 'user',
        status: 'open',
      }
    })

    // Сохраняем сообщение
    await db.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: 'user',
        senderName: user.firstName || 'Пользователь',
        message,
      }
    })

    // Сбрасываем состояние
    await db.user.update({
      where: { telegramId: String(telegramUserId) },
      data: { botState: null }
    })

    // Текст статуса
    const statusText = `✅ <b>Обращение создано!</b>

🎫 <b>Номер тикета:</b> #${ticket.id.slice(-8).toUpperCase()}
📁 <b>Категория:</b> ${SUPPORT_CATEGORIES[category as keyof typeof SUPPORT_CATEGORIES]?.label || 'Общий'}

Мы ответим тебе в ближайшее время. Обычно отвечаем в течение 24 часов.

Ты получишь уведомление, когда специалист ответит на твоё обращение.`

    // Inline кнопки для управления тикетом
    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: '📋 Мои обращения', callback_data: `ticket_my_tickets` }],
      ]
    }

    await sendTelegramMessage({
      chat_id: chatId,
      text: statusText,
      reply_markup: inlineKeyboard,
    })

    // Уведомляем админа о новом тикете
    if (ADMIN_CHAT_ID) {
      await notifyAdminNewTicket(ticket, user, message, category)
    }

    await logger.info('telegram', 'Support ticket created', {
      ticketId: ticket.id,
      telegramUserId,
      category
    })
  } catch (error) {
    console.error('Error creating support ticket:', error)
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Ошибка создания обращения. Попробуй позже.',
      reply_markup: getMainKeyboard(),
    })

    // Сбрасываем состояние
    await db.user.update({
      where: { telegramId: String(telegramUserId) },
      data: { botState: null }
    })
  }
}

/**
 * Уведомление админа о новом тикете
 */
async function notifyAdminNewTicket(ticket: any, user: any, message: string, category: string) {
  const categoryInfo = SUPPORT_CATEGORIES[category as keyof typeof SUPPORT_CATEGORIES]

  const adminText = `🆕 <b>Новое обращение в поддержку</b>

🎫 <b>Тикет:</b> #${ticket.id.slice(-8).toUpperCase()}
📁 <b>Категория:</b> ${categoryInfo?.label || 'Общий'}
⚡ <b>Приоритет:</b> Обычный

👤 <b>Пользователь:</b>
• Имя: ${user.firstName || 'Не указано'}
• Username: ${user.username ? '@' + user.username : 'нет'}
• ID: <code>${user.telegramId}</code>

💬 <b>Сообщение:</b>
${message}

⏰ <b>Время:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '✍️ Ответить', callback_data: `admin_reply_${ticket.id}` },
        { text: '✅ Закрыть', callback_data: `admin_close_${ticket.id}` },
      ],
    ]
  }

  await sendTelegramMessage({
    chat_id: ADMIN_CHAT_ID,
    text: adminText,
    reply_markup: inlineKeyboard,
  })
}

/**
 * Обработка ответа пользователя на тикет
 */
async function handleTicketReply(chatId: number, telegramUserId: number | undefined, ticketId: string, message: string) {
  if (!telegramUserId) return

  try {
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: true }
    })

    if (!ticket || ticket.telegramId !== String(telegramUserId)) {
      await sendTelegramMessage({
        chat_id: chatId,
        text: '❌ Тикет не найден.',
        reply_markup: getMainKeyboard(),
      })
      await db.user.update({
        where: { telegramId: String(telegramUserId) },
        data: { botState: null }
      })
      return
    }

    // Проверяем, не закрыт ли тикет
    if (ticket.status === 'closed') {
      await sendTelegramMessage({
        chat_id: chatId,
        text: '❌ Этот тикет уже закрыт. Создай новое обращение.',
        reply_markup: getMainKeyboard(),
      })
      await db.user.update({
        where: { telegramId: String(telegramUserId) },
        data: { botState: null }
      })
      return
    }

    // Сохраняем сообщение
    await db.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: 'user',
        senderName: ticket.user.firstName || 'Пользователь',
        message,
      }
    })

    // Обновляем тикет
    await db.supportTicket.update({
      where: { id: ticketId },
      data: {
        lastMessage: message,
        lastMessageAt: new Date(),
        lastMessageFrom: 'user',
        status: 'open', // Возвращаем в открытые
      }
    })

    await sendTelegramMessage({
      chat_id: chatId,
      text: '✅ <b>Сообщение отправлено!</b>\n\nМы ответим тебе в ближайшее время.',
    })

    // Уведомляем админа
    if (ADMIN_CHAT_ID) {
      const adminText = `💬 <b>Новый ответ в тикете</b>

🎫 <b>Тикет:</b> #${ticketId.slice(-8).toUpperCase()}
👤 <b>Пользователь:</b> ${ticket.user.firstName || 'Пользователь'}

💬 <b>Сообщение:</b>
${message}`

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '✍️ Ответить', callback_data: `admin_reply_${ticketId}` },
            { text: '✅ Закрыть', callback_data: `admin_close_${ticketId}` },
          ],
        ]
      }

      await sendTelegramMessage({
        chat_id: ADMIN_CHAT_ID,
        text: adminText,
        reply_markup: inlineKeyboard,
      })
    }

    await logger.info('telegram', 'User replied to ticket', {
      ticketId,
      telegramUserId
    })
  } catch (error) {
    console.error('Error in ticket reply:', error)
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Ошибка отправки сообщения.',
      reply_markup: getMainKeyboard(),
    })
  }
}

/**
 * Показать список тикетов пользователя
 */
async function handleMyTicketsCommand(chatId: number, telegramUserId?: number) {
  if (!telegramUserId) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Не могу определить твой аккаунт.',
      reply_markup: getMainKeyboard(),
    })
    return
  }

  try {
    const tickets = await db.supportTicket.findMany({
      where: { telegramId: String(telegramUserId) },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    if (tickets.length === 0) {
      await sendTelegramMessage({
        chat_id: chatId,
        text: `📋 <b>Мои обращения</b>

У тебя пока нет обращений в поддержку.

Нажми "💬 Техподдержка", чтобы создать новое.`,
        reply_markup: getMainKeyboard(),
      })
      return
    }

    // Статусы
    const statusEmojis: Record<string, string> = {
      open: '🟢',
      in_progress: '🟡',
      waiting_user: '🔵',
      resolved: '✅',
      closed: '⚫',
    }

    const statusLabels: Record<string, string> = {
      open: 'Открыт',
      in_progress: 'В работе',
      waiting_user: 'Ожидает ответа',
      resolved: 'Решён',
      closed: 'Закрыт',
    }

    let text = `📋 <b>Мои обращения</b>\n\n`

    const inlineButtons: any[][] = []

    for (const ticket of tickets) {
      const statusEmoji = statusEmojis[ticket.status] || '⚪'
      const statusLabel = statusLabels[ticket.status] || ticket.status
      const shortId = ticket.id.slice(-8).toUpperCase()

      text += `${statusEmoji} <b>#${shortId}</b> — ${statusLabel}\n`
      text += `📁 ${SUPPORT_CATEGORIES[ticket.category as keyof typeof SUPPORT_CATEGORIES]?.label || 'Общий'}\n`
      text += `📅 ${ticket.createdAt.toLocaleDateString('ru-RU')}\n`
      text += `${ticket.lastMessage?.substring(0, 50)}${ticket.lastMessage && ticket.lastMessage.length > 50 ? '...' : ''}\n\n`

      inlineButtons.push([{
        text: `${statusEmoji} #${shortId} — ${statusLabel}`,
        callback_data: `ticket_view_${ticket.id}`
      }])
    }

    await sendTelegramMessage({
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: inlineButtons },
    })
  } catch (error) {
    console.error('Error getting user tickets:', error)
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Ошибка получения обращений.',
      reply_markup: getMainKeyboard(),
    })
  }
}

/**
 * Обработка callback для тикетов
 */
async function handleTicketCallback(chatId: number | undefined, fromId: number, data: string) {
  if (!chatId) return

  // Просмотр тикета пользователем
  if (data.startsWith('ticket_view_')) {
    const ticketId = data.replace('ticket_view_', '')
    await showTicketToUser(chatId, fromId, ticketId)
    return
  }

  // Список тикетов
  if (data === 'ticket_my_tickets') {
    await handleMyTicketsCommand(chatId, fromId)
    return
  }

  // Ответить на тикет
  if (data.startsWith('ticket_reply_')) {
    const ticketId = data.replace('ticket_reply_', '')
    await prepareTicketReply(chatId, fromId, ticketId)
    return
  }

  // Админ: ответить на тикет
  if (data.startsWith('admin_reply_')) {
    const ticketId = data.replace('admin_reply_', '')
    // Это обрабатывается в админ-панели или специальном обработчике
    await sendTelegramMessage({
      chat_id: chatId,
      text: '✍️ Чтобы ответить на тикет, используй админ-панель или отправь сообщение в формате:\n\n<code>ответ_[ID тикета] [текст ответа]</code>',
    })
    return
  }

  // Админ: закрыть тикет
  if (data.startsWith('admin_close_')) {
    const ticketId = data.replace('admin_close_', '')
    await closeTicket(chatId, ticketId)
    return
  }
}

/**
 * Показать тикет пользователю
 */
async function showTicketToUser(chatId: number, telegramUserId: number, ticketId: string) {
  try {
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20,
        }
      }
    })

    if (!ticket || ticket.telegramId !== String(telegramUserId)) {
      await sendTelegramMessage({
        chat_id: chatId,
        text: '❌ Тикет не найден.',
      })
      return
    }

    const statusEmojis: Record<string, string> = {
      open: '🟢',
      in_progress: '🟡',
      waiting_user: '🔵',
      resolved: '✅',
      closed: '⚫',
    }

    const statusLabels: Record<string, string> = {
      open: 'Открыт',
      in_progress: 'В работе',
      waiting_user: 'Ожидает вашего ответа',
      resolved: 'Решён',
      closed: 'Закрыт',
    }

    const shortId = ticket.id.slice(-8).toUpperCase()
    const categoryInfo = SUPPORT_CATEGORIES[ticket.category as keyof typeof SUPPORT_CATEGORIES]

    let text = `${statusEmojis[ticket.status]} <b>Тикет #${shortId}</b>\n\n`
    text += `📁 <b>Категория:</b> ${categoryInfo?.label || 'Общий'}\n`
    text += `📊 <b>Статус:</b> ${statusLabels[ticket.status] || ticket.status}\n`
    text += `📅 <b>Создан:</b> ${ticket.createdAt.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}\n\n`
    text += `━━━━━━━━━━━━━━━━━━━━\n`
    text += `📝 <b>История переписки:</b>\n\n`

    for (const msg of ticket.messages) {
      const time = msg.createdAt.toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      })

      if (msg.senderType === 'user') {
        text += `👤 <b>Вы</b> (${time}):\n${msg.message}\n\n`
      } else if (msg.senderType === 'admin') {
        text += `👨‍💼 <b>Поддержка</b> (${time}):\n${msg.message}\n\n`
      }
    }

    const inlineButtons: any[][] = []

    if (ticket.status !== 'closed') {
      inlineButtons.push([
        { text: '✍️ Ответить', callback_data: `ticket_reply_${ticket.id}` }
      ])
    } else {
      inlineButtons.push([
        { text: '🔄 Создать новое обращение', callback_data: `ticket_new` }
      ])
    }

    inlineButtons.push([
      { text: '📋 К списку', callback_data: `ticket_my_tickets` }
    ])

    await sendTelegramMessage({
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: inlineButtons },
    })
  } catch (error) {
    console.error('Error showing ticket:', error)
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Ошибка при получении тикета.',
    })
  }
}

/**
 * Подготовка к ответу на тикет
 */
async function prepareTicketReply(chatId: number, telegramUserId: number, ticketId: string) {
  try {
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId }
    })

    if (!ticket) {
      await sendTelegramMessage({
        chat_id: chatId,
        text: '❌ Тикет не найден.',
      })
      return
    }

    if (ticket.status === 'closed') {
      await sendTelegramMessage({
        chat_id: chatId,
        text: '❌ Этот тикет закрыт. Создай новое обращение.',
      })
      return
    }

    // Устанавливаем режим ответа
    await db.user.update({
      where: { telegramId: String(telegramUserId) },
      data: { botState: `support:reply:${ticketId}` }
    })

    const shortId = ticketId.slice(-8).toUpperCase()

    await sendTelegramMessage({
      chat_id: chatId,
      text: `✍️ <b>Ответ на тикет #${shortId}</b>

Напиши своё сообщение:

💡 <i>Для отмены нажми любую кнопку меню.</i>`,
    })
  } catch (error) {
    console.error('Error preparing ticket reply:', error)
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Ошибка.',
    })
  }
}

/**
 * Закрыть тикет (для админа)
 */
async function closeTicket(chatId: number, ticketId: string) {
  try {
    const ticket = await db.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'closed',
        closedAt: new Date()
      },
      include: { user: true }
    })

    await sendTelegramMessage({
      chat_id: chatId,
      text: `✅ <b>Тикет #${ticketId.slice(-8).toUpperCase()} закрыт</b>`,
    })

    // Уведомляем пользователя
    const userText = `✅ <b>Ваше обращение закрыто</b>

🎫 <b>Тикет:</b> #${ticketId.slice(-8).toUpperCase()}

Спасибо за обращение! Если у тебя остались вопросы, создай новый тикет.`

    await sendTelegramMessage({
      chat_id: Number(ticket.chatId),
      text: userText,
      reply_markup: getMainKeyboard(),
    })

    await logger.info('telegram', 'Ticket closed by admin', { ticketId })
  } catch (error) {
    console.error('Error closing ticket:', error)
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Ошибка при закрытии тикета.',
    })
  }
}
