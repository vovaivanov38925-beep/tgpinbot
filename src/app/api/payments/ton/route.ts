import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * Создать ссылку на оплату через TON
 * Использует ton:// deeplink для открытия кошелька
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, plan } = body as { userId: string; plan: 'month' | 'year' | 'lifetime' }

    if (!userId || !plan) {
      return NextResponse.json({ error: 'Требуется userId и plan' }, { status: 400 })
    }

    // Получаем пользователя
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    // Получаем настройки оплаты
    const settings = await db.paymentSettings.findFirst()
    if (!settings?.tonEnabled) {
      return NextResponse.json({ error: 'Оплата через TON отключена' }, { status: 400 })
    }

    if (!settings.tonWalletAddress) {
      return NextResponse.json({ error: 'TON кошелёк не настроен' }, { status: 400 })
    }

    // Получаем цену в TON
    const priceTon = plan === 'month'
      ? settings.tonMonthPrice
      : plan === 'year'
        ? settings.tonYearPrice
        : settings.tonLifetimePrice

    if (!priceTon || priceTon < 0.1) {
      return NextResponse.json({ error: 'Цена не настроена' }, { status: 400 })
    }

    // Создаём транзакцию для отслеживания
    const transaction = await db.paymentTransaction.create({
      data: {
        userId,
        amount: Math.round(priceTon * 1000000000), // храним в nanotons
        currency: 'TON',
        status: 'pending',
        provider: 'ton',
        planType: plan
      }
    })

    // Генерируем уникальный comment для идентификации платежа
    // TON позволяет добавить текстовый комментарий к транзакции
    const comment = `tgp${transaction.id.slice(-8)}`

    // Конвертируем в nanotons для ссылки
    const nanotons = Math.round(priceTon * 1000000000)

    // Формируем deeplink для TON
    // ton://transfer/<ADDRESS>?amount=<NANOTONS>&text=<COMMENT>
    const tonDeeplink = `ton://transfer/${settings.tonWalletAddress}?amount=${nanotons}&text=${encodeURIComponent(comment)}`

    // Альтернативная ссылка для универсальных deeplink
    const httpsLink = `https://app.tonkeeper.com/transfer/${settings.tonWalletAddress}?amount=${nanotons}&text=${encodeURIComponent(comment)}`

    // Сохраняем comment в транзакции
    await db.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        metadata: JSON.stringify({
          tonDeeplink,
          httpsLink,
          comment,
          priceTon,
          walletAddress: settings.tonWalletAddress
        })
      }
    })

    await logger.info('payments', 'TON payment created', {
      transactionId: transaction.id,
      userId,
      plan,
      priceTon,
      comment
    })

    return NextResponse.json({
      success: true,
      tonDeeplink,
      httpsLink,
      transactionId: transaction.id,
      priceTon,
      walletAddress: settings.tonWalletAddress,
      comment
    })
  } catch (error) {
    console.error('Error creating TON payment:', error)
    await logger.error('payments', 'Error creating TON payment', { error: String(error) })
    return NextResponse.json({ error: 'Ошибка создания оплаты' }, { status: 500 })
  }
}

/**
 * Проверить статус TON платежа
 * В реальном приложении здесь будет проверка через TON API
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transactionId')

    if (!transactionId) {
      return NextResponse.json({ error: 'Требуется transactionId' }, { status: 400 })
    }

    const transaction = await db.paymentTransaction.findUnique({
      where: { id: transactionId }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Транзакция не найдена' }, { status: 404 })
    }

    // Возвращаем текущий статус
    // В реальном приложении здесь была бы проверка через TON API
    return NextResponse.json({
      status: transaction.status,
      plan: transaction.planType,
      priceTon: transaction.amount / 1000000000,
      createdAt: transaction.createdAt,
      metadata: transaction.metadata ? JSON.parse(transaction.metadata) : null
    })
  } catch (error) {
    console.error('Error getting TON payment status:', error)
    return NextResponse.json({ error: 'Ошибка получения статуса' }, { status: 500 })
  }
}
