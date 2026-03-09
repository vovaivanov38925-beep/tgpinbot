import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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
    const category = searchParams.get('category')
    const userId = searchParams.get('userId')

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } }
      ]
    }

    if (category) {
      where.category = category
    }

    if (userId) {
      where.userId = userId
    }

    const [pins, total] = await Promise.all([
      db.pin.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, username: true, telegramId: true }
          },
          _count: { select: { tasks: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.pin.count({ where })
    ])

    return NextResponse.json({
      pins,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Admin pins error:', error)
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
    const pinId = searchParams.get('pinId')

    if (!pinId) {
      return NextResponse.json({ error: 'ID пина обязателен' }, { status: 400 })
    }

    await db.pin.delete({
      where: { id: pinId }
    })

    await logAdminAction(
      admin.id,
      'delete_pin',
      'pin',
      pinId
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete pin error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { pinId, updates } = await request.json()

    if (!pinId || !updates) {
      return NextResponse.json({ error: 'Неверные данные' }, { status: 400 })
    }

    const pin = await db.pin.update({
      where: { id: pinId },
      data: updates
    })

    await logAdminAction(
      admin.id,
      'update_pin',
      'pin',
      pinId,
      { updates }
    )

    return NextResponse.json({ success: true, pin })
  } catch (error) {
    console.error('Update pin error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
