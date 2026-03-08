import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
        dueDate: dueDate ? new Date(dueDate) : null,
        reminderTime: reminderTime ? new Date(reminderTime) : null,
        reminderSent: false
      }
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error creating task:', error)
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
      if (task && task.status !== 'completed') {
        await db.user.update({
          where: { id: task.userId },
          data: {
            points: { increment: task.points }
          }
        })
      }
    }

    const task = await db.task.update({
      where: { id },
      data: { ...updateData, status: status || updateData.status }
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error updating task:', error)
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
