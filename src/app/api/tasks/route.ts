import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { processNotifications, POINTS, getPremiumReminderTimes } from '@/lib/notifications'
import { logger } from '@/lib/logger'

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
        pin: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
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
    const {
      userId,
      pinId,
      title,
      description,
      category,
      priority,
      dueDate,
      reminderTime,
    } = body

    if (!userId || !title) {
      return NextResponse.json(
        { error: 'User ID and title are required' },
        { status: 400 }
      )
    }

    // Calculate points based on priority
    const taskPoints =
      priority === 'high'
        ? POINTS.TASK_COMPLETED_HIGH_PRIORITY
        : POINTS.TASK_COMPLETED_BASE

    const task = await db.task.create({
      data: {
        userId,
        pinId: pinId || null,
        title,
        description: description || null,
        category: category || null,
        priority: priority || 'medium',
        dueDate: dueDate ? new Date(dueDate) : null,
        reminderTime: reminderTime ? new Date(reminderTime) : null,
        reminderSent: false,
        points: taskPoints,
      },
    })

    // Get user for premium check
    const user = await db.user.findUnique({
      where: { id: userId },
    })

    // For premium users, log additional reminders scheduled
    if (user?.isPremium && dueDate) {
      const premiumReminders = await getPremiumReminderTimes(userId, new Date(dueDate))
      if (premiumReminders.length > 0) {
        await logger.info('api', 'Premium reminders scheduled', {
          taskId: task.id,
          reminders: premiumReminders.map((r) => r.type),
        })
      }
    }

    await logger.info('api', 'Task created', {
      taskId: task.id,
      category,
      userId,
      reminderTime: reminderTime ? new Date(reminderTime).toISOString() : null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      isPremium: user?.isPremium,
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

    // If task is being completed, award points and send notifications
    if (status === 'completed') {
      const task = await db.task.findUnique({
        where: { id },
        include: { user: true },
      })

      if (task && task.status !== 'completed') {
        // Process notifications (points, level up, achievements)
        const notificationResult = await processNotifications(
          task.userId,
          'task_completed',
          {
            taskTitle: task.title,
            taskPriority: task.priority,
            points: task.points,
          }
        )

        // Update task with completion info
        const updatedTask = await db.task.update({
          where: { id },
          data: { ...updateData, status: 'completed' },
        })

        await logger.info('api', 'Task completed', {
          taskId: task.id,
          userId: task.userId,
          pointsEarned: notificationResult.points,
          levelUp: notificationResult.levelUp,
          achievements: notificationResult.newAchievements.length,
        })

        // Return task with notification info
        return NextResponse.json({
          ...updatedTask,
          pointsEarned: notificationResult.points,
          levelUp: notificationResult.levelUp,
          newLevel: notificationResult.newLevel,
          newAchievements: notificationResult.newAchievements,
        })
      }
    }

    const task = await db.task.update({
      where: { id },
      data: { ...updateData, status: status || updateData.status },
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
      where: { id },
    })

    await logger.info('api', 'Task deleted', { taskId: id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    await logger.error('api', 'Error deleting task', { error: String(error) })
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
