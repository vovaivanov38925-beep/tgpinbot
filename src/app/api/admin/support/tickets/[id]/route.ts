import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Категории поддержки
const SUPPORT_CATEGORIES: Record<string, { label: string; emoji: string }> = {
  general: { label: '📢 Общий вопрос', emoji: '📢' },
  bug: { label: '🐛 Баг/Ошибка', emoji: '🐛' },
  feature: { label: '💡 Предложение', emoji: '💡' },
  payment: { label: '💳 Оплата', emoji: '💳' },
  account: { label: '👤 Аккаунт', emoji: '👤' },
}

// Статусы
const STATUS_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  open: { label: 'Открыт', emoji: '🟢', color: 'green' },
  in_progress: { label: 'В работе', emoji: '🟡', color: 'yellow' },
  waiting_user: { label: 'Ожидает пользователя', emoji: '🔵', color: 'blue' },
  resolved: { label: 'Решён', emoji: '✅', color: 'green' },
  closed: { label: 'Закрыт', emoji: '⚫', color: 'gray' },
}

/**
 * GET - Получить детали тикета
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const ticket = await db.supportTicket.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            telegramId: true,
            isPremium: true,
            level: true,
            points: true,
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...ticket,
      statusInfo: STATUS_LABELS[ticket.status] || STATUS_LABELS.open,
      categoryInfo: SUPPORT_CATEGORIES[ticket.category] || SUPPORT_CATEGORIES.general,
    })
  } catch (error) {
    console.error('Error fetching ticket:', error)
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 })
  }
}
