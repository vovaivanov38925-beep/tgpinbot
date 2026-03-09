import { NextResponse } from 'next/server'
import { getCurrentAdmin, ensureDefaultAdmin } from '@/lib/admin-auth'

export async function GET() {
  try {
    await ensureDefaultAdmin()
    const admin = await getCurrentAdmin()
    
    if (!admin) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      )
    }
    
    return NextResponse.json({ admin })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    )
  }
}
