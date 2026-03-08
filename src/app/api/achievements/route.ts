import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Get all achievements or user achievements
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (userId) {
      // Get user's achievements with progress
      const allAchievements = await db.achievement.findMany()
      const userAchievements = await db.userAchievement.findMany({
        where: { userId },
        include: { achievement: true }
      })

      const unlockedIds = userAchievements.map(ua => ua.achievementId)

      const achievementsWithStatus = allAchievements.map(achievement => ({
        ...achievement,
        unlocked: unlockedIds.includes(achievement.id),
        unlockedAt: userAchievements.find(ua => ua.achievementId === achievement.id)?.unlockedAt || null
      }))

      return NextResponse.json(achievementsWithStatus)
    } else {
      // Get all achievements
      const achievements = await db.achievement.findMany()
      return NextResponse.json(achievements)
    }
  } catch (error) {
    console.error('Error fetching achievements:', error)
    return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 })
  }
}

// POST - Unlock an achievement for a user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, achievementId } = body

    if (!userId || !achievementId) {
      return NextResponse.json({ error: 'User ID and achievement ID are required' }, { status: 400 })
    }

    // Check if already unlocked
    const existing = await db.userAchievement.findUnique({
      where: {
        userId_achievementId: { userId, achievementId }
      }
    })

    if (existing) {
      return NextResponse.json({ message: 'Achievement already unlocked', achievement: existing })
    }

    // Get achievement to award points
    const achievement = await db.achievement.findUnique({
      where: { id: achievementId }
    })

    if (!achievement) {
      return NextResponse.json({ error: 'Achievement not found' }, { status: 404 })
    }

    // Unlock achievement and award points
    const userAchievement = await db.userAchievement.create({
      data: { userId, achievementId }
    })

    await db.user.update({
      where: { id: userId },
      data: {
        points: { increment: achievement.points }
      }
    })

    return NextResponse.json({ ...userAchievement, achievement })
  } catch (error) {
    console.error('Error unlocking achievement:', error)
    return NextResponse.json({ error: 'Failed to unlock achievement' }, { status: 500 })
  }
}

// Check and unlock achievements based on user stats
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get user stats
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            pins: true,
            tasks: { where: { status: 'completed' } }
          }
        },
        achievements: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all achievements
    const allAchievements = await db.achievement.findMany()
    const unlockedIds = user.achievements.map(a => a.achievementId)

    const newUnlocks = []

    // Check pin achievements
    const pinAchievements = allAchievements.filter(a => a.category === 'pins')
    for (const achievement of pinAchievements) {
      if (!unlockedIds.includes(achievement.id) && user._count.pins >= achievement.requirement) {
        const unlock = await db.userAchievement.create({
          data: { userId, achievementId: achievement.id },
          include: { achievement: true }
        })
        newUnlocks.push(unlock)
      }
    }

    // Check task achievements
    const taskAchievements = allAchievements.filter(a => a.category === 'tasks')
    for (const achievement of taskAchievements) {
      if (!unlockedIds.includes(achievement.id) && user._count.tasks >= achievement.requirement) {
        const unlock = await db.userAchievement.create({
          data: { userId, achievementId: achievement.id },
          include: { achievement: true }
        })
        newUnlocks.push(unlock)
      }
    }

    // Check level achievements
    const levelAchievements = allAchievements.filter(a => a.category === 'social')
    for (const achievement of levelAchievements) {
      if (!unlockedIds.includes(achievement.id) && user.level >= achievement.requirement) {
        const unlock = await db.userAchievement.create({
          data: { userId, achievementId: achievement.id },
          include: { achievement: true }
        })
        newUnlocks.push(unlock)
      }
    }

    // Award points for new unlocks
    if (newUnlocks.length > 0) {
      const totalPoints = newUnlocks.reduce((sum, u) => sum + u.achievement.points, 0)
      await db.user.update({
        where: { id: userId },
        data: { points: { increment: totalPoints } }
      })
    }

    return NextResponse.json({ newUnlocks })
  } catch (error) {
    console.error('Error checking achievements:', error)
    return NextResponse.json({ error: 'Failed to check achievements' }, { status: 500 })
  }
}
