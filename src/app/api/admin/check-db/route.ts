import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    // Проверяем целостность данных
    const [users, pins, tasks] = await Promise.all([
      db.user.findMany({ select: { id: true } }),
      db.pin.findMany({ select: { id: true, userId: true } }),
      db.task.findMany({ select: { id: true, userId: true } }),
    ])

    const userIds = new Set(users.map(u => u.id))

    const orphanPins = pins.filter(p => !userIds.has(p.userId))
    const orphanTasks = tasks.filter(t => !userIds.has(t.userId))

    return NextResponse.json({
      totalUsers: users.length,
      totalPins: pins.length,
      totalTasks: tasks.length,
      orphanPins: orphanPins.length,
      orphanTasks: orphanTasks.length,
      orphanPinsDetails: orphanPins.slice(0, 10),
      orphanTasksDetails: orphanTasks.slice(0, 10),
      status: orphanPins.length === 0 && orphanTasks.length === 0 ? 'OK' : 'ORPHAN_RECORDS_FOUND'
    })
  } catch (error) {
    console.error('Check DB error:', error)
    return NextResponse.json({
      error: 'Ошибка сервера',
      details: String(error)
    }, { status: 500 })
  }
}
