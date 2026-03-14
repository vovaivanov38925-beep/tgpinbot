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

    const results = await db.$queryRaw<any[]>`
      SELECT * FROM payment_settings LIMIT 1
    `

    let settings = results[0] || null

    // Если нет настроек - создаём
    if (!settings) {
      await db.$executeRaw`
        INSERT INTO payment_settings (id, starsenabled, starsmonthprice, starsyearprice, starslifetimeprice, yookassaenabled, currency, trialdays, updatedat)
        VALUES ('default', true, 200, 1333, 3333, false, 'RUB', 7, NOW())
      `

      const newResults = await db.$queryRaw<any[]>`
        SELECT * FROM payment_settings LIMIT 1
      `
      settings = newResults[0]
    }

    const response = {
      id: settings.id,
      starsEnabled: settings.starsenabled ?? true,
      starsMonthPrice: settings.starsmonthprice ?? 200,
      starsYearPrice: settings.starsyearprice ?? 1333,
      starsLifetimePrice: settings.starslifetimeprice ?? 3333,
      yookassaEnabled: settings.yookassaenabled ?? false,
      yookassaShopId: settings.yookassashopid ?? null,
      yookassaSecretKey: settings.yookassasecretkey ?? null,
      yookassaMonthPrice: settings.yookassamonthprice ?? 29900,
      yookassaYearPrice: settings.yookassayearprice ?? 199900,
      yookassaLifetimePrice: settings.yookassalifetimeprice ?? 499900,
      tonEnabled: settings.tonenabled ?? false,
      tonMonthPrice: settings.tonmonthprice ?? 1.1,
      tonYearPrice: settings.tonyearprice ?? 7.2,
      tonLifetimePrice: settings.tonlifetimeprice ?? 18,
      tonWalletAddress: settings.tonwalletaddress ?? null,
      currency: settings.currency ?? 'RUB',
      trialDays: settings.trialdays ?? 7,
      starToRubRate: settings.startorubrate ?? 1.5,
      tonToRubRate: settings.tontorubrate ?? 280,
      ratesUpdatedAt: settings.ratesupdatedat ?? null
    }

    return NextResponse.json({ settings: response })
  } catch (error) {
    console.error('Get payment settings error:', error)
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

    const results = await db.$queryRaw<any[]>`
      SELECT id FROM payment_settings LIMIT 1
    `

    const existingId = results[0]?.id

    if (existingId) {
      await db.$executeRaw`
        UPDATE payment_settings SET
          starsenabled = ${data.starsEnabled ?? false},
          starsmonthprice = ${data.starsMonthPrice ?? 200},
          starsyearprice = ${data.starsYearPrice ?? 1333},
          starslifetimeprice = ${data.starsLifetimePrice ?? 3333},
          yookassaenabled = ${data.yookassaEnabled ?? false},
          yookassashopid = ${data.yookassaShopId || null},
          yookassasecretkey = ${data.yookassaSecretKey || null},
          yookassamonthprice = ${data.yookassaMonthPrice ?? 29900},
          yookassayearprice = ${data.yookassaYearPrice ?? 199900},
          yookassalifetimeprice = ${data.yookassaLifetimePrice ?? 499900},
          tonenabled = ${data.tonEnabled ?? false},
          tonmonthprice = ${data.tonMonthPrice ?? 1.1},
          tonyearprice = ${data.tonYearPrice ?? 7.2},
          tonlifetimeprice = ${data.tonLifetimePrice ?? 18},
          tonwalletaddress = ${data.tonWalletAddress || null},
          currency = ${data.currency || 'RUB'},
          trialdays = ${data.trialDays ?? 7},
          startorubrate = ${data.starToRubRate ?? 1.5},
          tontorubrate = ${data.tonToRubRate ?? 280},
          updatedat = NOW()
        WHERE id = ${existingId}
      `
    } else {
      await db.$executeRaw`
        INSERT INTO payment_settings (id, starsenabled, starsmonthprice, starsyearprice, starslifetimeprice, yookassaenabled, tonenabled, tonwalletaddress, currency, trialdays, updatedat)
        VALUES ('default', ${data.starsEnabled ?? true}, ${data.starsMonthPrice ?? 200}, ${data.starsYearPrice ?? 1333}, ${data.starsLifetimePrice ?? 3333}, ${data.yookassaEnabled ?? false}, ${data.tonEnabled ?? false}, ${data.tonWalletAddress || null}, ${data.currency || 'RUB'}, ${data.trialDays ?? 7}, NOW())
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
