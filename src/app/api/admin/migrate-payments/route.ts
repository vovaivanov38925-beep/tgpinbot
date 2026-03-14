import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

/**
 * Миграция: добавить недостающие колонки в payment_settings и payment_transactions
 * Вызывается через POST /api/admin/migrate-payments
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const results: string[] = []

    // PostgreSQL использует другой синтаксис для ADD COLUMN IF NOT EXISTS
    // Нужно проверять существование колонки через information_schema

    const addColumnIfNotExists = async (table: string, column: string, type: string, defaultValue: string) => {
      try {
        const exists = await db.$queryRaw<any[]>`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = ${table} AND column_name = ${column}
        `

        if (exists.length === 0) {
          await db.$executeRawUnsafe(
            `ALTER TABLE ${table} ADD COLUMN "${column}" ${type} DEFAULT ${defaultValue}`
          )
          return `Added ${column} to ${table}`
        }
        return `${column} already exists in ${table}`
      } catch (e: any) {
        return `${column}: ${e.message}`
      }
    }

    // Добавляем колонки в payment_settings
    results.push(await addColumnIfNotExists('payment_settings', 'tonEnabled', 'BOOLEAN', 'false'))
    results.push(await addColumnIfNotExists('payment_settings', 'tonMonthPrice', 'FLOAT', '1.1'))
    results.push(await addColumnIfNotExists('payment_settings', 'tonYearPrice', 'FLOAT', '7.2'))
    results.push(await addColumnIfNotExists('payment_settings', 'tonLifetimePrice', 'FLOAT', '18.0'))
    results.push(await addColumnIfNotExists('payment_settings', 'tonWalletAddress', 'TEXT', 'NULL'))
    results.push(await addColumnIfNotExists('payment_settings', 'starToRubRate', 'FLOAT', '1.5'))
    results.push(await addColumnIfNotExists('payment_settings', 'tonToRubRate', 'FLOAT', '280'))
    results.push(await addColumnIfNotExists('payment_settings', 'ratesUpdatedAt', 'TIMESTAMP', 'NULL'))
    results.push(await addColumnIfNotExists('payment_settings', 'starsMonthPrice', 'INTEGER', '200'))
    results.push(await addColumnIfNotExists('payment_settings', 'starsYearPrice', 'INTEGER', '1333'))
    results.push(await addColumnIfNotExists('payment_settings', 'starsLifetimePrice', 'INTEGER', '3333'))

    // Добавляем колонки в payment_transactions
    results.push(await addColumnIfNotExists('payment_transactions', 'provider', 'TEXT', "'yookassa'"))
    results.push(await addColumnIfNotExists('payment_transactions', 'planType', 'TEXT', "'month'"))

    // Создаём запись настроек если её нет
    try {
      const existing = await db.paymentSettings.findFirst()
      if (!existing) {
        await db.paymentSettings.create({
          data: {
            starsEnabled: true,
            starsMonthPrice: 200,
            starsYearPrice: 1333,
            starsLifetimePrice: 3333
          }
        })
        results.push('Created default payment_settings')
      } else {
        results.push('Payment settings already exist')
      }
    } catch (e: any) {
      results.push(`Create settings: ${e.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Миграция выполнена',
      results
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      error: 'Ошибка миграции',
      details: String(error)
    }, { status: 500 })
  }
}
