import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTelegramMessage, getMainKeyboard } from '@/lib/telegram'
import { logger } from '@/lib/logger'

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || ''

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
 * GET - Получить список тикетов
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')

    const where: any = {}

    if (status && status !== 'all') {
      where.status = status
    }

    if (category && category !== 'all') {
      where.category = category
    }

    if (search) {
      where.OR = [
        { firstMessage: { contains: search, mode: 'insensitive' } },
        { lastMessage: { contains: search, mode: 'insensitive' } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [tickets, total] = await Promise.all([
      db.supportTicket.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              telegramId: true,
            }
          },
          _count: {
            select: { messages: true }
          }
        },
        orderBy: [
          { status: 'asc' }, // open first
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.supportTicket.count({ where }),
    ])

    // Добавляем статистику
    const stats = await db.supportTicket.groupBy({
      by: ['status'],
      _count: true,
    })

    const statsFormatted = stats.reduce((acc, s) => {
      acc[s.status] = s._count
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      tickets: tickets.map(t => ({
        ...t,
        statusInfo: STATUS_LABELS[t.status] || STATUS_LABELS.open,
        categoryInfo: SUPPORT_CATEGORIES[t.category] || SUPPORT_CATEGORIES.general,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
      stats: {
        total: Object.values(statsFormatted).reduce((a, b) => a + b, 0),
        open: statsFormatted.open || 0,
        in_progress: statsFormatted.in_progress || 0,
        waiting_user: statsFormatted.waiting_user || 0,
        resolved: statsFormatted.resolved || 0,
        closed: statsFormatted.closed || 0,
      }
    })
  } catch (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }
}

/**
 * POST - Создать новый тикет (или ответить от имени админа)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ticketId, message, adminId, adminName, status } = body

    // Ответ на тикет
    if (action === 'reply' && ticketId && message) {
      const ticket = await db.supportTicket.findUnique({
        where: { id: ticketId },
        include: { user: true }
      })

      if (!ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
      }

      // Сохраняем сообщение
      await db.supportMessage.create({
        data: {
          ticketId: ticket.id,
          senderType: 'admin',
          senderId: adminId,
          senderName: adminName || 'Поддержка',
          message,
        }
      })

      // Обновляем тикет
      await db.supportTicket.update({
        where: { id: ticketId },
        data: {
          lastMessage: message,
          lastMessageAt: new Date(),
          lastMessageFrom: 'admin',
          status: 'waiting_user',
        }
      })

      // Отправляем уведомление пользователю
      const shortId = ticket.id.slice(-8).toUpperCase()
      const userText = `👨‍💼 <b>Ответ поддержки</b>

🎫 <b>Тикет:</b> #${shortId}

💬 <b>Сообщение:</b>
${message}

━━━━━━━━━━━━━━━━━━━━
👇 Нажми кнопку ниже, чтобы ответить или посмотреть историю.`

      const inlineKeyboard = {
        inline_keyboard: [
          [{ text: '💬 Ответить', callback_data: `ticket_reply_${ticket.id}` }],
          [{ text: '📋 Мои обращения', callback_data: `ticket_my_tickets` }],
        ]
      }

      await sendTelegramMessage({
        chat_id: Number(ticket.chatId),
        text: userText,
        reply_markup: inlineKeyboard,
      })

      await logger.info('admin', 'Admin replied to ticket', {
        ticketId,
        adminId,
      })

      return NextResponse.json({ success: true, message: 'Reply sent' })
    }

    // Изменить статус тикета
    if (action === 'update_status' && ticketId) {
      const updateData: any = { status }

      if (status === 'closed') {
        updateData.closedAt = new Date()
      } else if (status === 'resolved') {
        updateData.resolvedAt = new Date()
      }

      const ticket = await db.supportTicket.update({
        where: { id: ticketId },
        data: updateData,
        include: { user: true }
      })

      // Уведомляем пользователя при закрытии
      if (status === 'closed' || status === 'resolved') {
        const shortId = ticket.id.slice(-8).toUpperCase()
        const statusText = status === 'resolved' ? 'решён' : 'закрыт'

        await sendTelegramMessage({
          chat_id: Number(ticket.chatId),
          text: `✅ <b>Ваше обращение ${statusText}</b>

🎫 <b>Тикет:</b> #${shortId}

Спасибо за обращение! Если у тебя остались вопросы, создай новый тикет через "💬 Техподдержка".`,
          reply_markup: getMainKeyboard(),
        })
      }

      await logger.info('admin', 'Ticket status updated', {
        ticketId,
        status,
        adminId,
      })

      return NextResponse.json({ success: true, ticket })
    }

    // Назначить админа на тикет
    if (action === 'assign' && ticketId) {
      const ticket = await db.supportTicket.update({
        where: { id: ticketId },
        data: {
          assignedTo: adminId,
          assignedAt: new Date(),
          status: 'in_progress',
        }
      })

      return NextResponse.json({ success: true, ticket })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in support API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
