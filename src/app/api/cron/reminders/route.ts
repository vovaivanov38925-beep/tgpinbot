import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTelegramMessage } from '@/lib/telegram'
import { logger } from '@/lib/logger'

// Secret key for endpoint protection
const CRON_SECRET = process.env.CRON_SECRET || 'tgpinbot-reminders-secret-2024'

interface ReminderResult {
  taskId: string
  sent: boolean
  type: 'main' | 'smart'
  error?: string
}

/**
 * Scheduler for sending reminders
 * Called every minute via external cron service
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (secret !== CRON_SECRET) {
      await logger.warning('scheduler', 'Unauthorized cron access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const results: ReminderResult[] = []

    // Process main reminders (exact reminderTime)
    results.push(...(await processMainReminders(now)))

    // Process smart premium reminders
    results.push(...(await processSmartReminders(now)))

    const summary = {
      timestamp: now.toISOString(),
      total: results.length,
      sent: results.filter((r) => r.sent).length,
      failed: results.filter((r) => !r.sent).length,
    }

    await logger.info('scheduler', 'Reminder check completed', summary)

    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error('Scheduler error:', error)
    await logger.error('scheduler', 'Scheduler error', { error: String(error) })
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}

/**
 * Process main task reminders at exact reminderTime
 */
async function processMainReminders(now: Date): Promise<ReminderResult[]> {
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
  const oneMinuteAhead = new Date(now.getTime() + 60 * 1000)

  const dueReminders = await db.task.findMany({
    where: {
      reminderTime: {
        gte: oneMinuteAgo,
        lte: oneMinuteAhead,
      },
      reminderSent: false,
      status: 'pending',
    },
    include: { user: true },
  })

  const results: ReminderResult[] = []

  for (const task of dueReminders) {
    try {
      // Mark as sent immediately
      await db.task.update({
        where: { id: task.id },
        data: { reminderSent: true },
      })

      const chatId = task.user.telegramChatId
      if (!chatId) {
        results.push({ taskId: task.id, sent: false, type: 'main', error: 'No chat ID' })
        continue
      }

      const timeLabel = task.reminderTime
        ? `🕐 ${task.reminderTime.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Moscow'
          })}`
        : ''

      const text = `⏰ <b>Напоминание о задаче</b>

<b>${escapeHtml(task.title)}</b>${task.description ? `\n${escapeHtml(task.description.substring(0, 100))}${task.description.length > 100 ? '...' : ''}` : ''}

${timeLabel}

👉 <a href="https://t.me/tgpinbot">Открыть приложение</a>`

      const result = await sendTelegramMessage({ chat_id: chatId, text })

      if (result.ok) {
        results.push({ taskId: task.id, sent: true, type: 'main' })
        await logger.info('scheduler', 'Main reminder sent', { taskId: task.id, chatId })
      } else {
        results.push({ taskId: task.id, sent: false, type: 'main', error: result.description })
      }
    } catch (error) {
      results.push({ taskId: task.id, sent: false, type: 'main', error: String(error) })
    }
  }

  return results
}

/**
 * Smart Premium Reminders
 *
 * Формула расчёта напоминаний для премиум пользователей:
 * - Если до события > 7 дней → напоминание за 3 дня
 * - Если до события 3-7 дней → напоминание за 1 день
 * - Если до события 1-3 дня → напоминание за 4 часа
 * - Если до события < 1 дня → напоминание за 1 час и за 15 минут
 */
