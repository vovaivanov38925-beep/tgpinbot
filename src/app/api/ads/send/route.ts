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

async function sendTelegramAd(
  chatId: string | number,
  content: string,
  imageUrl?: string | null,
  linkUrl?: string | null,
  buttonText?: string | null
): Promise<TelegramResponse> {
  try {
    // Build inline keyboard if there's a link
    const reply_markup = linkUrl ? {
      inline_keyboard: [[{
        text: buttonText || 'Подробнее',
        url: linkUrl
      }]]
    } : undefined

    // If there's an image, send photo message
    if (imageUrl) {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: imageUrl,
          caption: content,
          parse_mode: 'HTML',
          reply_markup
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
        text: content,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        reply_markup
      })
    })
    return await response.json()
  } catch (error) {
    return { ok: false, description: String(error) }
  }
}

// POST - Send ad to users
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adId } = body

    if (!adId) {
      return NextResponse.json({ error: 'Ad ID is required' }, { status: 400 })
    }

    // Get ad
    const ad = await db.ad.findUnique({ where: { id: adId } })
    if (!ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 })
    }

    // Get recipients based on targeting
    let whereClause: Record<string, unknown> = { telegramChatId: { not: null } }

    if (!ad.targetAll) {
      if (ad.targetPremium && !ad.targetFree) {
        whereClause.isPremium = true
      } else if (ad.targetFree && !ad.targetPremium) {
        whereClause.isPremium = false
      }
    }

    const users = await db.user.findMany({
      where: whereClause,
      select: { id: true, telegramChatId: true }
    })

    await logger.info('api', 'Starting ad broadcast', {
      adId,
      title: ad.title,
      recipients: users.length
    })

    // Send messages with rate limiting
    let sentCount = 0
    let failedCount = 0

    for (let i = 0; i < users.length; i++) {
      const user = users[i]

      // Rate limiting - wait 35ms between messages
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 35))
      }

      const result = await sendTelegramAd(
        user.telegramChatId!,
        ad.content,
        ad.imageUrl,
        ad.linkUrl,
        ad.buttonText
      )

      if (result.ok) {
        sentCount++
      } else {
        failedCount++
      }

      // Update progress every 50 messages
      if ((i + 1) % 50 === 0) {
        await db.ad.update({
          where: { id: adId },
          data: { sentCount, status: 'active' }
        })
      }
    }

    // Final update
    const updatedAd = await db.ad.update({
      where: { id: adId },
      data: {
        status: 'completed',
        sentCount
      }
    })

    await logger.info('api', 'Ad broadcast completed', {
      adId,
      sentCount,
      failedCount
    })

    return NextResponse.json({
      success: true,
      ad: updatedAd,
      sentCount,
      failedCount
    })
  } catch (error) {
    console.error('Error sending ad:', error)
    await logger.error('api', 'Error sending ad', { error: String(error) })
    return NextResponse.json({ error: 'Failed to send ad' }, { status: 500 })
  }
}
