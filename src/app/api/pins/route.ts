import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addPointsToUser, checkAndAwardAchievements, POINTS } from '@/lib/notifications'
import { logger } from '@/lib/logger'

// GET - Get all pins for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const category = searchParams.get('category')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { userId }
    if (category) where.category = category

    const pins = await db.pin.findMany({
      where,
      include: { tasks: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(pins)
  } catch (error) {
    console.error('Error fetching pins:', error)
    await logger.error('api', 'Error fetching pins', { error: String(error) })
    return NextResponse.json({ error: 'Failed to fetch pins' }, { status: 500 })
  }
}

// POST - Create a new pin
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, imageUrl, title, description, category, sourceUrl } = body

    if (!userId || !imageUrl) {
      return NextResponse.json({ error: 'User ID and image URL are required' }, { status: 400 })
    }

    // Validate URL - block Pinterest page URLs
    const isPinterestPage =
      imageUrl.includes('pinterest.com/pin/') && !imageUrl.includes('pinimg.com')
    if (isPinterestPage) {
      return NextResponse.json(
        { error: 'Используйте прямую ссылку на изображение (i.pinimg.com/...)' },
        { status: 400 }
      )
    }

    // Create pin
    const pin = await db.pin.create({
      data: {
        userId,
        imageUrl,
        title: title || null,
        description: description || null,
        category: category || null,
        sourceUrl: sourceUrl || null,
      },
    })

    // Add points
    const { newLevel, levelUp } = await addPointsToUser(userId, POINTS.PIN_CREATED, 'pin_created')

    // Check achievements
    const { newAchievements, totalPoints: achievementPoints } = await checkAndAwardAchievements(userId)
    if (achievementPoints > 0) {
      await addPointsToUser(userId, achievementPoints, 'achievement')
    }

    await logger.info('api', 'Pin created', {
      pinId: pin.id,
      category,
      userId,
      pointsEarned: POINTS.PIN_CREATED + achievementPoints,
      levelUp,
      achievements: newAchievements.length,
    })

    return NextResponse.json({
      ...pin,
      points: POINTS.PIN_CREATED + achievementPoints,
      levelUp,
      newLevel: levelUp ? newLevel : undefined,
      newAchievements,
    })
  } catch (error) {
    console.error('Error creating pin:', error)
    await logger.error('api', 'Error creating pin', { error: String(error) })
    return NextResponse.json({ error: 'Failed to create pin' }, { status: 500 })
  }
}

// PATCH - Update a pin
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Pin ID is required' }, { status: 400 })
    }

    const pin = await db.pin.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(pin)
  } catch (error) {
    console.error('Error updating pin:', error)
    await logger.error('api', 'Error updating pin', { error: String(error) })
    return NextResponse.json({ error: 'Failed to update pin' }, { status: 500 })
  }
}

// DELETE - Delete a pin
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Pin ID is required' }, { status: 400 })
    }

    await db.pin.delete({ where: { id } })
    await logger.info('api', 'Pin deleted', { pinId: id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting pin:', error)
    await logger.error('api', 'Error deleting pin', { error: String(error) })
    return NextResponse.json({ error: 'Failed to delete pin' }, { status: 500 })
  }
}
