import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSubscription } from '@/lib/subscriptions'
import { logger } from '@/lib/logger'
import { sendTelegramMessage } from '@/lib/telegram'

/**
 * Подтверждение TON платежа
 * Может вызываться:
 * 1. Вебхуком от TON API (если настроен)
 * 2. Ручной проверкой через cron
 * 3. Пользователем после оплаты
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transactionId, txHash } = body

    if (!transactionId) {
      return NextResponse.json({ error: 'Требуется transactionId' }, { status: 400 })
    }

    // Получаем транзакцию
    const transaction = await db.paymentTransaction.findUnique({
      where: { id: transactionId }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Транзакция не найдена' }, { status: 404 })
    }

    if (transaction.status === 'completed') {
      return NextResponse.json({ success: true, message: 'Уже подтверждено' })
    }

    // В реальном приложении здесь нужно проверить транзакцию в блокчейне TON
    // Для демонстрации считаем, что если вызван этот endpoint - платёж прошёл

    const plan = transaction.planType as 'month' | 'year' | 'lifetime'
    const userId = transaction.userId

    // Обновляем транзакцию
    await db.paymentTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'completed',
        providerTxId: txHash || transaction.providerTxId,
        metadata: JSON.stringify({
          ...(transaction.metadata ? JSON.parse(transaction.metadata) : {}),
          confirmedAt: new Date().toISOString(),
          txHash
        })
      }
    })

    // Создаём подписку
    await createSubscription({
      userId,
      plan,
      provider: 'telegram_stars', // Используем существующий тип
      amount: transaction.amount,
      currency: 'TON',
      transactionId
    })

    // Получаем пользователя для отправки сообщения
    const user = await db.user.findUnique({ where: { id: userId } })

    // Отправляем сообщение об успехе
    const planLabels = {
      month: 'на месяц',
      year: 'на год',
      lifetime: 'навсегда'
    }

    if (user?.telegramChatId) {
      await sendTelegramMessage({
        chat_id: Number(user.telegramChatId),
        text: `🎉 <b>Оплата TON прошла успешно!</b>

👑 Вы оформили Premium подписку ${planLabels[plan]}

✨ Теперь вам доступны все преимущества:
• Безлимитные пины
• Умные напоминания
• Двойные очки
• Эксклюзивные достижения

Спасибо за поддержку! 💜`,
        parse_mode: 'HTML'
      })
    }

    await logger.info('payments', 'TON payment confirmed', {
      transactionId,
      userId,
      plan,
      txHash
    })

    return NextResponse.json({
      success: true,
      message: 'Платёж подтверждён',
      plan
    })
  } catch (error) {
    console.error('Error confirming TON payment:', error)
    await logger.error('payments', 'Error confirming TON payment', { error: String(error) })
    return NextResponse.json({ error: 'Ошибка подтверждения' }, { status: 500 })
  }
}
