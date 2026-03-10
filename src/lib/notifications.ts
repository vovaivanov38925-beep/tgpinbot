/**
 * Notification Service
 * Управление уведомлениями с поддержкой Free и Premium режимов
 */

import { db } from './db'
import {
  sendTelegramMessage,
  sendAchievementNotification,
  sendLevelUpNotification,
  sendTaskCompletedNotification,
  sendNewPinNotification,
  sendTaskReminder,
} from './telegram'
import { logger } from './logger'

// Points needed for each level
const POINTS_PER_LEVEL = 100

// Points for different actions
export const POINTS = {
  PIN_CREATED: 10,
  TASK_COMPLETED_BASE: 5,
  TASK_COMPLETED_HIGH_PRIORITY: 15,
  ACHIEVEMENT_BONUS: 50,
  PREMIUM_MULTIPLIER: 2, // Premium users get double points
}

export interface NotificationResult {
  sent: boolean
  type: string
  error?: string
}

/**
 * Get or create notification settings for a user
 */
export async function getNotificationSettings(userId: string) {
  let settings = await db.notificationSettings.findUnique({
    where: { userId },
  })

  if (!settings) {
    // Create default settings
    settings = await db.notificationSettings.create({
      data: { userId },
    })
  }

  return settings
}

/**
 * Check if current time is within quiet hours
 */
export function isInQuietHours(settings: {
  quietHoursStart: number
  quietHoursEnd: number
}): boolean {
  const now = new Date()
  const currentHour = now.getHours()

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (settings.quietHoursStart > settings.quietHoursEnd) {
    return currentHour >= settings.quietHoursStart || currentHour < settings.quietHoursEnd
  }

  return currentHour >= settings.quietHoursStart && currentHour < settings.quietHoursEnd
}

/**
 * Calculate new level based on points
 */
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
  // Get user with stats
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          pins: true,
          tasks: { where: { status: 'completed' } },
        },
      },
      achievements: {
        include: { achievement: true },
      },
    },
  })

  if (!user) {
    return { newAchievements: [], totalPoints: 0 }
  }

  // Get all achievements
  const allAchievements = await db.achievement.findMany()
  const unlockedIds = user.achievements.map((a) => a.achievementId)

  const newAchievements: Array<{ name: string; description: string; points: number }> = []
  let totalPoints = 0

  // Check pin achievements
  for (const achievement of allAchievements.filter((a) => a.category === 'pins')) {
    if (!unlockedIds.includes(achievement.id) && user._count.pins >= achievement.requirement) {
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

  // Check task achievements
  for (const achievement of allAchievements.filter((a) => a.category === 'tasks')) {
    if (!unlockedIds.includes(achievement.id) && user._count.tasks >= achievement.requirement) {
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

  // Check level achievements
  for (const achievement of allAchievements.filter((a) => a.category === 'social')) {
    if (!unlockedIds.includes(achievement.id) && user.level >= achievement.requirement) {
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
  const user = await db.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Premium users get double points
  const actualPoints = user.isPremium ? points * POINTS.PREMIUM_MULTIPLIER : points
  const newPoints = user.points + actualPoints
  const previousLevel = user.level
  const newLevel = calculateLevel(newPoints)
  const levelUp = newLevel > previousLevel

  // Update user
  await db.user.update({
    where: { id: userId },
    data: {
      points: newPoints,
      level: newLevel,
    },
  })

  await logger.info('gamification', 'Points added', {
    userId,
    points: actualPoints,
    reason,
    newPoints,
    newLevel,
    levelUp,
  })

  return { newPoints, newLevel, levelUp, previousLevel }
}

/**
 * Send notification about new pin
 */
export async function notifyNewPin(
  userId: string,
  pinTitle: string,
  category?: string | null
): Promise<NotificationResult> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { notificationSettings: true },
    })

    if (!user?.telegramChatId) {
      return { sent: false, type: 'new_pin', error: 'No chat ID' }
    }

    // Check settings
    const settings = user.notificationSettings || (await getNotificationSettings(userId))
    if (!settings.newPins) {
      return { sent: false, type: 'new_pin', error: 'Disabled in settings' }
    }

    // Check quiet hours
    if (isInQuietHours(settings)) {
      return { sent: false, type: 'new_pin', error: 'Quiet hours' }
    }

    const result = await sendNewPinNotification(user.telegramChatId, pinTitle, category)

    await logger.info('notification', 'Pin notification sent', {
      userId,
      pinTitle,
      success: result.ok,
    })

    return { sent: result.ok, type: 'new_pin' }
  } catch (error) {
    return { sent: false, type: 'new_pin', error: String(error) }
  }
}

/**
 * Send notification about task completion
 */
export async function notifyTaskCompleted(
  userId: string,
  taskTitle: string,
  points: number
): Promise<NotificationResult> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { notificationSettings: true },
    })

    if (!user?.telegramChatId) {
      return { sent: false, type: 'task_completed', error: 'No chat ID' }
    }

    // Check settings
    const settings = user.notificationSettings || (await getNotificationSettings(userId))
    if (!settings.taskCompleted) {
      return { sent: false, type: 'task_completed', error: 'Disabled in settings' }
    }

    // Check quiet hours
    if (isInQuietHours(settings)) {
      return { sent: false, type: 'task_completed', error: 'Quiet hours' }
    }

    // Premium users get double points notification
    const displayPoints = user.isPremium ? points * POINTS.PREMIUM_MULTIPLIER : points

    const result = await sendTaskCompletedNotification(user.telegramChatId, taskTitle, displayPoints)

    await logger.info('notification', 'Task completed notification sent', {
      userId,
      taskTitle,
      points: displayPoints,
      success: result.ok,
    })

    return { sent: result.ok, type: 'task_completed' }
  } catch (error) {
    return { sent: false, type: 'task_completed', error: String(error) }
  }
}

