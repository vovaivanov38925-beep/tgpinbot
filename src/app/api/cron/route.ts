import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Cron job endpoint - вызывается каждую минуту
export async function GET(request: Request) {
  try {
    // Verify cron secret (optional but recommended)
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60000)
    const oneMinuteAhead = new Date(now.getTime() + 60000)

    // Find tasks with reminders due now
    const dueReminders = await db.task.findMany({
      where: {
        reminderTime: {
          gte: oneMinuteAgo,
          lte: oneMinuteAhead
        },
        reminderSent: false,
        status: 'pending'
      },
      include: {
        user: true
      }
    })

    const results = []

    for (const task of dueReminders) {
      try {
        // Send Telegram notification
        if (task.user.telegramId && process.env.TELEGRAM_BOT_TOKEN) {
          const telegramApiUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`
          
          let message = `⏰ *Напоминание!*\n\n`
          message += `📋 *Задача:* ${task.title}\n`
          if (task.description) {
            message += `📝 ${task.description}\n`
          }
          if (task.category) {
            message += `📂 Категория: ${task.category}\n`
          }
          if (task.priority === 'high') {
            message += `🔴 Важная задача!\n`
          }

          await fetch(telegramApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: task.user.telegramId,
              text: message,
              parse_mode: 'Markdown'
            })
          })
        }

        // Mark as sent
        await db.task.update({
          where: { id: task.id },
          data: { reminderSent: true }
        })

        results.push({ taskId: task.id, sent: true })
      } catch (e) {
        console.error(`Failed to send reminder for task ${task.id}:`, e)
        results.push({ taskId: task.id, sent: false, error: String(e) })
      }
    }

    return NextResponse.json({
      timestamp: now.toISOString(),
      processed: dueReminders.length,
      results
    })

  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
