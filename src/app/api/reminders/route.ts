import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Check for due reminders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const now = new Date()
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

    // Find tasks with reminders due in the next 5 minutes that haven't been sent
    const dueReminders = await db.task.findMany({
      where: {
        userId,
        reminderTime: {
          gte: now,
          lte: fiveMinutesFromNow
        },
        reminderSent: false,
        status: 'pending'
      },
      include: {
        user: true
      }
    })

    // Mark reminders as sent
    for (const task of dueReminders) {
      await db.task.update({
        where: { id: task.id },
        data: { reminderSent: true }
      })
    }

    return NextResponse.json({
      reminders: dueReminders.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        reminderTime: t.reminderTime
      }))
    })
  } catch (error) {
    console.error('Error checking reminders:', error)
    return NextResponse.json({ error: 'Failed to check reminders' }, { status: 500 })
  }
}

// POST - Mark reminder as sent manually
export async function POST(request: NextRequest) {
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

    return NextResponse.json({ success: true, task })
  } catch (error) {
    console.error('Error marking reminder as sent:', error)
    return NextResponse.json({ error: 'Failed to mark reminder as sent' }, { status: 500 })
  }
}