/**
 * Send notification about level up
 */
export async function notifyLevelUp(
  userId: string,
  newLevel: number
): Promise<NotificationResult> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { notificationSettings: true },
    })

    if (!user?.telegramChatId) {
      return { sent: false, type: 'level_up', error: 'No chat ID' }
    }

    // Check settings
    const settings = user.notificationSettings || (await getNotificationSettings(userId))
    if (!settings.levelUp) {
      return { sent: false, type: 'level_up', error: 'Disabled in settings' }
    }

    // Check quiet hours
    if (isInQuietHours(settings)) {
      return { sent: false, type: 'level_up', error: 'Quiet hours' }
    }

    const result = await sendLevelUpNotification(user.telegramChatId, newLevel)

    await logger.info('notification', 'Level up notification sent', {
      userId,
      newLevel,
      success: result.ok,
    })

    return { sent: result.ok, type: 'level_up' }
  } catch (error) {
    return { sent: false, type: 'level_up', error: String(error) }
  }
}

/**
 * Send notification about new achievement
 */
export async function notifyAchievement(
  userId: string,
  name: string,
  description: string,
  points: number
): Promise<NotificationResult> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { notificationSettings: true },
    })

    if (!user?.telegramChatId) {
      return { sent: false, type: 'achievement', error: 'No chat ID' }
    }

    // Check settings
    const settings = user.notificationSettings || (await getNotificationSettings(userId))
    if (!settings.achievements) {
      return { sent: false, type: 'achievement', error: 'Disabled in settings' }
    }

    // Check quiet hours
    if (isInQuietHours(settings)) {
      return { sent: false, type: 'achievement', error: 'Quiet hours' }
    }

    const result = await sendAchievementNotification(
      user.telegramChatId,
      name,
      description,
      points
    )

    await logger.info('notification', 'Achievement notification sent', {
      userId,
      achievement: name,
      success: result.ok,
    })

    return { sent: result.ok, type: 'achievement' }
  } catch (error) {
    return { sent: false, type: 'achievement', error: String(error) }
  }
}

