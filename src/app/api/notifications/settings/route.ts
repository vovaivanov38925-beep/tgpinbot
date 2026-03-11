import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// GET - Get notification settings for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get user to check premium status
    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get or create settings
    let settings = await db.notificationSettings.findUnique({
      where: { userId },
    })

    if (!settings) {
      settings = await db.notificationSettings.create({
        data: { userId },
      })
    }

    // Return settings with premium info
    return NextResponse.json({
      ...settings,
      isPremium: user.isPremium,
      // Premium features are only available for premium users
      premiumFeaturesAvailable: user.isPremium,
    })
  } catch (error) {
    console.error('Error fetching notification settings:', error)
    await logger.error('api', 'Error fetching notification settings', {
      error: String(error),
    })
    return NextResponse.json(
      { error: 'Failed to fetch notification settings' },
      { status: 500 }
    )
  }
}

// PATCH - Update notification settings
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, ...updateData } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get user to check premium status
    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Filter premium settings for non-premium users
    const premiumFields = ['reminderDayBefore', 'reminderHourBefore', 'reminder15MinBefore']

    if (!user.isPremium) {
      // Remove premium fields from update data
      premiumFields.forEach((field) => {
        delete updateData[field]
      })
    }

    // Validate quiet hours
    if (updateData.quietHoursStart !== undefined) {
      const start = Number(updateData.quietHoursStart)
      if (isNaN(start) || start < 0 || start > 23) {
        return NextResponse.json(
          { error: 'Invalid quiet hours start (must be 0-23)' },
          { status: 400 }
        )
      }
    }

    if (updateData.quietHoursEnd !== undefined) {
      const end = Number(updateData.quietHoursEnd)
      if (isNaN(end) || end < 0 || end > 23) {
        return NextResponse.json(
          { error: 'Invalid quiet hours end (must be 0-23)' },
          { status: 400 }
        )
      }
    }

    // Upsert settings
    const settings = await db.notificationSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...updateData,
      },
      update: updateData,
    })

    await logger.info('api', 'Notification settings updated', {
      userId,
      changes: Object.keys(updateData),
    })

    return NextResponse.json({
      ...settings,
      isPremium: user.isPremium,
    })
  } catch (error) {
    console.error('Error updating notification settings:', error)
    await logger.error('api', 'Error updating notification settings', {
      error: String(error),
    })
    return NextResponse.json(
      { error: 'Failed to update notification settings' },
      { status: 500 }
    )
  }
}

// POST - Reset to default settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, action } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (action === 'reset') {
      const settings = await db.notificationSettings.upsert({
        where: { userId },
        create: { userId },
        update: {
          taskReminders: true,
          newPins: true,
          achievements: true,
          levelUp: true,
          taskCompleted: true,
          reminderDayBefore: false,
          reminderHourBefore: false,
          reminder15MinBefore: false,
          quietHoursStart: 22,
          quietHoursEnd: 8,
        },
      })

      await logger.info('api', 'Notification settings reset to defaults', { userId })

      return NextResponse.json(settings)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error resetting notification settings:', error)
    await logger.error('api', 'Error resetting notification settings', {
      error: String(error),
    })
    return NextResponse.json(
      { error: 'Failed to reset notification settings' },
      { status: 500 }
    )
  }
}
