import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPassword, generateToken, setAuthCookie, logAdminAction, ensureDefaultAdmin } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    // Ensure default admin exists
    await ensureDefaultAdmin()
    
    const { username, password } = await request.json()
    
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Введите имя пользователя и пароль' },
        { status: 400 }
      )
    }
    
    // Find admin
    const admin = await prisma.admin.findUnique({
      where: { username }
    })
    
    if (!admin || !admin.isActive) {
      return NextResponse.json(
        { error: 'Неверные учетные данные' },
        { status: 401 }
      )
    }
    
    // Verify password
    if (!verifyPassword(password, admin.passwordHash)) {
      return NextResponse.json(
        { error: 'Неверные учетные данные' },
        { status: 401 }
      )
    }
    
    // Generate token
    const token = generateToken({
      id: admin.id,
      username: admin.username,
      role: admin.role
    })
    
    // Update last login
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() }
    })
    
    // Log action
    await logAdminAction(
      admin.id,
      'login',
      undefined,
      undefined,
      undefined,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    )
    
    // Set cookie
    await setAuthCookie(token)
    
    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    )
  }
}
