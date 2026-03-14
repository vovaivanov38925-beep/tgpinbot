import { NextRequest, NextResponse } from 'next/server'
import { checkExpiredSubscriptions } from '@/lib/subscriptions'
import { logger } from '@/lib/logger'

/**
 * Cron Job: Проверка истекших подписок
 * Вызывается каждые 5-10 минут через cron сервис (Vercel Cron, Railway Scheduler, etc.)
 *
 * Пример настройки cron:
 * - Vercel: vercel.json -> "crons": [{ "path": "/api/cron/subscriptions", "schedule": "*/5 * * * *" }]
 * - Railway: Settings -> Schedule -> "*/5 * * * *"
 */

// Секретный ключ для защиты от несанкционированных вызовов
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  try {
    // Проверка авторизации cron (если задан секрет)
    const authHeader = request.headers.get('authorization')
    const urlSecret = request.nextUrl.searchParams.get('secret')

    if (CRON_SECRET) {
      const providedSecret = authHeader?.replace('Bearer ', '') || urlSecret
      if (providedSecret !== CRON_SECRET) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    const startTime = Date.now()

    // Проверяем и обновляем истекшие подписки
    const expiredCount = await checkExpiredSubscriptions()

    const duration = Date.now() - startTime

    // Логируем результат
    await logger.info('cron', 'Subscriptions check completed', {
      expiredCount,
      duration
    })

    return NextResponse.json({
      success: true,
      expiredCount,
      duration,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('[Cron Subscriptions] Error:', error)

    await logger.error('cron', 'Subscriptions check failed', {
      error: error.message
    })

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// POST тоже поддерживаем для гибкости
export async function POST(request: NextRequest) {
  return GET(request)
}
