import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

interface TelegramResponse {
  ok: boolean
  result?: unknown
  description?: string
  error_code?: number
}

async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  imageUrl?: string | null
): Promise<TelegramResponse> {
  try {
    // If there's an image, send photo message
    if (imageUrl) {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: imageUrl,
          caption: text,
          parse_mode: 'HTML'
        })
      })
      return await response.json()
    }

    // Otherwise send text message
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    })
    return await response.json()
  } catch (error) {
    return { ok: false, description: String(error) }
  }
}

// POST - Send broadcast immediately
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { broadcastId } = body

    if (!broadcastId) {
      return NextResponse.json({ error: 'Broadcast ID is required' }, { status: 400 })
    }

    // Get broadcast
    const broadcast = await db.broadcast.findUnique({ where: { id: broadcastId } })
    if (!broadcast) {
      return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
    }

    if (broadcast.status === 'sent' || broadcast.status === 'sending') {
      return NextResponse.json({ error: 'Broadcast already sent or in progress' }, { status: 400 })
    }

    // Update status to sending
    await db.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'sending', startedAt: new Date() }
    })

    // Get recipients based on targeting
    let whereClause: Record<string, unknown> = { telegramChatId: { not: null } }

    if (!broadcast.targetAll) {
      if (broadcast.targetPremium && !broadcast.targetFree) {
        whereClause.isPremium = true
      } else if (broadcast.targetFree && !broadcast.targetPremium) {
        whereClause.isPremium = false
      }
    }

    const users = await db.user.findMany({
      where: whereClause,
      select: { id: true, telegramChatId: true, telegramId: true }
    })

    await logger.info('api', 'Starting broadcast', {
      broadcastId,
      title: broadcast.title,
      recipients: users.length
    })

    // Create broadcast logs for all recipients
    const logEntries = users.map(user => ({
      broadcastId,
      userId: user.id,
      telegramId: user.telegramId,
      status: 'pending' as const
    }))

    await db.broadcastLog.createMany({
      data: logEntries,
      skipDuplicates: true
    })

    // Send messages with rate limiting (30 messages per second max for Telegram)
    let sentCount = 0
    let failedCount = 0

    for (let i = 0; i < users.length; i++) {
      const user = users[i]

      // Rate limiting - wait 35ms between messages (≈28 per second)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 35))
      }

      const result = await sendTelegramMessage(
        user.telegramChatId!,
        broadcast.content,
        broadcast.imageUrl
      )

      if (result.ok) {
        sentCount++
        await db.broadcastLog.updateMany({
          where: { broadcastId, userId: user.id },
          data: { status: 'sent', sentAt: new Date() }
        })
      } else {
        failedCount++
        await db.broadcastLog.updateMany({
          where: { broadcastId, userId: user.id },
          data: { status: 'failed', error: result.description }
        })
      }

      // Update progress every 50 messages
      if ((i + 1) % 50 === 0) {
        await db.broadcast.update({
          where: { id: broadcastId },
          data: { sentCount, failedCount }
        })
      }
    }

    // Final update
    const updatedBroadcast = await db.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: 'sent',
        sentCount,
        failedCount,
        completedAt: new Date()
      }
    })

    await logger.info('api', 'Broadcast completed', {
      broadcastId,
      sentCount,
      failedCount
    })

    return NextResponse.json({
      success: true,
      broadcast: updatedBroadcast
    })
  } catch (error) {
    console.error('Error sending broadcast:', error)
    await logger.error('api', 'Error sending broadcast', { error: String(error) })
    return NextResponse.json({ error: 'Failed to send broadcast' }, { status: 500 })
  }
}