/**
 * Process all notifications after an action
 * This is the main entry point for sending notifications
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
  let totalPoints = data.points

  // Get user for premium check
  const user = await db.user.findUnique({ where: { id: userId } })
  const isPremium = user?.isPremium || false

  // Add points (Premium users get double)
  const actualPoints = isPremium ? data.points * POINTS.PREMIUM_MULTIPLIER : data.points
  const { newPoints, newLevel, levelUp, previousLevel } = await addPointsToUser(
    userId,
    data.points,
    action
  )

  // Send action-specific notification
  if (action === 'pin_created' && data.pinTitle) {
    const result = await notifyNewPin(userId, data.pinTitle, data.pinCategory)
    notifications.push(result)
  }

  if (action === 'task_completed' && data.taskTitle) {
    const result = await notifyTaskCompleted(userId, data.taskTitle, data.points)
    notifications.push(result)
  }

  // Check for level up
  if (levelUp) {
    const result = await notifyLevelUp(userId, newLevel)
    notifications.push(result)
  }

  // Check for new achievements
  const { newAchievements, totalPoints: achievementPoints } = await checkAndAwardAchievements(userId)

  // Send achievement notifications
  for (const achievement of newAchievements) {
    const result = await notifyAchievement(
      userId,
      achievement.name,
      achievement.description,
      achievement.points
    )
    notifications.push(result)
  }

  // Add achievement points to user
  if (achievementPoints > 0) {
    await addPointsToUser(userId, achievementPoints, 'achievement')
    totalPoints += achievementPoints
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
 * Get premium reminder times for a task
 * Returns array of reminder times based on user settings
 */
export async function getPremiumReminderTimes(
  userId: string,
  dueDate: Date
): Promise<Array<{ time: Date; type: 'day' | 'hour' | '15min' }>> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { notificationSettings: true },
  })

  if (!user?.isPremium) {
    // Free users only get the main reminder
    return []
  }

  const settings = user.notificationSettings
  const reminders: Array<{ time: Date; type: 'day' | 'hour' | '15min' }> = []

  if (settings?.reminderDayBefore) {
    const dayBefore = new Date(dueDate)
    dayBefore.setDate(dayBefore.getDate() - 1)
    dayBefore.setHours(12, 0, 0, 0) // Noon the day before
    reminders.push({ time: dayBefore, type: 'day' })
  }

  if (settings?.reminderHourBefore) {
    const hourBefore = new Date(dueDate)
    hourBefore.setHours(hourBefore.getHours() - 1)
    reminders.push({ time: hourBefore, type: 'hour' })
  }

  if (settings?.reminder15MinBefore) {
    const minutes15Before = new Date(dueDate)
    minutes15Before.setMinutes(minutes15Before.getMinutes() - 15)
    reminders.push({ time: minutes15Before, type: '15min' })
  }

  return reminders
}

/**
 * Send a premium reminder with custom message
 */
export async function sendPremiumReminder(
  chatId: string | number,
  taskTitle: string,
  reminderType: 'day' | 'hour' | '15min',
  dueDate: Date
): Promise<NotificationResult> {
  const timeText = {
    day: 'завтра',
    hour: 'через час',
    '15min': 'через 15 минут',
  }

  const urgencyEmoji = {
    day: '📅',
    hour: '⏰',
    '15min': '🚨',
  }

  const text = `${urgencyEmoji[reminderType]} <b>Напоминание</b>

📋 <b>${taskTitle}</b>

⏱️ Срок: ${timeText[reminderType]}!
${reminderType === '15min' ? 'Пора готовиться!' : 'Не забудьте!'}`

  const result = await sendTelegramMessage({ chat_id: chatId, text })

  return { sent: result.ok, type: `reminder_${reminderType}` }
}
