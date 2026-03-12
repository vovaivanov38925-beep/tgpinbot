import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const result = await db.pin.deleteMany()

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Удалено ${result.count} пинов`
    })
  } catch (error) {
    console.error('Clear pins error:', error)
    return NextResponse.json({
      error: 'Ошибка сервера',
      details: String(error)
    }, { status: 500 })
  }
}
