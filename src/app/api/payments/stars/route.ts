import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSubscription } from '@/lib/subscriptions'
import { logger } from '@/lib/logger'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

// Названия планов для отображения
const PLAN_TITLES = {
  month: 'Pinterest Pro — Месяц',
  year: 'Pinterest Pro — Год',
  lifetime: 'Pinterest Pro — Навсегда'
}

const PLAN_DESCRIPTIONS = {
  month: 'Премиум подписка на 30 дней',
  year: 'Премиум подписка на 365 дней (выгода 40%)',
  lifetime: 'Премиум подписка навсегда'
}

/**
 * Создать ссылку на оплату через Telegram Stars
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
    if (!settings?.starsEnabled) {
      return NextResponse.json({ error: 'Оплата через Stars отключена' }, { status: 400 })
    }

    // Получаем цену в звёздах
    const priceStars = plan === 'month'
      ? settings.starsMonthPrice
      : plan === 'year'
        ? settings.starsYearPrice
        : settings.starsLifetimePrice

    if (!priceStars || priceStars < 1) {
      return NextResponse.json({ error: 'Цена не настроена' }, { status: 400 })
    }

    // Создаём транзакцию для отслеживания
    const transaction = await db.paymentTransaction.create({
      data: {
        userId,
        amount: priceStars,
        currency: 'XTR', // Telegram Stars currency code
        status: 'pending',
        provider: 'telegram_stars',
        planType: plan
      }
    })

    // Формируем payload для идентификации платежа
    const payload = `sub_${transaction.id}_${userId}_${plan}_${Date.now()}`

    // Создаём invoice link через Telegram Bot API
    const invoiceResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: PLAN_TITLES[plan],
        description: PLAN_DESCRIPTIONS[plan],
        payload: payload,
        provider_token: '', // Пустая строка для Stars
        currency: 'XTR',
        prices: [{ label: PLAN_TITLES[plan], amount: priceStars }],
        need_name: false,
        need_phone_number: false,
        need_email: false,
        need_shipping_address: false,
        is_flexible: false
      })
    })

    const invoiceData = await invoiceResponse.json()

    if (!invoiceData.ok) {
      console.error('Telegram invoice error:', invoiceData)
      await db.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: 'failed', metadata: JSON.stringify({ error: invoiceData.description }) }
      })
      return NextResponse.json({
        error: 'Ошибка создания счёта',
        details: invoiceData.description
      }, { status: 500 })
    }

    // Сохраняем payload в транзакции
    await db.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        providerTxId: payload,
        metadata: JSON.stringify({ invoiceLink: invoiceData.result, payload })
      }
    })

    await logger.info('payments', 'Stars invoice created', {
      transactionId: transaction.id,
      userId,
      plan,
      priceStars,
      payload
    })

    return NextResponse.json({
      success: true,
      invoiceLink: invoiceData.result,
      transactionId: transaction.id,
      priceStars
    })
  } catch (error) {
    console.error('Error creating Stars payment:', error)
    await logger.error('payments', 'Error creating Stars payment', { error: String(error) })
    return NextResponse.json({ error: 'Ошибка создания оплаты' }, { status: 500 })
  }
}

/**
 * Получить статус платежа
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

    return NextResponse.json({
      status: transaction.status,
      plan: transaction.planType,
      createdAt: transaction.createdAt
    })
  } catch (error) {
    console.error('Error getting payment status:', error)
    return NextResponse.json({ error: 'Ошибка получения статуса' }, { status: 500 })
  }
}
