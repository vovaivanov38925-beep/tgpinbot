import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTaskReminder, sendTelegramMessage } from '@/lib/telegram'
import { logger } from '@/lib/logger'
import { isInQuietHours, getNotificationSettings } from '@/lib/notifications'

// Secret key for endpoint protection
const CRON_SECRET = process.env.CRON_SECRET || 'tgpinbot-reminders-secret-2024'

interface ReminderResult {
  taskId: string
  sent: boolean
  type: 'main' | 'day' | 'hour' | '15min'
  error?: string
}

/**
 * Scheduler for sending reminders
 *
 * Called every minute via external cron service
 * Handles both regular and premium reminders
 *
 * URL: /api/cron/reminders?secret=YOUR_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    // Verify secret key
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (secret !== CRON_SECRET) {
      await logger.warning('scheduler', 'Unauthorized cron access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const results: ReminderResult[] = []

    // 1. Process main reminders (exact time)
    results.push(...(await processMainReminders(now)))

    // 2. Process premium reminders (day before)
    results.push(...(await processPremiumReminders(now, 'day')))

    // 3. Process premium reminders (hour before)
    results.push(...(await processPremiumReminders(now, 'hour')))

    // 4. Process premium reminders (15 min before)
    results.push(...(await processPremiumReminders(now, '15min')))

    const summary = {
      timestamp: now.toISOString(),
      total: results.length,
      sent: results.filter((r) => r.sent).length,
      failed: results.filter((r) => !r.sent).length,
      byType: {
        main: results.filter((r) => r.type === 'main').length,
        day: results.filter((r) => r.type === 'day').length,
        hour: results.filter((r) => r.type === 'hour').length,
        '15min': results.filter((r) => r.type === '15min').length,
      },
    }

    await logger.info('scheduler', 'Reminder check completed', summary)

    return NextResponse.json({
      success: true,
      ...summary,
    })
  } catch (error) {
    console.error('Scheduler error:', error)
    await logger.error('scheduler', 'Scheduler error', { error: String(error) })
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// POST for manual testing
export async function POST(request: NextRequest) {
  return GET(request)
}

/**
 * Process main task reminders (exact time)
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
    include: {
      user: {
        include: { notificationSettings: true },
      },
    },
  })

  const results: ReminderResult[] = []

  for (const task of dueReminders) {
    try {
      const chatId = task.user.telegramChatId

      if (!chatId) {
        await db.task.update({
          where: { id: task.id },
          data: { reminderSent: true },
        })
        results.push({
          taskId: task.id,
          sent: false,
          type: 'main',
          error: 'No chat ID',
        })
        continue
      }

      // Check notification settings
      const settings =
        task.user.notificationSettings ||
        (await getNotificationSettings(task.userId))

      if (!settings.taskReminders) {
        await db.task.update({
          where: { id: task.id },
          data: { reminderSent: true },
        })
        results.push({
          taskId: task.id,
          sent: false,
          type: 'main',
          error: 'Disabled in settings',
        })
        continue
      }

      // Check quiet hours
      if (isInQuietHours(settings)) {
        results.push({
          taskId: task.id,
          sent: false,
          type: 'main',
          error: 'Quiet hours',
        })
        continue
      }

      const result = await sendTaskReminder(
        chatId,
        task.title,
        task.description,
        task.dueDate
      )

      if (result.ok) {
        await db.task.update({
          where: { id: task.id },
          data: { reminderSent: true },
        })
        results.push({ taskId: task.id, sent: true, type: 'main' })

        await logger.info('scheduler', 'Main reminder sent', {
          taskId: task.id,
          chatId,
          title: task.title,
        })
      } else {
        results.push({
          taskId: task.id,
          sent: false,
          type: 'main',
          error: result.description,
        })
      }
    } catch (error) {
      results.push({
        taskId: task.id,
        sent: false,
        type: 'main',
        error: String(error),
      })
    }
  }

  return results
}

/**
 * Process premium reminders (day, hour, 15min before)
 */
async function processPremiumReminders(
  now: Date,
  type: 'day' | 'hour' | '15min'
): Promise<ReminderResult[]> {
  // Calculate time window based on reminder type
  let targetTime: Date

  switch (type) {
    case 'day':
      // Tasks due tomorrow at the same minute
      targetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      break
    case 'hour':
      // Tasks due in 1 hour
      targetTime = new Date(now.getTime() + 60 * 60 * 1000)
      break
    case '15min':
      // Tasks due in 15 minutes
      targetTime = new Date(now.getTime() + 15 * 60 * 1000)
      break
  }

  // 2 minute window
  const windowStart = new Date(targetTime.getTime() - 60 * 1000)
  const windowEnd = new Date(targetTime.getTime() + 60 * 1000)

  // Find premium users' tasks in this window
  const tasks = await db.task.findMany({
    where: {
      dueDate: {
        gte: windowStart,
        lte: windowEnd,
      },
      status: 'pending',
      user: {
        isPremium: true,
        telegramChatId: { not: null },
      },
    },
    include: {
      user: {
        include: { notificationSettings: true },
      },
    },
  })

  const results: ReminderResult[] = []

  for (const task of tasks) {
    try {
      const settings =
        task.user.notificationSettings ||
        (await getNotificationSettings(task.userId))

      // Check if this reminder type is enabled
      const isEnabled =
        type === 'day'
          ? settings.reminderDayBefore
          : type === 'hour'
            ? settings.reminderHourBefore
            : settings.reminder15MinBefore

      if (!isEnabled) {
        continue
      }

      // Check quiet hours
      if (isInQuietHours(settings)) {
        continue
      }

      // Check if we already sent this reminder
      // We use a simple approach: check bot_logs for this reminder
      const existingLog = await db.botLog.findFirst({
        where: {
          source: 'scheduler',
          message: `Premium reminder ${type} sent`,
          details: { contains: task.id },
          createdAt: {
            gte: new Date(now.getTime() - 60 * 60 * 1000), // Within last hour
          },
        },
      })

      if (existingLog) {
        continue // Already sent
      }

      const chatId = task.user.telegramChatId!
      const result = await sendPremiumReminderMessage(chatId, task.title, type, task.dueDate!)

      if (result.ok) {
        results.push({ taskId: task.id, sent: true, type })

        await logger.info('scheduler', `Premium reminder ${type} sent`, {
          taskId: task.id,
          chatId,
          title: task.title,
        })
      } else {
        results.push({
          taskId: task.id,
          sent: false,
          type,
          error: result.description,
        })
      }
    } catch (error) {
      results.push({
        taskId: task.id,
        sent: false,
        type,
        error: String(error),
      })
    }
  }

  return results
}

/**
 * Send premium reminder message
 */
async function sendPremiumReminderMessage(
  chatId: string,
  taskTitle: string,
  reminderType: 'day' | 'hour' | '15min',
  dueDate: Date
): Promise<{ ok: boolean; description?: string }> {
  const timeText = {
    day: 'завтра',
    hour: 'через час',
    '15min': 'через 15 минут',
  }

  const urgencyEmoji = {
    day: '📅',
    hour: '⏰',
    '15min': '🚨',
  }

  const text = `${urgencyEmoji[reminderType]} <b>Напоминание</b>

📋 <b>${escapeHtml(taskTitle)}</b>

⏱️ Срок: ${timeText[reminderType]}!
${reminderType === '15min' ? 'Пора готовиться!' : 'Не забудьте!'}`

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || '8720645134:AAGOCNBOO4MqgfB10C5FfKnx1vg9oO-SuZc'}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      }
    )

    const data = await response.json()
    return data
  } catch (error) {
    return { ok: false, description: String(error) }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
