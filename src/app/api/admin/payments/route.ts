import { NextRequest, NextResponse } from 'next/server'
import { db as prisma } from '@/lib/db'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin-auth'

// Get payment settings
export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
    
    let settings = await prisma.paymentSettings.findFirst()
    
    if (!settings) {
      settings = await prisma.paymentSettings.create({
        data: {}
      })
    }
    
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Get payment settings error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
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
    
    let settings = await prisma.paymentSettings.findFirst()
    
    if (settings) {
      settings = await prisma.paymentSettings.update({
        where: { id: settings.id },
        data
      })
    } else {
      settings = await prisma.paymentSettings.create({
        data
      })
    }
    
    await logAdminAction(
      admin.id,
      'update_payment_settings',
      'payment_settings',
      settings.id,
      { updates: data }
    )
    
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('Update payment settings error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