async function processSmartReminders(now: Date): Promise<ReminderResult[]> {
  const results: ReminderResult[] = []

  // Find premium users' pending tasks with dueDate
  const tasks = await db.task.findMany({
    where: {
      dueDate: { not: null },
      status: 'pending',
      user: {
        isPremium: true,
        telegramChatId: { not: null },
      },
    },
    include: { user: true },
  })

  for (const task of tasks) {
    if (!task.dueDate || !task.user.telegramChatId) continue

    const dueDate = new Date(task.dueDate)
    const timeUntilDue = dueDate.getTime() - now.getTime()
    const hoursUntilDue = timeUntilDue / (1000 * 60 * 60)
    const daysUntilDue = hoursUntilDue / 24

    // Calculate which reminders to send based on time until due
    const reminders = calculateSmartReminders(daysUntilDue, hoursUntilDue, now, dueDate)

    for (const reminder of reminders) {
      // Check if we should send this reminder (within 1 minute window)
      const timeDiff = Math.abs(reminder.time.getTime() - now.getTime())
      if (timeDiff > 60 * 1000) continue

      // Check if we already sent this type of reminder (using bot_logs)
      const existingLog = await db.botLog.findFirst({
        where: {
          source: 'scheduler',
          message: `Smart reminder: ${reminder.type}`,
          details: { contains: task.id },
          createdAt: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Within last 24 hours
          },
        },
      })

      if (existingLog) continue

      // Send the reminder
      const text = formatSmartReminder(task.title, reminder.type, dueDate, reminder.timeLeft)
      const result = await sendTelegramMessage({ chat_id: task.user.telegramChatId!, text })

      if (result.ok) {
        results.push({ taskId: task.id, sent: true, type: 'smart' })
        await logger.info('scheduler', `Smart reminder ${reminder.type} sent`, {
          taskId: task.id,
          type: reminder.type,
        })
      } else {
        results.push({ taskId: task.id, sent: false, type: 'smart', error: result.description })
      }
    }
  }

  return results
}

interface SmartReminder {
  type: string
  time: Date
  timeLeft: string
}

function calculateSmartReminders(
  daysUntilDue: number,
  hoursUntilDue: number,
  now: Date,
  dueDate: Date
): SmartReminder[] {
  const reminders: SmartReminder[] = []

  // More than 7 days → remind 3 days before at 10:00
  if (daysUntilDue > 7) {
    const threeDaysBefore = new Date(dueDate)
    threeDaysBefore.setDate(threeDaysBefore.getDate() - 3)
    threeDaysBefore.setHours(10, 0, 0, 0)
    reminders.push({
      type: '3_days',
      time: threeDaysBefore,
      timeLeft: 'через 3 дня',
    })
  }

  // 3-7 days → remind 1 day before at 10:00
  if (daysUntilDue > 3 && daysUntilDue <= 7) {
    const oneDayBefore = new Date(dueDate)
    oneDayBefore.setDate(oneDayBefore.getDate() - 1)
    oneDayBefore.setHours(10, 0, 0, 0)
    reminders.push({
      type: '1_day',
      time: oneDayBefore,
      timeLeft: 'завтра',
    })
  }

  // 1-3 days → remind 4 hours before
  if (daysUntilDue > 1 && daysUntilDue <= 3) {
    const fourHoursBefore = new Date(dueDate.getTime() - 4 * 60 * 60 * 1000)
    reminders.push({
      type: '4_hours',
      time: fourHoursBefore,
      timeLeft: 'через 4 часа',
    })
  }

  // Less than 1 day → remind 1 hour before
  if (daysUntilDue <= 1 && hoursUntilDue > 1) {
    const oneHourBefore = new Date(dueDate.getTime() - 60 * 60 * 1000)
    reminders.push({
      type: '1_hour',
      time: oneHourBefore,
      timeLeft: 'через час',
    })
  }

  // Less than 1 hour → remind 15 minutes before
  if (hoursUntilDue <= 1 && hoursUntilDue > 0.25) {
    const fifteenMinBefore = new Date(dueDate.getTime() - 15 * 60 * 1000)
    reminders.push({
      type: '15_min',
      time: fifteenMinBefore,
      timeLeft: 'через 15 минут',
    })
  }

  return reminders
}

function formatSmartReminder(
  taskTitle: string,
  type: string,
  dueDate: Date,
  timeLeft: string
): string {
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

  return `⏰ <b>${urgencyText[type]}</b>

<b>${escapeHtml(taskTitle)}</b>

${deadlineText[type]}
📅 Срок: ${dateStr}

👉 <a href="https://t.me/tgpinbot">Открыть приложение</a>`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
