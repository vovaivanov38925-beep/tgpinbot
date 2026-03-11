/**
 * Notification Service
 * Упрощённый сервис уведомлений
 */

import { db } from './db'
import {
  sendTelegramMessage,
  sendAchievementNotification,
  sendLevelUpNotification,
  sendTaskCompletedNotification,
} from './telegram'
import { logger } from './logger'

const POINTS_PER_LEVEL = 100

export const POINTS = {
  PIN_CREATED: 10,
  TASK_COMPLETED_BASE: 5,
  TASK_COMPLETED_HIGH_PRIORITY: 15,
  ACHIEVEMENT_BONUS: 50,
  PREMIUM_MULTIPLIER: 2,
}

export interface NotificationResult {
  sent: boolean
  type: string
  error?: string
}

export function calculateLevel(points: number): number {
  return Math.floor(points / POINTS_PER_LEVEL) + 1
}

/**
 * Check and award achievements for a user
 */
export async function checkAndAwardAchievements(userId: string): Promise<{
  newAchievements: Array<{ name: string; description: string; points: number }>
  totalPoints: number
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          pins: true,
          tasks: { where: { status: 'completed' } },
        },
      },
      achievements: { include: { achievement: true } },
    },
  })

  if (!user) return { newAchievements: [], totalPoints: 0 }

  const allAchievements = await db.achievement.findMany()
  const unlockedIds = user.achievements.map((a) => a.achievementId)
  const newAchievements: Array<{ name: string; description: string; points: number }> = []
  let totalPoints = 0

  for (const achievement of allAchievements) {
    if (unlockedIds.includes(achievement.id)) continue

    let shouldUnlock = false
    if (achievement.category === 'pins' && user._count.pins >= achievement.requirement) {
      shouldUnlock = true
    }
    if (achievement.category === 'tasks' && user._count.tasks >= achievement.requirement) {
      shouldUnlock = true
    }
    if (achievement.category === 'social' && user.level >= achievement.requirement) {
      shouldUnlock = true
    }

    if (shouldUnlock) {
      await db.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      })
      newAchievements.push({
        name: achievement.name,
        description: achievement.description,
        points: achievement.points,
      })
      totalPoints += achievement.points
    }
  }

  return { newAchievements, totalPoints }
}

/**
 * Add points to user and check for level up
 */
export async function addPointsToUser(
  userId: string,
  points: number,
  reason: string
): Promise<{
  newPoints: number
  newLevel: number
  levelUp: boolean
  previousLevel: number
}> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')

  const actualPoints = user.isPremium ? points * POINTS.PREMIUM_MULTIPLIER : points
  const newPoints = user.points + actualPoints
  const previousLevel = user.level
  const newLevel = calculateLevel(newPoints)
  const levelUp = newLevel > previousLevel

  await db.user.update({
    where: { id: userId },
    data: { points: newPoints, level: newLevel },
  })

  await logger.info('gamification', 'Points added', {
    userId, points: actualPoints, reason, newPoints, newLevel, levelUp,
  })

  return { newPoints, newLevel, levelUp, previousLevel }
}

/**
 * Process notifications after an action
 */
export async function processNotifications(
  userId: string,
  action: 'pin_created' | 'task_completed',
  data: {
    pinTitle?: string
    pinCategory?: string | null
    taskTitle?: string
    taskPriority?: string
    points: number
  }
): Promise<{
  points: number
  levelUp: boolean
  newLevel?: number
  notifications: NotificationResult[]
  newAchievements: Array<{ name: string; description: string; points: number }>
}> {
  const notifications: NotificationResult[] = []
  const user = await db.user.findUnique({ where: { id: userId } })
  const isPremium = user?.isPremium || false

  const actualPoints = isPremium ? data.points * POINTS.PREMIUM_MULTIPLIER : data.points
  const { newLevel, levelUp } = await addPointsToUser(userId, data.points, action)

  // Send notification for task completion
  if (action === 'task_completed' && data.taskTitle && user?.telegramChatId) {
    const displayPoints = isPremium ? data.points * POINTS.PREMIUM_MULTIPLIER : data.points
    const result = await sendTaskCompletedNotification(user.telegramChatId, data.taskTitle, displayPoints)
    notifications.push({ sent: result.ok, type: 'task_completed' })
  }

  // Check for level up
  if (levelUp && user?.telegramChatId) {
    const result = await sendLevelUpNotification(user.telegramChatId, newLevel)
    notifications.push({ sent: result.ok, type: 'level_up' })
  }

  // Check for new achievements
  const { newAchievements, totalPoints: achievementPoints } = await checkAndAwardAchievements(userId)

  for (const achievement of newAchievements) {
    if (user?.telegramChatId) {
      const result = await sendAchievementNotification(
        user.telegramChatId,
        achievement.name,
        achievement.description,
        achievement.points
      )
      notifications.push({ sent: result.ok, type: 'achievement' })
    }
  }

  if (achievementPoints > 0) {
    await addPointsToUser(userId, achievementPoints, 'achievement')
  }

  return {
    points: actualPoints + achievementPoints,
    levelUp,
    newLevel: levelUp ? newLevel : undefined,
    notifications,
    newAchievements,
  }
}

/**
 * Get premium reminder times - calculates optimal reminders based on time until due
 */
export async function getPremiumReminderTimes(
  userId: string,
  dueDate: Date
): Promise<Array<{ time: Date; type: 'day' | 'hour' | '15min' }>> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user?.isPremium) return []

  const now = new Date()
  const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
  const reminders: Array<{ time: Date; type: 'day' | 'hour' | '15min' }> = []

  // Smart reminder calculation
  if (hoursUntilDue > 24) {
    const dayBefore = new Date(dueDate)
    dayBefore.setDate(dayBefore.getDate() - 1)
    dayBefore.setHours(10, 0, 0, 0)
    reminders.push({ time: dayBefore, type: 'day' })
  }

  if (hoursUntilDue > 1) {
    const hourBefore = new Date(dueDate.getTime() - 60 * 60 * 1000)
    reminders.push({ time: hourBefore, type: 'hour' })
  }

  if (hoursUntilDue > 0.25) {
    const fifteenMinBefore = new Date(dueDate.getTime() - 15 * 60 * 1000)
    reminders.push({ time: fifteenMinBefore, type: '15min' })
  }

  return reminders
}
