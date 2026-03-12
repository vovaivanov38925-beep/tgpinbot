import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// GET - Get all broadcasts or single broadcast
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const status = searchParams.get('status')

    if (id) {
      const broadcast = await db.broadcast.findUnique({
        where: { id },
        include: {
          broadcastLogs: {
            take: 100,
            orderBy: { sentAt: 'desc' }
          }
        }
      })
      if (!broadcast) {
        return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
      }
      return NextResponse.json(broadcast)
    }

    const where = status ? { status } : {}
    const broadcasts = await db.broadcast.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(broadcasts)
  } catch (error) {
    console.error('Error fetching broadcasts:', error)
    await logger.error('api', 'Error fetching broadcasts', { error: String(error) })
    return NextResponse.json({ error: 'Failed to fetch broadcasts' }, { status: 500 })
  }
}

// POST - Create new broadcast
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      content,
      imageUrl,
      targetAll,
      targetPremium,
      targetFree,
      scheduledAt,
      createdBy
    } = body

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    // Count recipients
    let recipientCount = 0
    if (targetAll || (!targetPremium && !targetFree)) {
      recipientCount = await db.user.count({ where: { telegramChatId: { not: null } } })
    } else if (targetPremium && targetFree) {
      recipientCount = await db.user.count({ where: { telegramChatId: { not: null } } })
    } else if (targetPremium) {
      recipientCount = await db.user.count({ where: { telegramChatId: { not: null }, isPremium: true } })
    } else if (targetFree) {
      recipientCount = await db.user.count({ where: { telegramChatId: { not: null }, isPremium: false } })
    }

    const broadcast = await db.broadcast.create({
      data: {
        title,
        content,
        imageUrl: imageUrl || null,
        targetAll: targetAll ?? true,
        targetPremium: targetPremium ?? false,
        targetFree: targetFree ?? false,
        status: scheduledAt ? 'scheduled' : 'draft',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        totalRecipients: recipientCount,
        createdBy: createdBy || null
      }
    })

    await logger.info('api', 'Broadcast created', { broadcastId: broadcast.id, title, recipients: recipientCount })

    return NextResponse.json(broadcast)
  } catch (error) {
    console.error('Error creating broadcast:', error)
    await logger.error('api', 'Error creating broadcast', { error: String(error) })
    return NextResponse.json({ error: 'Failed to create broadcast' }, { status: 500 })
  }
}

// PATCH - Update broadcast
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Broadcast ID is required' }, { status: 400 })
    }

    // Convert dates if present
    if (updateData.scheduledAt) {
      updateData.scheduledAt = new Date(updateData.scheduledAt)
    }

    const broadcast = await db.broadcast.update({
      where: { id },
      data: updateData
    })

    await logger.info('api', 'Broadcast updated', { broadcastId: broadcast.id })

    return NextResponse.json(broadcast)
  } catch (error) {
    console.error('Error updating broadcast:', error)
    await logger.error('api', 'Error updating broadcast', { error: String(error) })
    return NextResponse.json({ error: 'Failed to update broadcast' }, { status: 500 })
  }
}

// DELETE - Delete broadcast
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Broadcast ID is required' }, { status: 400 })
    }

    await db.broadcast.delete({ where: { id } })
    await logger.info('api', 'Broadcast deleted', { broadcastId: id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting broadcast:', error)
    await logger.error('api', 'Error deleting broadcast', { error: String(error) })
    return NextResponse.json({ error: 'Failed to delete broadcast' }, { status: 500 })
  }
}
