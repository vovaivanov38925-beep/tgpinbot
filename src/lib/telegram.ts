/**
 * Telegram Bot Utility
 * Отправка уведомлений пользователям через Telegram Bot API
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

interface TelegramMessage {
  chat_id: string | number
  text: string
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  disable_web_page_preview?: boolean
  reply_markup?: {
    keyboard?: Array<Array<{ text: string }>>
    resize_keyboard?: boolean
    one_time_keyboard?: boolean
    inline_keyboard?: Array<Array<{
      text: string
      url?: string
      callback_data?: string
      web_app?: { url: string }
    }>>
  }
}

interface TelegramResponse {
  ok: boolean
  result?: { message_id?: number } & Record<string, unknown>
  description?: string
  error_code?: number
}

/**
 * Отправить сообщение через Telegram Bot API
 */
export async function sendTelegramMessage(message: TelegramMessage): Promise<TelegramResponse> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.chat_id,
        text: message.text,
        parse_mode: message.parse_mode || 'HTML',
        disable_web_page_preview: message.disable_web_page_preview ?? true,
        reply_markup: message.reply_markup,
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      console.error('Telegram API error:', data.description)
    }

    return data
  } catch (error) {
    console.error('Failed to send Telegram message:', error)
    return { ok: false, description: String(error) }
  }
}

/**
 * Отправить фото с подписью через Telegram Bot API
 */
export async function sendTelegramPhoto(
  chatId: string | number,
  photoUrl: string,
  caption: string
): Promise<TelegramResponse> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption,
        parse_mode: 'HTML',
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      console.error('Telegram sendPhoto error:', data.description)
    }

    return data
  } catch (error) {
    console.error('Failed to send Telegram photo:', error)
    return { ok: false, description: String(error) }
  }
}

/**
 * Главное меню бота (Reply Keyboard)
 */
export function getMainKeyboard() {
  return {
    keyboard: [
      [{ text: '📱 Открыть приложение' }],
      [{ text: '📊 Моя статистика' }, { text: '❓ Помощь' }],
      [{ text: '💬 Техподдержка' }, { text: '🗑 Очистить чат' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  }
}

/**
 * Inline кнопка для открытия Mini App
 */
export function getMiniAppButton(appUrl: string) {
  return {
    inline_keyboard: [[
      { text: '🚀 Открыть приложение', web_app: { url: appUrl } }
    ]]
  }
}

/**
 * Отправить напоминание о задаче
 */
export async function sendTaskReminder(
  chatId: string | number,
  taskTitle: string,
  taskDescription?: string | null,
  reminderTime?: Date | null
): Promise<TelegramResponse> {
  const timeLabel = reminderTime
    ? `🕐 ${reminderTime.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Moscow'
      })}`
    : ''

  const text = `⏰ <b>Напоминание о задаче</b>

<b>${escapeHtml(taskTitle)}</b>${taskDescription ? `\n${escapeHtml(taskDescription.substring(0, 100))}${taskDescription.length > 100 ? '...' : ''}` : ''}

${timeLabel}

👉 <a href="https://t.me/PinToActionBot?startapp=1">Открыть приложение</a>`

  return sendTelegramMessage({ chat_id: chatId, text })
}

/**
 * Уведомление о выполнении задачи
 */
export async function sendTaskCompletedNotification(
  chatId: string | number,
  taskTitle: string,
  points: number
): Promise<TelegramResponse> {
  const text = `<b>✅ Задача выполнена</b>

${escapeHtml(taskTitle)}

⭐ +${points} очков

—\n💪 Продолжай в том же духе!`

  return sendTelegramMessage({ chat_id: chatId, text })
}

/**
 * Уведомление о новом достижении
 */
export async function sendAchievementNotification(
  chatId: string | number,
  achievementName: string,
  achievementDescription: string,
  points: number
): Promise<TelegramResponse> {
  const text = `<b>🏆 Новое достижение</b>

<b>${escapeHtml(achievementName)}</b>
<i>${escapeHtml(achievementDescription)}</i>

⭐ +${points} очков

—\n🎖 Отличная работа!`

  return sendTelegramMessage({ chat_id: chatId, text })
}

/**
 * Уведомление о повышении уровня
 */
export async function sendLevelUpNotification(
  chatId: string | number,
  newLevel: number
): Promise<TelegramResponse> {
  const text = `<b>🎉 Новый уровень</b>

🆙 Ты достиг <b>${newLevel} уровня</b>

—\n💪 Продолжай сохранять идеи и выполнять задачи!`

  return sendTelegramMessage({ chat_id: chatId, text })
}

/**
 * Умное напоминание для премиум пользователей
 */
export async function sendSmartReminder(
  chatId: string | number,
  taskTitle: string,
  reminderType: '3_days' | '1_day' | '4_hours' | '1_hour' | '15_min',
  dueDate: Date
): Promise<TelegramResponse> {
  const urgencyText: Record<string, string> = {
    '3_days': 'Напоминание',
    '1_day': 'Напоминание',
    '4_hours': 'Скоро срок',
    '1_hour': 'Скоро срок',
    '15_min': 'Срочно',
  }

  const deadlineText: Record<string, string> = {
    '3_days': '🕐 Осталось 3 дня',
    '1_day': '🕐 Остался 1 день',
    '4_hours': '🕐 Осталось 4 часа',
    '1_hour': '🕐 Остался 1 час',
    '15_min': '🕐 Осталось 15 минут',
  }

  const dateStr = dueDate.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow'
  })

  const text = `⏰ <b>${urgencyText[reminderType]}</b>

<b>${escapeHtml(taskTitle)}</b>

${deadlineText[reminderType]}
📅 Срок: ${dateStr}

👉 <a href="https://t.me/PinToActionBot?startapp=1">Открыть приложение</a>`

  return sendTelegramMessage({ chat_id: chatId, text })
}

/**
 * Установить webhook для бота
 */
export async function setTelegramWebhook(webhookUrl: string): Promise<TelegramResponse> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
      }),
    })

    return await response.json()
  } catch (error) {
    console.error('Failed to set webhook:', error)
    return { ok: false, description: String(error) }
  }
}

