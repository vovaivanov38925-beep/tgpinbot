import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTaskReminder } from '@/lib/telegram'
import { logger } from '@/lib/logger'

// Секретный ключ для защиты endpoint
const CRON_SECRET = process.env.CRON_SECRET || 'tgpinbot-reminders-secret-2024'

/**
 * Scheduler для отправки напоминаний
 * 
 * Вызывается каждую минуту через внешний cron сервис:
 * - cron-job.org
 * - easycron.com
 * - Railway Cron (если доступно)
 * 
 * URL: /api/cron/reminders?secret=YOUR_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    // Проверка секретного ключа
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (secret !== CRON_SECRET) {
      await logger.warning('scheduler', 'Unauthorized cron access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
    const oneMinuteAhead = new Date(now.getTime() + 60 * 1000)

    // Находим задачи с напоминаниями, которые нужно отправить
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
        user: true,
      },
    })

    const results = {
      total: dueReminders.length,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Отправляем напоминания
    for (const task of dueReminders) {
      try {
        const chatId = task.user.telegramChatId

        if (!chatId) {
          // Пользователь не начал бота - пропускаем
          await db.task.update({
            where: { id: task.id },
            data: { reminderSent: true },
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
          // Отмечаем как отправленное
          await db.task.update({
            where: { id: task.id },
            data: { reminderSent: true },
          })
          results.sent++
          
          await logger.info('scheduler', 'Reminder sent', {
            taskId: task.id,
            chatId,
            title: task.title,
          })
        } else {
          results.failed++
          results.errors.push(`Task ${task.id}: ${result.description}`)
          
          await logger.error('scheduler', 'Failed to send reminder', {
            taskId: task.id,
            error: result.description,
          })
        }
      } catch (error) {
        results.failed++
        results.errors.push(`Task ${task.id}: ${String(error)}`)
      }
    }

    await logger.info('scheduler', 'Reminder check completed', {
      total: results.total,
      sent: results.sent,
      failed: results.failed,
    })

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      ...results,
    })
  } catch (error) {
    console.error('Scheduler error:', error)
    await logger.error('scheduler', 'Scheduler error', { error: String(error) })
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// POST для ручного запуска (для тестирования)
export async function POST(request: NextRequest) {
  return GET(request)
}
