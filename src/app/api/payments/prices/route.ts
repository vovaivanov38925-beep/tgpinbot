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
export async function GET(request: NextRequest) {
  try {
    // Пытаемся получить настройки оплаты
    let settings: any = null
    try {
      settings = await db.paymentSettings.findFirst()
    } catch (e) {
      console.log('PaymentSettings table not available, using defaults')
    }

    // Курсы валют
    const starRate = settings?.starToRubRate || DEFAULT_STAR_RATE
    const tonRate = settings?.tonToRubRate || DEFAULT_TON_RATE

    // Цены в Stars (из настроек или дефолтные)
    const starsPrices = {
      month: settings?.starsMonthPrice || BASE_PRICES_STARS.month,
      year: settings?.starsYearPrice || BASE_PRICES_STARS.year,
      lifetime: settings?.starsLifetimePrice || BASE_PRICES_STARS.lifetime
    }

    // Цены в TON
    const tonPrices = {
      month: settings?.tonMonthPrice || BASE_PRICES_TON.month,
      year: settings?.tonYearPrice || BASE_PRICES_TON.year,
      lifetime: settings?.tonLifetimePrice || BASE_PRICES_TON.lifetime
    }

    // Цены в рублях
    const rubPrices = {
      month: settings?.yookassaMonthPrice ? Math.round(settings.yookassaMonthPrice / 100) : BASE_PRICES_RUB.month,
      year: settings?.yookassaYearPrice ? Math.round(settings.yookassaYearPrice / 100) : BASE_PRICES_RUB.year,
      lifetime: settings?.yookassaLifetimePrice ? Math.round(settings.yookassaLifetimePrice / 100) : BASE_PRICES_RUB.lifetime
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
        updatedAt: settings?.ratesUpdatedAt || null
      },
      enabled: {
        stars: settings?.starsEnabled ?? true, // По умолчанию включено
        ton: settings?.tonEnabled ?? false,
        yookassa: settings?.yookassaEnabled ?? false
      },
      tonWallet: settings?.tonWalletAddress || null
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

    let settings = await db.paymentSettings.findFirst()

    if (!settings) {
      settings = await db.paymentSettings.create({
        data: {
          starToRubRate: starToRub || DEFAULT_STAR_RATE,
          tonToRubRate: tonToRub || DEFAULT_TON_RATE,
          ratesUpdatedAt: new Date()
        }
      })
    } else {
      settings = await db.paymentSettings.update({
        where: { id: settings.id },
        data: {
          starToRubRate: starToRub || settings.starToRubRate,
          tonToRubRate: tonToRub || settings.tonToRubRate,
          ratesUpdatedAt: new Date()
        }
      })
    }

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('Error updating rates:', error)
    return NextResponse.json({ error: 'Ошибка обновления курсов' }, { status: 500 })
  }
}
