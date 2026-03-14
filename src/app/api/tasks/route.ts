import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { processNotifications, POINTS, getPremiumReminderTimes } from '@/lib/notifications'
import { logger } from '@/lib/logger'
import { checkTasksLimit, checkActiveTasksLimit } from '@/lib/limits'

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

    // Use raw query to avoid issues with missing columns
    let query = `SELECT id, "userId", "pinId", title, description, imageurl as "imageUrl", category, priority, status, "dueDate", "reminderTime", "reminderSent", points, "createdAt", "updatedAt" FROM tasks WHERE "userId" = '${userId}'`
    if (status) query += ` AND status = '${status}'`
    if (category) query += ` AND category = '${category}'`
    query += ` ORDER BY "createdAt" DESC`

    const tasks = await db.$queryRawUnsafe(query)

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    await logger.error('api', 'Error fetching tasks', { error: String(error) })
    return NextResponse.json({ tasks: [], error: 'Failed to fetch tasks' })
  }
}

// POST - Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, pinId, title, description, imageUrl, category, priority, dueDate, reminderTime } = body

    if (!userId || !title) {
      return NextResponse.json({ error: 'User ID and title are required' }, { status: 400 })
    }

    // Check tasks limit
    const tasksLimit = await checkTasksLimit(userId)
    if (!tasksLimit.allowed) {
      return NextResponse.json(
        {
          error: tasksLimit.message || 'Достигнут лимит задач',
          limitExceeded: true,
          current: tasksLimit.current,
          limit: tasksLimit.limit
        },
        { status: 403 }
      )
    }

    // Check active tasks limit
    const activeTasksLimit = await checkActiveTasksLimit(userId)
    if (!activeTasksLimit.allowed) {
      return NextResponse.json(
        {
          error: activeTasksLimit.message || 'Слишком много активных задач',
          limitExceeded: true,
          current: activeTasksLimit.current,
          limit: activeTasksLimit.limit
        },
        { status: 403 }
      )
    }

    // Проверка на дублирование - ищем похожую задачу за последние 5 секунд
    const fiveSecondsAgo = new Date(Date.now() - 5000)
    const existingTasks = await db.$queryRaw<any[]>`
      SELECT * FROM tasks WHERE "userId" = ${userId} AND title = ${title} AND "createdAt" >= ${fiveSecondsAgo} LIMIT 1
    `

    if (existingTasks.length > 0) {
      await logger.info('api', 'Duplicate task prevented', { taskId: existingTasks[0].id, userId, title })
      return NextResponse.json(existingTasks[0])
    }

    const taskPoints =
      priority === 'high' ? POINTS.TASK_COMPLETED_HIGH_PRIORITY : POINTS.TASK_COMPLETED_BASE

    // Generate cuid
    const { cuid } = await import('@paralleldrive/cuid2')
    const taskId = cuid()

    // Use raw query to create task
    await db.$queryRawUnsafe(`
      INSERT INTO tasks (id, "userId", "pinId", title, description, imageurl, category, priority, status, "dueDate", "reminderTime", "reminderSent", points, "createdAt", "updatedAt")
      VALUES (
        '${taskId}',
        '${userId}',
        ${pinId ? `'${pinId}'` : 'NULL'},
        '${title.replace(/'/g, "''")}',
        ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'},
        ${imageUrl ? `'${imageUrl}'` : 'NULL'},
        ${category ? `'${category}'` : 'NULL'},
        '${priority || 'medium'}',
        'pending',
        ${dueDate ? `'${dueDate}'` : 'NULL'},
        ${reminderTime ? `'${reminderTime}'` : 'NULL'},
        false,
        ${taskPoints},
        NOW(),
        NOW()
      )
    `)

    // Get the created task
    const createdTasks = await db.$queryRaw<any[]>`
      SELECT id, "userId", "pinId", title, description, imageurl as "imageUrl", category, priority, status, "dueDate", "reminderTime", "reminderSent", points, "createdAt", "updatedAt"
      FROM tasks WHERE id = ${taskId}
    `

    const task = createdTasks[0]

    // Get user for premium check
    const user = await db.user.findUnique({ where: { id: userId } })

    // Log premium reminders if applicable
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
      const existingTasks = await db.$queryRaw<any[]>`
        SELECT * FROM tasks WHERE id = ${id}
      `
      const task = existingTasks[0]

      if (task && task.status !== 'completed') {
        const notificationResult = await processNotifications(task.userId, 'task_completed', {
          taskTitle: task.title,
          taskPriority: task.priority,
          points: task.points,
        })

        await db.$queryRawUnsafe(`
          UPDATE tasks SET status = 'completed', "updatedAt" = NOW() WHERE id = '${id}'
        `)

        const updatedTasks = await db.$queryRaw<any[]>`
          SELECT id, "userId", "pinId", title, description, imageurl as "imageUrl", category, priority, status, "dueDate", "reminderTime", "reminderSent", points, "createdAt", "updatedAt"
          FROM tasks WHERE id = ${id}
        `

        await logger.info('api', 'Task completed', {
          taskId: task.id,
          userId: task.userId,
          pointsEarned: notificationResult.points,
          levelUp: notificationResult.levelUp,
        })

        return NextResponse.json({
          ...updatedTasks[0],
          pointsEarned: notificationResult.points,
          levelUp: notificationResult.levelUp,
          newLevel: notificationResult.newLevel,
          newAchievements: notificationResult.newAchievements,
        })
      }
    }

    // General update
    const setParts = []
    if (status) setParts.push(`status = '${status}'`)
    setParts.push(`"updatedAt" = NOW()`)

    if (setParts.length > 0) {
      await db.$queryRawUnsafe(`
        UPDATE tasks SET ${setParts.join(', ')} WHERE id = '${id}'
      `)
    }

    const tasks = await db.$queryRaw<any[]>`
      SELECT id, "userId", "pinId", title, description, imageurl as "imageUrl", category, priority, status, "dueDate", "reminderTime", "reminderSent", points, "createdAt", "updatedAt"
      FROM tasks WHERE id = ${id}
    `

    return NextResponse.json(tasks[0])
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

    await db.$queryRawUnsafe(`DELETE FROM tasks WHERE id = '${id}'`)
    await logger.info('api', 'Task deleted', { taskId: id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    await logger.error('api', 'Error deleting task', { error: String(error) })
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
