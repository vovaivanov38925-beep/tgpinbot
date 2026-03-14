import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Актуальные курсы (будут обновляться)
const DEFAULT_STAR_RATE = 1.5  // 1 Star = 1.5 RUB (примерно $0.015 при курсе 100)
const DEFAULT_TON_RATE = 280   // 1 TON = 280 RUB

// Базовые цены в рублях
const BASE_PRICES = {
  month: 299,
  year: 1999,
  lifetime: 4999
}

/**
 * Получить актуальные цены для всех способов оплаты
 */
export async function GET(request: NextRequest) {
  try {
    // Получаем настройки оплаты
    let settings = await db.paymentSettings.findFirst()

    if (!settings) {
      settings = await db.paymentSettings.create({
        data: {}
      })
    }

    // Получаем актуальные курсы
    const starRate = settings.starToRubRate || DEFAULT_STAR_RATE
    const tonRate = settings.tonToRubRate || DEFAULT_TON_RATE

    // Рассчитываем цены в Stars
    const starsPrices = {
      month: Math.round(BASE_PRICES.month / starRate),
      year: Math.round(BASE_PRICES.year / starRate),
      lifetime: Math.round(BASE_PRICES.lifetime / starRate)
    }

    // Рассчитываем цены в TON
    const tonPrices = {
      month: Math.round((BASE_PRICES.month / tonRate) * 10) / 10,
      year: Math.round((BASE_PRICES.year / tonRate) * 10) / 10,
      lifetime: Math.round((BASE_PRICES.lifetime / tonRate) * 10) / 10
    }

    // Цены в рублях (для YooKassa)
    const rubPrices = {
      month: BASE_PRICES.month,
      year: BASE_PRICES.year,
      lifetime: BASE_PRICES.lifetime
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
        updatedAt: settings.ratesUpdatedAt
      },
      enabled: {
        stars: settings.starsEnabled,
        ton: settings.tonEnabled,
        yookassa: settings.yookassaEnabled
      },
      tonWallet: settings.tonWalletAddress
    })
  } catch (error) {
    console.error('Error getting prices:', error)
    return NextResponse.json({ error: 'Ошибка получения цен' }, { status: 500 })
  }
}

/**
 * Обновить курсы валют (вызывается кроном или вручную)
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
