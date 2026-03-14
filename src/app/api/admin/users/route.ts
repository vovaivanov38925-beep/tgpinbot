import { NextRequest, NextResponse } from 'next/server'
import { db as prisma } from '@/lib/db'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
    const isPremium = searchParams.get('isPremium')
    
    const where: Record<string, unknown> = {}
    
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { username: { contains: search } },
        { telegramId: { contains: search } }
      ]
    }
    
    if (isPremium !== null && isPremium !== undefined) {
      where.isPremium = isPremium === 'true'
    }
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          _count: { select: { pins: true, tasks: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.user.count({ where })
    ])
    
    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Users error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
    
    const { userId, updates } = await request.json()
    
    if (!userId || !updates) {
      return NextResponse.json({ error: 'Неверные данные' }, { status: 400 })
    }
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: updates
    })
    
    await logAdminAction(
      admin.id,
      'update_user',
      'user',
      userId,
      { updates }
    )
    
    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ error: 'ID пользователя обязателен' }, { status: 400 })
    }
    
    await prisma.user.delete({
      where: { id: userId }
    })
    
    await logAdminAction(
      admin.id,
      'delete_user',
      'user',
      userId
    )
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
