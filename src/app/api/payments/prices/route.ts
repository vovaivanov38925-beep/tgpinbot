import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Актуальные курсы
const DEFAULT_STAR_RATE = 1.5  // 1 Star ≈ 1.5 RUB
const DEFAULT_TON_RATE = 280   // 1 TON ≈ 280 RUB

// Базовые цены в рублях
const BASE_PRICES_RUB = {
  month: 299,
  year: 1999,
  lifetime: 4999
}

// Базовые цены в Stars (Telegram задаёт курс)
const BASE_PRICES_STARS = {
  month: 200,
  year: 1333,
  lifetime: 3333
}

// Базовые цены в TON
const BASE_PRICES_TON = {
  month: 1.1,
  year: 7.2,
  lifetime: 18
}

/**
 * Получить актуальные цены для всех способов оплаты
 */
export async function GET() {
  try {
    // Получаем настройки через raw query
    const results = await db.$queryRaw<any[]>`
      SELECT * FROM payment_settings LIMIT 1
    `
    const settings = results[0]

    // Курсы валют
    const starRate = settings?.startorubrate || DEFAULT_STAR_RATE
    const tonRate = settings?.tontorubrate || DEFAULT_TON_RATE

    // Цены в Stars (из настроек или дефолтные)
    const starsPrices = {
      month: settings?.starsmonthprice || BASE_PRICES_STARS.month,
      year: settings?.starsyearprice || BASE_PRICES_STARS.year,
      lifetime: settings?.starslifetimeprice || BASE_PRICES_STARS.lifetime
    }

    // Цены в TON
    const tonPrices = {
      month: settings?.tonmonthprice || BASE_PRICES_TON.month,
      year: settings?.tonyearprice || BASE_PRICES_TON.year,
      lifetime: settings?.tonlifetimeprice || BASE_PRICES_TON.lifetime
    }

    // Цены в рублях
    const rubPrices = {
      month: settings?.yookassamonthprice ? Math.round(settings.yookassamonthprice / 100) : BASE_PRICES_RUB.month,
      year: settings?.yookassayearprice ? Math.round(settings.yookassayearprice / 100) : BASE_PRICES_RUB.year,
      lifetime: settings?.yookassalifetimeprice ? Math.round(settings.yookassalifetimeprice / 100) : BASE_PRICES_RUB.lifetime
    }

    return NextResponse.json({
      prices: {
        stars: starsPrices,
        ton: tonPrices,
        rub: rubPrices
      },
      rates: {
        starToRub: starRate,
        tonToRub: tonRate,
        updatedAt: settings?.ratesupdatedat || null
      },
      enabled: {
        stars: settings?.starsenabled ?? true,
        ton: settings?.tonenabled ?? false,
        yookassa: settings?.yookassaenabled ?? false
      },
      tonWallet: settings?.tonwalletaddress || null
    })
  } catch (error) {
    console.error('Error getting prices:', error)
    // Возвращаем дефолтные цены при любой ошибке
    return NextResponse.json({
      prices: {
        stars: BASE_PRICES_STARS,
        ton: BASE_PRICES_TON,
        rub: BASE_PRICES_RUB
      },
      rates: {
        starToRub: DEFAULT_STAR_RATE,
        tonToRub: DEFAULT_TON_RATE,
        updatedAt: null
      },
      enabled: {
        stars: true,
        ton: false,
        yookassa: false
      },
      tonWallet: null
    })
  }
}

/**
 * Обновить курсы валют
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { starToRub, tonToRub } = body

    // Проверяем есть ли настройки
    const results = await db.$queryRaw<any[]>`
      SELECT id FROM payment_settings LIMIT 1
    `
    const existingId = results[0]?.id

    if (existingId) {
      await db.$queryRawUnsafe(`
        UPDATE payment_settings SET
          startorubrate = ${starToRub || DEFAULT_STAR_RATE},
          tontorubrate = ${tonToRub || DEFAULT_TON_RATE},
          ratesupdatedat = NOW()
        WHERE id = '${existingId}'
      `)
    } else {
      await db.$queryRawUnsafe(`
        INSERT INTO payment_settings (id, startorubrate, tontorubrate, ratesupdatedat)
        VALUES ('default', ${starToRub || DEFAULT_STAR_RATE}, ${tonToRub || DEFAULT_TON_RATE}, NOW())
      `)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating rates:', error)
    return NextResponse.json({ error: 'Ошибка обновления курсов' }, { status: 500 })
  }
}
