import { NextResponse } from 'next/server'
import { db as prisma } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
    
    // Get stats
    const [
      totalUsers,
      totalPins,
      totalTasks,
      completedTasks,
      premiumUsers,
      recentUsers,
      recentLogs
    ] = await Promise.all([
      prisma.user.count(),
      prisma.pin.count(),
      prisma.task.count(),
      prisma.task.count({ where: { status: 'completed' } }),
      prisma.user.count({ where: { isPremium: true } }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, firstName: true, username: true, createdAt: true }
      }),
      prisma.adminLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: { select: { username: true } }
        }
      })
    ])
    
    // Get users by day for last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const usersByDay = await prisma.user.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: true
    })
    
    // Get payments stats
    const paymentsStats = await prisma.paymentTransaction.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true },
      _count: true
    })
    
    return NextResponse.json({
      stats: {
        totalUsers,
        totalPins,
        totalTasks,
        completedTasks,
        premiumUsers,
        totalRevenue: paymentsStats._sum.amount || 0,
        totalPayments: paymentsStats._count || 0
      },
      recentUsers,
      recentLogs
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
