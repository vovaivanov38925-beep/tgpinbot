import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin-auth'
import {
  getSubscriptionsPaginated,
  getSubscriptionsStats,
  grantSubscription,
  revokeSubscription,
  getUserSubscriptions,
  checkExpiredSubscriptions
} from '@/lib/subscriptions'

// GET - получение списка подписок или статистики
export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    // Проверка истекших подписок
    if (action === 'check-expired') {
      const count = await checkExpiredSubscriptions()
      return NextResponse.json({
        success: true,
        expiredCount: count,
        message: `Updated ${count} expired subscriptions`
      })
    }

    // Статистика
    if (action === 'stats') {
      const stats = await getSubscriptionsStats()
      return NextResponse.json({ success: true, stats })
    }

    // Подписки конкретного пользователя
    const userId = searchParams.get('userId')
    if (userId && action === 'user') {
      const subscriptions = await getUserSubscriptions(userId)
      return NextResponse.json({ success: true, subscriptions })
    }

    // Пагинированный список
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') as any
    const plan = searchParams.get('plan') as any
    const provider = searchParams.get('provider') as any
    const search = searchParams.get('search') || undefined

    const result = await getSubscriptionsPaginated({
      page,
      limit,
      status,
      plan,
      provider,
      search
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Admin Subscriptions API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// POST - выдача подписки вручную
export async function POST(request: NextRequest) {
  try {
    console.log('[Admin Subscriptions] POST request received')
    
    const admin = await getCurrentAdmin()
    console.log('[Admin Subscriptions] Admin:', admin)
    
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const body = await request.json()
    console.log('[Admin Subscriptions] Request body:', body)
    
    const { action, userId, plan, subscriptionId, reason } = body

    // Выдать подписку
    if (action === 'grant') {
      console.log('[Admin Subscriptions] Granting subscription:', { userId, plan, reason })
      
      if (!userId || !plan) {
        return NextResponse.json(
          { error: 'userId и plan обязательны' },
          { status: 400 }
        )
      }

      // Проверяем пользователя
      const users = await db.$queryRaw<any[]>`
        SELECT id FROM users WHERE id = ${userId}
      `

      if (!users || users.length === 0) {
        return NextResponse.json(
          { error: 'Пользователь не найден' },
          { status: 404 }
        )
      }

      console.log('[Admin Subscriptions] Creating subscription...')
      const subscription = await grantSubscription({
        userId,
        plan,
        adminId: admin.id,
        reason
      })
      
      console.log('[Admin Subscriptions] Subscription created:', subscription)

      // Логируем действие
      await logAdminAction(
        admin.id,
        'grant_subscription',
        'subscription',
        subscription.id,
        { userId, plan, reason }
      )

      return NextResponse.json({
        success: true,
        subscription,
        message: `Подписка ${plan} выдана пользователю`
      })
    }

    // Отозвать подписку
    if (action === 'revoke') {
      if (!subscriptionId) {
        return NextResponse.json(
          { error: 'subscriptionId обязателен' },
          { status: 400 }
        )
      }

      const subscription = await revokeSubscription({
        subscriptionId,
        adminId: admin.id,
        reason
      })

      // Логируем действие
      await logAdminAction(
        admin.id,
        'revoke_subscription',
        'subscription',
        subscriptionId,
        { userId: subscription.userId, reason }
      )

      return NextResponse.json({
        success: true,
        subscription,
        message: 'Подписка отозвана'
      })
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[Admin Subscriptions API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}
