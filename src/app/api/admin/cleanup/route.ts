import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const results = {
      orphanPins: 0,
      orphanTasks: 0,
      totalDeleted: 0
    }

    // Удаляем пины с несуществующими пользователями
    const existingUserIds = await db.user.findMany({ select: { id: true } })
    const userIds = existingUserIds.map(u => u.id)

    if (userIds.length > 0) {
      const deletedPins = await db.pin.deleteMany({
        where: {
          userId: { notIn: userIds }
        }
      })
      results.orphanPins = deletedPins.count

      const deletedTasks = await db.task.deleteMany({
        where: {
          userId: { notIn: userIds }
        }
      })
      results.orphanTasks = deletedTasks.count
    } else {
      // Если пользователей нет вообще - удаляем всё
      const deletedPins = await db.pin.deleteMany()
      const deletedTasks = await db.task.deleteMany()
      results.orphanPins = deletedPins.count
      results.orphanTasks = deletedTasks.count
    }

    results.totalDeleted = results.orphanPins + results.orphanTasks

    return NextResponse.json({
      success: true,
      ...results,
      message: `Удалено осиротевших записей: ${results.totalDeleted} (пины: ${results.orphanPins}, задачи: ${results.orphanTasks})`
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({
      error: 'Ошибка сервера',
      details: String(error)
    }, { status: 500 })
  }
}

// Полная очистка всех данных (пользователи, пины, задачи)
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    // Удаляем в правильном порядке (сначала зависимости)
    const tasks = await db.task.deleteMany()
    const pins = await db.pin.deleteMany()
    const achievements = await db.userAchievement.deleteMany()
    const notificationSettings = await db.notificationSettings.deleteMany()
    const users = await db.user.deleteMany()

    return NextResponse.json({
      success: true,
      deleted: {
        tasks: tasks.count,
        pins: pins.count,
        achievements: achievements.count,
        notificationSettings: notificationSettings.count,
        users: users.count
      },
      message: `База очищена: ${users.count} пользователей, ${pins.count} пинов, ${tasks.count} задач`
    })
  } catch (error) {
    console.error('Full cleanup error:', error)
    return NextResponse.json({
      error: 'Ошибка сервера',
      details: String(error)
    }, { status: 500 })
  }
}