/**
 * Получить информацию о боте
 */
export async function getBotInfo(): Promise<TelegramResponse> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`)
    return await response.json()
  } catch (error) {
    return { ok: false, description: String(error) }
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Удалить сообщение в Telegram
 */
export async function deleteTelegramMessage(
  chatId: string | number,
  messageId: number
): Promise<TelegramResponse> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      console.error('Telegram deleteMessage error:', data.description)
    }

    return data
  } catch (error) {
    console.error('Failed to delete Telegram message:', error)
    return { ok: false, description: String(error) }
  }
}

/**
 * Получить ID сообщения из ответа Telegram
 */
export function getMessageIdFromResponse(response: TelegramResponse): number | null {
  if (response.ok && response.result && typeof response.result === 'object') {
    const result = response.result as { message_id?: number }
    return result.message_id || null
  }
  return null
}

/**
 * Отправить уведомление о синхронизации Pinterest
 */
export async function sendPinterestSyncNotification(
  chatId: string | number,
  boardName: string | null,
  totalPins: number,
  newPins: number,
  pointsEarned: number
): Promise<TelegramResponse> {
  const text = `📥 <b>Синхронизация завершена!</b>

${boardName ? `📋 Доска: <b>${escapeHtml(boardName)}</b>` : ''}
📊 Всего пинов на доске: ${totalPins}
✨ Новых пинов добавлено: ${newPins}
⭐ Очков заработано: +${pointsEarned}

${newPins > 0 ? 'Открой приложение, чтобы увидеть новые идеи! 🎨' : 'Все пины уже были сохранены ранее.'}`

  return sendTelegramMessage({ chat_id: chatId, text })
}

/**
 * Отправить уведомление об ошибке синхронизации
 */
export async function sendPinterestSyncError(
  chatId: string | number,
  errorMessage: string
): Promise<TelegramResponse> {
  const text = `❌ <b>Ошибка синхронизации</b>

${escapeHtml(errorMessage)}

Проверь правильность ссылки на доску Pinterest.
Формат: pinterest.com/username/board-name`

  return sendTelegramMessage({ chat_id: chatId, text })
}

/**
 * Отправить список подключённых досок
 */
export async function sendConnectedBoardsList(
  chatId: string | number,
  boards: Array<{
    id: string
    boardName: string | null
    boardUrl: string
    totalPins: number
    lastSyncAt: Date | null
  }>
): Promise<TelegramResponse> {
  if (boards.length === 0) {
    const text = `📥 <b>Подключённые доски</b>

У тебя пока нет подключённых досок Pinterest.

Отправь ссылку на доску в формате:
pinterest.com/username/board-name`

    return sendTelegramMessage({ chat_id: chatId, text })
  }

  const boardsList = boards.map((board, index) => {
    const syncDate = board.lastSyncAt
      ? board.lastSyncAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
      : 'не синхронизирована'

    return `${index + 1}. ${board.boardName || 'Без названия'}
   📊 ${board.totalPins} пинов | 🔄 ${syncDate}`
  }).join('\n\n')

  const text = `📥 <b>Подключённые доски (${boards.length})</b>

${boardsList}

Для повторной синхронизации отправь ссылку на доску.`

  return sendTelegramMessage({ chat_id: chatId, text })
}
