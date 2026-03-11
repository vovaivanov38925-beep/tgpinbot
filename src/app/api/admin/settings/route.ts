import { NextRequest, NextResponse } from 'next/server'
import { db as prisma } from '@/lib/db'
import { getCurrentAdmin, logAdminAction, hashPassword } from '@/lib/admin-auth'

// Get app settings
export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
    
    const settings = await prisma.appSettings.findMany()
    
    const settingsMap: Record<string, string> = {}
    for (const s of settings) {
      settingsMap[s.key] = s.value
    }
    
    return NextResponse.json({ settings: settingsMap })
  } catch (error) {
    console.error('Get settings error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// Update app settings
export async function PUT(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
    
    const { key, value } = await request.json()
    
    const setting = await prisma.appSettings.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    })
    
    await logAdminAction(
      admin.id,
      'update_setting',
      'app_settings',
      setting.id,
      { key, value }
    )
    
    return NextResponse.json({ success: true, setting })
  } catch (error) {
    console.error('Update setting error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// Change admin password
export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
    
    const { currentPassword, newPassword } = await request.json()
    
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Введите текущий и новый пароль' }, { status: 400 })
    }
    
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть минимум 6 символов' }, { status: 400 })
    }
    
    // Get current admin with password
    const adminData = await prisma.admin.findUnique({
      where: { id: admin.id }
    })
    
    if (!adminData) {
      return NextResponse.json({ error: 'Админ не найден' }, { status: 404 })
    }
    
    // Verify current password
    const { verifyPassword } = await import('@/lib/admin-auth')
    if (!verifyPassword(currentPassword, adminData.passwordHash)) {
      return NextResponse.json({ error: 'Неверный текущий пароль' }, { status: 400 })
    }
    
    // Update password
    await prisma.admin.update({
      where: { id: admin.id },
      data: { passwordHash: hashPassword(newPassword) }
    })
    
    await logAdminAction(admin.id, 'change_password')
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
