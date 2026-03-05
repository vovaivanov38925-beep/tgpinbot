import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Get pending reminders (for cron job or polling)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const check = searchParams.get('check') // Check for due reminders

    if (check === 'now') {
      // Find tasks with reminders due now (within 1 minute window)
      const now = new Date()
      const oneMinuteAgo = new Date(now.getTime() - 60000)
      const oneMinuteAhead = new Date(now.getTime() + 60000)

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
          user: {
            select: {
              id: true,
              telegramId: true,
              firstName: true,
              isPremium: true
            }
          }
        }
      })

      return NextResponse.json({
        count: dueReminders.length,
        reminders: dueReminders.map(task => ({
          taskId: task.id,
          title: task.title,
          description: task.description,
          category: task.category,
          priority: task.priority,
          user: task.user,
          reminderTime: task.reminderTime
        }))
      })
    }

    // Get all upcoming reminders for a user
    const userId = searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const reminders = await db.task.findMany({
      where: {
        userId,
        reminderTime: {
          gte: new Date()
        },
        status: 'pending'
      },
      orderBy: {
        reminderTime: 'asc'
      }
    })

    return NextResponse.json(reminders)
  } catch (error) {
    console.error('Error fetching reminders:', error)
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 })
  }
}

// PATCH - Mark reminder as sent
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId } = body

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const task = await db.task.update({
      where: { id: taskId },
      data: { reminderSent: true }
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error updating reminder:', error)
    return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 })
  }
}

// POST - Send reminder (used by Telegram bot webhook)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, sendNotification } = body

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    // Get task with user info
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        user: true
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // If sendNotification is true, this is where you'd send Telegram message
    // For now, we just mark it as sent
    if (sendNotification) {
      // In real implementation:
      // await sendTelegramMessage(task.user.telegramId, `⏰ Напоминание: ${task.title}`)

      await db.task.update({
        where: { id: taskId },
        data: { reminderSent: true }
      })
    }

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        title: task.title,
        telegramId: task.user.telegramId
      }
    })
  } catch (error) {
    console.error('Error sending reminder:', error)
    return NextResponse.json({ error: 'Failed to send reminder' }, { status: 500 })
  }
}
