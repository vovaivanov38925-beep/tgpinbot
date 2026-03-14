import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSubscription } from '@/lib/subscriptions'
import { logger } from '@/lib/logger'
import { sendTelegramMessage } from '@/lib/telegram'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

/**
 * Webhook для обработки успешной оплаты Stars
 * Вызывается через pre_checkout_query и successful_payment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Обработка pre_checkout_query - нужно ответить быстро
    if (body.pre_checkout_query) {
      const preCheckoutQuery = body.pre_checkout_query
      const payload = preCheckoutQuery.invoice_payload

      // Парсим payload
      const parts = payload.split('_')
      if (parts.length < 4 || parts[0] !== 'sub') {
        // Отклоняем платёж
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pre_checkout_query_id: preCheckoutQuery.id,
            ok: false,
            error_message: 'Неверный формат платежа'
          })
        })
        return NextResponse.json({ ok: true })
      }

      // Подтверждаем платёж
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query_id: preCheckoutQuery.id,
          ok: true
        })
      })

      await logger.info('payments', 'Pre-checkout confirmed', { payload })
      return NextResponse.json({ ok: true })
    }

    // Обработка successful_payment из сообщения
    if (body.message?.successful_payment) {
      const payment = body.message.successful_payment
      const telegramId = String(body.message.from.id)
      const payload = payment.invoice_payload
      const totalAmount = payment.total_amount

      // Парсим payload: sub_transactionId_userId_plan_timestamp
      const parts = payload.split('_')
      if (parts.length < 4 || parts[0] !== 'sub') {
        await logger.error('payments', 'Invalid payment payload', { payload })
        return NextResponse.json({ ok: true })
      }

      const transactionId = parts[1]
      const userId = parts[2]
      const plan = parts[3] as 'month' | 'year' | 'lifetime'

      // Обновляем транзакцию
      await db.paymentTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'completed',
          providerTxId: payment.telegram_payment_charge_id,
          metadata: JSON.stringify({
            payload,
            chargeId: payment.telegram_payment_charge_id,
            providerPaymentChargeId: payment.provider_payment_charge_id
          })
        }
      })

      // Создаём подписку
      await createSubscription({
        userId,
        plan,
        provider: 'telegram_stars',
        amount: totalAmount,
        currency: 'XTR',
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
          text: `🎉 <b>Оплата прошла успешно!</b>

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

      await logger.info('payments', 'Stars payment completed', {
        transactionId,
        userId,
        plan,
        amount: totalAmount
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error processing Stars webhook:', error)
    await logger.error('payments', 'Error processing Stars webhook', { error: String(error) })
    return NextResponse.json({ ok: true })
  }
}
