import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// TON API endpoint (бесплатный)
const TON_API = 'https://toncenter.com/api/v2'

/**
 * Создать ссылку на оплату через TON
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, plan } = body as { userId: string; plan: 'month' | 'year' | 'lifetime' }

    if (!userId || !plan) {
      return NextResponse.json({ error: 'Требуется userId и plan' }, { status: 400 })
    }

    // Получаем настройки оплаты через raw query
    const settingsResults = await db.$queryRaw<any[]>`
      SELECT * FROM payment_settings LIMIT 1
    `
    const settings = settingsResults[0]

    if (!settings?.tonenabled) {
      return NextResponse.json({ error: 'Оплата через TON отключена' }, { status: 400 })
    }

    if (!settings.tonwalletaddress) {
      return NextResponse.json({ error: 'TON кошелёк не настроен' }, { status: 400 })
    }

    // Получаем цену в TON
    const priceTon = plan === 'month'
      ? settings.tonmonthprice
      : plan === 'year'
        ? settings.tonyearprice
        : settings.tonlifetimeprice

    if (!priceTon || priceTon < 0.1) {
      return NextResponse.json({ error: 'Цена не настроена' }, { status: 400 })
    }

    // Генерируем ID для транзакции
    const { cuid } = await import('@paralleldrive/cuid2')
    const transactionId = cuid()

    // Генерируем уникальный comment для идентификации платежа
    const comment = `tgp${transactionId.slice(-8)}`

    // Конвертируем в nanotons для ссылки
    const nanotons = Math.round(priceTon * 1000000000)

    // Формируем ссылки
    const tonDeeplink = `ton://transfer/${settings.tonwalletaddress}?amount=${nanotons}&text=${encodeURIComponent(comment)}`
    const httpsLink = `https://app.tonkeeper.com/transfer/${settings.tonwalletaddress}?amount=${nanotons}&text=${encodeURIComponent(comment)}`

    // Создаём транзакцию в БД через raw query
    await db.$queryRawUnsafe(`
      INSERT INTO payment_transactions (id, "userId", amount, currency, status, provider, "planType", metadata, "createdAt", "updatedAt")
      VALUES (
        '${transactionId}',
        '${userId}',
        ${nanotons},
        'TON',
        'pending',
        'ton',
        '${JSON.stringify({ comment, priceTon, walletAddress: settings.tonwalletaddress, plan }).replace(/'/g, "''")}',
        NOW(),
        NOW()
      )
    `)

    await logger.info('payments', 'TON payment created', {
      transactionId,
      userId,
      plan,
      priceTon,
      comment
    })

    return NextResponse.json({
      success: true,
      tonDeeplink,
      httpsLink,
      transactionId,
      priceTon,
      walletAddress: settings.tonwalletaddress,
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
 * Проверяет транзакции в блокчейне через TON API
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transactionId')

    if (!transactionId) {
      return NextResponse.json({ error: 'Требуется transactionId' }, { status: 400 })
    }

    // Получаем транзакцию из БД
    const txResults = await db.$queryRaw<any[]>`
      SELECT * FROM payment_transactions WHERE id = ${transactionId}
    `
    const transaction = txResults[0]

    if (!transaction) {
      return NextResponse.json({ error: 'Транзакция не найдена' }, { status: 404 })
    }

    if (transaction.status === 'completed') {
      return NextResponse.json({
        status: 'completed',
        plan: transaction.plantype,
        message: 'Оплата уже подтверждена'
      })
    }

    // Получаем настройки
    const settingsResults = await db.$queryRaw<any[]>`
      SELECT * FROM payment_settings LIMIT 1
    `
    const settings = settingsResults[0]

    if (!settings?.tonwalletaddress) {
      return NextResponse.json({ error: 'Кошелёк не настроен' }, { status: 400 })
    }

    // Парсим metadata
    const metadata = transaction.metadata ? JSON.parse(transaction.metadata) : {}
    const expectedComment = metadata.comment
    const expectedAmount = transaction.amount // в nanotons

    // Проверяем транзакции через TON API
    try {
      const response = await fetch(
        `${TON_API}/getTransactions?address=${settings.tonwalletaddress}&limit=20`,
        { headers: { 'Content-Type': 'application/json' } }
      )
      const data = await response.json()

      if (data.ok && data.result) {
        for (const tx of data.result) {
          // Проверяем входящую транзакцию
          if (tx.in_msg?.source) {
            const txComment = tx.in_msg.message || ''
            const txAmount = parseInt(tx.in_msg.value) || 0

            // Проверяем comment и сумму (с допуском ±5% на комиссии)
            if (txComment === expectedComment && txAmount >= expectedAmount * 0.95) {
              // Транзакция найдена! Подтверждаем оплату
              await db.$queryRawUnsafe(`
                UPDATE payment_transactions SET status = 'completed', "updatedAt" = NOW() WHERE id = '${transactionId}'
              `)

              // Создаём подписку
              const userId = transaction.userid
              const plan = transaction.plantype

              // Вычисляем дату истечения
              let expiresAt: string | null = null
              if (plan === 'month') {
                expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
              } else if (plan === 'year') {
                expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
              }

              // Создаём подписку
              const subscriptionId = (await import('@paralleldrive/cuid2')).cuid()
              await db.$queryRawUnsafe(`
                INSERT INTO subscriptions (id, "userId", plan, status, provider, "transactionId", amount, currency, "startedAt", "expiresAt", "createdAt", "updatedAt")
                VALUES (
                  '${subscriptionId}',
                  '${userId}',
                  '${plan}',
                  'active',
                  'ton',
                  '${transactionId}',
                  ${transaction.amount},
                  'TON',
                  NOW(),
                  ${expiresAt ? `'${expiresAt}'` : 'NULL'},
                  NOW(),
                  NOW()
                )
              `)

              // Обновляем пользователя до Premium
              await db.$queryRawUnsafe(`
                UPDATE users SET "isPremium" = true, "premiumExpiry" = ${expiresAt ? `'${expiresAt}'` : 'NULL'}, "updatedAt" = NOW() WHERE id = '${userId}'
              `)

              await logger.info('payments', 'TON payment confirmed', {
                transactionId,
                userId,
                plan,
                amount: txAmount
              })

              return NextResponse.json({
                status: 'completed',
                plan,
                message: 'Оплата подтверждена! Вы Premium!',
                confirmed: true
              })
            }
          }
        }
      }
    } catch (apiError) {
      console.error('TON API error:', apiError)
      // Не прерываем выполнение, просто логируем
    }

    // Транзакция пока не найдена
    return NextResponse.json({
      status: 'pending',
      plan: transaction.plantype,
      priceTon: transaction.amount / 1000000000,
      message: 'Оплата пока не найдена. Попробуйте через минуту.',
      confirmed: false
    })
  } catch (error) {
    console.error('Error checking TON payment:', error)
    return NextResponse.json({ error: 'Ошибка проверки статуса' }, { status: 500 })
  }
}
