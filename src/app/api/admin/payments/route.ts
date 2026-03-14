import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin-auth'

// Get payment settings
export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    // Пытаемся получить настройки через raw query чтобы избежать проблем с новыми полями
    const results = await db.$queryRaw<any[]>`
      SELECT * FROM payment_settings LIMIT 1
    `

    let settings = results[0] || null

    // Если нет настроек - создаём с минимальными полями
    if (!settings) {
      await db.$executeRaw`
        INSERT INTO payment_settings (id, "starsEnabled", "starsMonthPrice", "starsYearPrice", "starsLifetimePrice", "yookassaEnabled", currency, "trialDays", "updatedAt")
        VALUES (gen_random_uuid(), true, 200, 1333, 3333, false, 'RUB', 7, NOW())
        RETURNING *
      `

      const newResults = await db.$queryRaw<any[]>`
        SELECT * FROM payment_settings LIMIT 1
      `
      settings = newResults[0]
    }

    // Устанавливаем дефолтные значения для новых полей если их нет
    const response = {
      id: settings.id,
      starsEnabled: settings.starsEnabled ?? true,
      starsMonthPrice: settings.starsMonthPrice ?? 200,
      starsYearPrice: settings.starsYearPrice ?? 1333,
      starsLifetimePrice: settings.starsLifetimePrice ?? 3333,
      yookassaEnabled: settings.yookassaEnabled ?? false,
      yookassaShopId: settings.yookassaShopId ?? null,
      yookassaSecretKey: settings.yookassaSecretKey ?? null,
      yookassaMonthPrice: settings.yookassaMonthPrice ?? 29900,
      yookassaYearPrice: settings.yookassaYearPrice ?? 199900,
      yookassaLifetimePrice: settings.yookassaLifetimePrice ?? 499900,
      tonEnabled: settings.tonEnabled ?? false,
      tonMonthPrice: settings.tonMonthPrice ?? 1.1,
      tonYearPrice: settings.tonYearPrice ?? 7.2,
      tonLifetimePrice: settings.tonLifetimePrice ?? 18,
      tonWalletAddress: settings.tonWalletAddress ?? null,
      currency: settings.currency ?? 'RUB',
      trialDays: settings.trialDays ?? 7,
      starToRubRate: settings.starToRubRate ?? 1.5,
      tonToRubRate: settings.tonToRubRate ?? 280,
      ratesUpdatedAt: settings.ratesUpdatedAt ?? null
    }

    return NextResponse.json({ settings: response })
  } catch (error) {
    console.error('Get payment settings error:', error)
    // Возвращаем дефолтные настройки при ошибке
    return NextResponse.json({
      settings: {
        id: 'default',
        starsEnabled: true,
        starsMonthPrice: 200,
        starsYearPrice: 1333,
        starsLifetimePrice: 3333,
        yookassaEnabled: false,
        yookassaShopId: null,
        yookassaSecretKey: null,
        yookassaMonthPrice: 29900,
        yookassaYearPrice: 199900,
        yookassaLifetimePrice: 499900,
        tonEnabled: false,
        tonMonthPrice: 1.1,
        tonYearPrice: 7.2,
        tonLifetimePrice: 18,
        tonWalletAddress: null,
        currency: 'RUB',
        trialDays: 7,
        starToRubRate: 1.5,
        tonToRubRate: 280,
        ratesUpdatedAt: null
      }
    })
  }
}

// Update payment settings
export async function PUT(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const data = await request.json()

    // Получаем существующие настройки
    const results = await db.$queryRaw<any[]>`
      SELECT id FROM payment_settings LIMIT 1
    `

    const existingId = results[0]?.id

    if (existingId) {
      // Обновляем существующие
      await db.$executeRaw`
        UPDATE payment_settings SET
          "starsEnabled" = ${data.starsEnabled ?? false},
          "starsMonthPrice" = ${data.starsMonthPrice ?? 200},
          "starsYearPrice" = ${data.starsYearPrice ?? 1333},
          "starsLifetimePrice" = ${data.starsLifetimePrice ?? 3333},
          "yookassaEnabled" = ${data.yookassaEnabled ?? false},
          "yookassaShopId" = ${data.yookassaShopId || null},
          "yookassaSecretKey" = ${data.yookassaSecretKey || null},
          "yookassaMonthPrice" = ${data.yookassaMonthPrice ?? 29900},
          "yookassaYearPrice" = ${data.yookassaYearPrice ?? 199900},
          "yookassaLifetimePrice" = ${data.yookassaLifetimePrice ?? 499900},
          currency = ${data.currency || 'RUB'},
          "trialDays" = ${data.trialDays ?? 7},
          "updatedAt" = NOW()
        WHERE id = ${existingId}
      `

      // Пытаемся обновить TON поля если они существуют
      try {
        await db.$executeRaw`
          UPDATE payment_settings SET
            "tonEnabled" = ${data.tonEnabled ?? false},
            "tonMonthPrice" = ${data.tonMonthPrice ?? 1.1},
            "tonYearPrice" = ${data.tonYearPrice ?? 7.2},
            "tonLifetimePrice" = ${data.tonLifetimePrice ?? 18},
            "tonWalletAddress" = ${data.tonWalletAddress || null},
            "starToRubRate" = ${data.starToRubRate ?? 1.5},
            "tonToRubRate" = ${data.tonToRubRate ?? 280}
          WHERE id = ${existingId}
        `
      } catch (e) {
        // Игнорируем ошибку если колонок ещё нет
        console.log('TON columns not yet migrated')
      }
    } else {
      // Создаём новые
      await db.$executeRaw`
        INSERT INTO payment_settings (id, "starsEnabled", "starsMonthPrice", "starsYearPrice", "starsLifetimePrice", "yookassaEnabled", currency, "trialDays", "updatedAt")
        VALUES (gen_random_uuid(), ${data.starsEnabled ?? true}, ${data.starsMonthPrice ?? 200}, ${data.starsYearPrice ?? 1333}, ${data.starsLifetimePrice ?? 3333}, ${data.yookassaEnabled ?? false}, ${data.currency || 'RUB'}, ${data.trialDays ?? 7}, NOW())
      `
    }

    await logAdminAction(
      admin.id,
      'update_payment_settings',
      'payment_settings',
      existingId || 'new',
      { updates: data }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update payment settings error:', error)
    return NextResponse.json({ error: 'Ошибка сервера: ' + String(error) }, { status: 500 })
  }
}
