import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTaskReminder } from '@/lib/telegram'
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
 * Only sends reminders when the exact reminder time is reached
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

    // Process main reminders only (at exact reminderTime)
    results.push(...(await processMainReminders(now)))

    const summary = {
      timestamp: now.toISOString(),
      total: results.length,
      sent: results.filter((r) => r.sent).length,
      failed: results.filter((r) => !r.sent).length,
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
 * Process main task reminders at exact reminderTime
 */
async function processMainReminders(now: Date): Promise<ReminderResult[]> {
  // Find tasks where reminderTime is within current minute
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

      // Mark as sent immediately to prevent duplicates
      await db.task.update({
        where: { id: task.id },
        data: { reminderSent: true },
      })

      if (!chatId) {
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

      // Send reminder with the actual reminderTime
      const result = await sendTaskReminder(
        chatId,
        task.title,
        task.description,
        task.reminderTime // Pass reminderTime, not dueDate
      )

      if (result.ok) {
        results.push({ taskId: task.id, sent: true, type: 'main' })

        await logger.info('scheduler', 'Reminder sent', {
          taskId: task.id,
          chatId,
          title: task.title,
          reminderTime: task.reminderTime,
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
