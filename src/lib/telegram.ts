/**
 * Telegram Bot Utility
 * Отправка уведомлений пользователям через Telegram Bot API
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8720645134:AAGOCNBOO4MqgfB10C5FfKnx1vg9oO-SuZc'

interface TelegramMessage {
  chat_id: string | number
  text: string
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  disable_web_page_preview?: boolean
}

interface TelegramResponse {
  ok: boolean
  result?: unknown
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: message.chat_id,
        text: message.text,
        parse_mode: message.parse_mode || 'HTML',
        disable_web_page_preview: message.disable_web_page_preview ?? true,
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
 * Отправить уведомление о напоминании задачи
 * Показывает время напоминания, которое указал пользователь
 */
export async function sendTaskReminder(
  chatId: string | number,
  taskTitle: string,
  taskDescription?: string | null,
  reminderTime?: Date | null
): Promise<TelegramResponse> {
  // Показываем время напоминания
  const timeStr = reminderTime
    ? `\n⏰ Время: ${reminderTime.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      })}`
    : ''

  const text = `⏰ <b>Напоминание о задаче</b>

📋 <b>${escapeHtml(taskTitle)}</b>
${taskDescription ? `\n${escapeHtml(taskDescription.substring(0, 200))}${taskDescription.length > 200 ? '...' : ''}` : ''}${timeStr}

👉 Открой приложение, чтобы отметить выполнение!`

  return sendTelegramMessage({ chat_id: chatId, text })
}

/**
 * Отправить уведомление о выполнении задачи
 */
export async function sendTaskCompletedNotification(
  chatId: string | number,
  taskTitle: string,
  points: number
): Promise<TelegramResponse> {
  const text = `✅ <b>Задача выполнена!</b>

📋 ${escapeHtml(taskTitle)}

⭐ +${points} очков!
Продолжай в том же духе! 🚀`

  return sendTelegramMessage({ chat_id: chatId, text })
}

/**
 * Отправить уведомление о новом достижении
 */
export async function sendAchievementNotification(
  chatId: string | number,
  achievementName: string,
  achievementDescription: string,
  points: number
): Promise<TelegramResponse> {
  const text = `🏆 <b>Новое достижение!</b>

🎖️ <b>${escapeHtml(achievementName)}</b>
${escapeHtml(achievementDescription)}

⭐ +${points} очков!`

  return sendTelegramMessage({ chat_id: chatId, text })
}

/**
 * Отправить уведомление о повышении уровня
 */
export async function sendLevelUpNotification(
  chatId: string | number,
  newLevel: number
): Promise<TelegramResponse> {
  const text = `🎉 <b>Поздравляем!</b>

🆙 Ты достиг <b>${newLevel} уровня</b>!

Продолжай сохранять идеи и выполнять задачи! 💪`

  return sendTelegramMessage({ chat_id: chatId, text })
}

/**
 * Установить webhook для бота
 */
export async function setTelegramWebhook(webhookUrl: string): Promise<TelegramResponse> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

/**
 * Экранирование HTML символов
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
