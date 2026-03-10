import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTaskReminder, from '@/lib/telegram'
import { logger } from '@/lib/logger'
import { sendNewPinNotification } from '@/lib/telegram'

// GET - Get all tasks for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { userId }
    if (status) {
      where.status = status
    }
    if (category) {
      where.category = category
    }

    const tasks = await db.task.findMany({
      where,
      include: {
        pin: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Error fetching tasks:', error)
    await logger.error('api', 'Error fetching tasks', { error: String(error) })
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

// POST - Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, pinId, title, description, category, priority, dueDate, reminderTime } = body

    if (!userId || !title) {
      return NextResponse.json({ error: 'User ID and title are required' }, { status: 400 })
    }

    const task = await db.task.create({
      data: {
        userId,
        pinId: pinId || null,
        title,
        description: description || null,
        category: category || null,
        priority: priority || 'medium',
        status: status || 'pending',
        dueDate: dueDate ? new Date(dueDate) : null,
        reminderTime: reminderTime ? new Date(reminderTime) : null,
        reminderSent: false,
        points: 5,
      },
    })

    // Get user for notification about reminder
    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Send notification if reminder time is set
    if (reminderTime && user.telegramChatId) {
              try {
                await sendTaskReminder(
                  user.telegramChatId,
                  title,
                  description,
                  dueDate
                )
                await logger.info('telegram', 'Task reminder notification scheduled', {
                  taskId: task.id,
                  chatId: user.telegramChatId,
                  title: task.title,
                })
              } catch (error) {
                console.error('Failed to send reminder notification:', error)
              }
            }
          })
        }
      }

      // Update user points
      await db.user.update({
        where: { id: userId },
        data: {
          points: { increment: task.points }
        },
      })

      await logger.info('api', 'Task created', {
        taskId: task.id,
        category,
        userId,
      })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error creating task:', error)
    await logger.error('api', 'Error creating task', { error: String(error) })
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

// PATCH - Update a task
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    // If task is being completed, award points
    if (status === 'completed') {
      const task = await db.task.findUnique({ where: { id } })
      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }

      if (task.status !== 'completed') {
        await db.user.update({
          where: { id: task.userId },
          data: {
            points: { increment: task.points }
        })
      }

      // Send notification about task completion
      const user = await db.user.findUnique({
        where: { id: task.userId },
      })

      if (user?.telegramChatId) {
        try {
          await sendTaskCompletedNotification(user.telegramChatId, task.title, task.points)
          await logger.info('telegram', 'Task completed notification sent', {
            taskId: task.id,
            chatId: user.telegramChatId,
            title: task.title,
            points: task.points
          })
        } catch (error) {
          console.error('Failed to send completion notification:', error)
        }
      }

      const task = await db.task.update({
        where: { id },
        data: { ...updateData, status: status || updateData.status }
      })

      return NextResponse.json(task)
    } catch (error) {
    console.error('Error updating task:', error)
    await logger.error('api', 'Error updating task', { error: String(error) })
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }
}

// DELETE - Delete a task
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    await db.task.delete({
      where: { id }
    })

    await logger.info('api', 'Task deleted', { pinId: id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    await logger.error('api', 'Error deleting task', { error: String(error) })
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
