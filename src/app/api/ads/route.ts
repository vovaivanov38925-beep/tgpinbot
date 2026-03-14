import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// GET - Get all ads or single ad
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const status = searchParams.get('status')

    if (id) {
      const ad = await db.ad.findUnique({ where: { id } })
      if (!ad) {
        return NextResponse.json({ error: 'Ad not found' }, { status: 404 })
      }
      return NextResponse.json(ad)
    }

    const where = status ? { status } : {}
    const ads = await db.ad.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(ads)
  } catch (error) {
    console.error('Error fetching ads:', error)
    await logger.error('api', 'Error fetching ads', { error: String(error) })
    return NextResponse.json({ error: 'Failed to fetch ads' }, { status: 500 })
  }
}

// POST - Create new ad
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      content,
      imageUrl,
      linkUrl,
      buttonText,
      targetAll,
      targetPremium,
      targetFree,
      scheduledAt,
      createdBy
    } = body

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    const ad = await db.ad.create({
      data: {
        title,
        content,
        imageUrl: imageUrl || null,
        linkUrl: linkUrl || null,
        buttonText: buttonText || null,
        targetAll: targetAll ?? true,
        targetPremium: targetPremium ?? false,
        targetFree: targetFree ?? false,
        status: scheduledAt ? 'scheduled' : 'draft',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        createdBy: createdBy || null
      }
    })

    await logger.info('api', 'Ad created', { adId: ad.id, title })

    return NextResponse.json(ad)
  } catch (error) {
    console.error('Error creating ad:', error)
    await logger.error('api', 'Error creating ad', { error: String(error) })
    return NextResponse.json({ error: 'Failed to create ad' }, { status: 500 })
  }
}

// PATCH - Update ad
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Ad ID is required' }, { status: 400 })
    }

    // Convert scheduledAt string to Date if present
    if (updateData.scheduledAt) {
      updateData.scheduledAt = new Date(updateData.scheduledAt)
    }

    const ad = await db.ad.update({
      where: { id },
      data: updateData
    })

    await logger.info('api', 'Ad updated', { adId: ad.id })

    return NextResponse.json(ad)
  } catch (error) {
    console.error('Error updating ad:', error)
    await logger.error('api', 'Error updating ad', { error: String(error) })
    return NextResponse.json({ error: 'Failed to update ad' }, { status: 500 })
  }
}

// DELETE - Delete ad
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Ad ID is required' }, { status: 400 })
    }

    await db.ad.delete({ where: { id } })
    await logger.info('api', 'Ad deleted', { adId: id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting ad:', error)
    await logger.error('api', 'Error deleting ad', { error: String(error) })
    return NextResponse.json({ error: 'Failed to delete ad' }, { status: 500 })
  }
}
