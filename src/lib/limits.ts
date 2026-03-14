/**
 * Limits System
 * Ограничения для Free и Premium пользователей
 */

import { db } from './db'

// Лимиты для пользователей
export const LIMITS = {
  FREE: {
    MAX_PINS: 50,                    // Максимум пинов
    MAX_TASKS: 20,                   // Максимум задач
    MAX_ACTIVE_TASKS: 10,            // Максимум активных задач (pending + in_progress)
    MAX_BOARDS: 1,                   // Максимум досок
    MAX_BOARDS_PER_DAY: 1,           // Синхронизаций досок в день
    MAX_PINS_PER_SYNC: 25,           // Максимум пинов за одну синхронизацию
    SMART_REMINDERS: false,          // Умные напоминания
    POINTS_MULTIPLIER: 1,            // Множитель очков
  },
  PREMIUM: {
    MAX_PINS: Infinity,              // Безлимит пинов
    MAX_TASKS: Infinity,             // Безлимит задач
    MAX_ACTIVE_TASKS: Infinity,      // Безлимит активных задач
    MAX_BOARDS: 3,                   // Максимум досок для Pro
    MAX_BOARDS_PER_DAY: Infinity,    // Безлимит синхронизаций
    MAX_PINS_PER_SYNC: Infinity,     // Безлимит пинов за синхронизацию
    SMART_REMINDERS: true,           // Умные напоминания включены
    POINTS_MULTIPLIER: 2,            // Двойные очки
  }
}

export interface UserLimits {
  maxPins: number
  maxTasks: number
  maxActiveTasks: number
  maxBoards: number
  maxBoardsPerDay: number
  maxPinsPerSync: number
  smartReminders: boolean
  pointsMultiplier: number
  isPremium: boolean
}

export interface LimitsCheck {
  allowed: boolean
  current: number
  limit: number
  remaining: number
  message?: string
}

/**
 * Получить лимиты пользователя
 */
export async function getUserLimits(userId: string): Promise<UserLimits> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isPremium: true }
  })

  const isPremium = user?.isPremium ?? false
  const limits = isPremium ? LIMITS.PREMIUM : LIMITS.FREE

  return {
    maxPins: limits.MAX_PINS,
    maxTasks: limits.MAX_TASKS,
    maxActiveTasks: limits.MAX_ACTIVE_TASKS,
    maxBoards: limits.MAX_BOARDS,
    maxBoardsPerDay: limits.MAX_BOARDS_PER_DAY,
    maxPinsPerSync: limits.MAX_PINS_PER_SYNC,
    smartReminders: limits.SMART_REMINDERS,
    pointsMultiplier: limits.POINTS_MULTIPLIER,
    isPremium,
  }
}

/**
 * Проверить лимит пинов
 */
export async function checkPinsLimit(userId: string): Promise<LimitsCheck> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      isPremium: true,
      _count: {
        select: { pins: true }
      }
    }
  })

  const isPremium = user?.isPremium ?? false
  const current = user?._count.pins ?? 0
  const limit = isPremium ? LIMITS.PREMIUM.MAX_PINS : LIMITS.FREE.MAX_PINS
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - current)

  if (limit === Infinity) {
    return { allowed: true, current, limit: -1, remaining: -1 }
  }

  return {
    allowed: current < limit,
    current,
    limit,
    remaining,
    message: current >= limit
      ? `Достигнут лимит пинов (${limit}). Оформите Premium для безлимитного доступа!`
      : undefined
  }
}

/**
 * Проверить лимит задач
 */
export async function checkTasksLimit(userId: string): Promise<LimitsCheck> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      isPremium: true,
      _count: {
        select: { tasks: true }
      }
    }
  })

  const isPremium = user?.isPremium ?? false
  const current = user?._count.tasks ?? 0
  const limit = isPremium ? LIMITS.PREMIUM.MAX_TASKS : LIMITS.FREE.MAX_TASKS
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - current)

  if (limit === Infinity) {
    return { allowed: true, current, limit: -1, remaining: -1 }
  }

  return {
    allowed: current < limit,
    current,
    limit,
    remaining,
    message: current >= limit
      ? `Достигнут лимит задач (${limit}). Оформите Premium для безлимитного доступа!`
      : undefined
  }
}

/**
 * Проверить лимит активных задач
 */
export async function checkActiveTasksLimit(userId: string): Promise<LimitsCheck> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      isPremium: true,
      _count: {
        select: {
          tasks: {
            where: {
              status: { in: ['pending', 'in_progress'] }
            }
          }
        }
      }
    }
  })

  const isPremium = user?.isPremium ?? false
  const current = user?._count.tasks ?? 0
  const limit = isPremium ? LIMITS.PREMIUM.MAX_ACTIVE_TASKS : LIMITS.FREE.MAX_ACTIVE_TASKS
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - current)

  if (limit === Infinity) {
    return { allowed: true, current, limit: -1, remaining: -1 }
  }

  return {
    allowed: current < limit,
    current,
    limit,
    remaining,
    message: current >= limit
      ? `Слишком много активных задач (${limit}). Завершите текущие или оформите Premium!`
      : undefined
  }
}

/**
 * Проверить лимит на общее количество досок
 */
export async function checkBoardsLimit(userId: string): Promise<LimitsCheck> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      isPremium: true,
      _count: {
        select: { pinterestBoards: true }
      }
    }
  })

  const isPremium = user?.isPremium ?? false
  const current = user?._count.pinterestBoards ?? 0
  const limit = isPremium ? LIMITS.PREMIUM.MAX_BOARDS : LIMITS.FREE.MAX_BOARDS
  const remaining = Math.max(0, limit - current)

  return {
    allowed: current < limit,
    current,
    limit,
    remaining,
    message: current >= limit
      ? `Достигнут лимит досок (${limit}). ${isPremium ? 'Удалите ненужную доску чтобы добавить новую.' : 'Оформите Premium для увеличения лимита до 3 досок!'}`
      : undefined
  }
}

/**
 * Проверить лимит синхронизаций досок в день
 */
export async function checkBoardsSyncLimit(userId: string): Promise<LimitsCheck> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isPremium: true }
  })

  const isPremium = user?.isPremium ?? false

  if (isPremium) {
    return { allowed: true, current: 0, limit: -1, remaining: -1 }
  }

  // Подсчёт синхронизаций за сегодня
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  try {
    const todaySyncs = await db.pinterestBoard.count({
      where: {
        userId,
        lastSyncAt: {
          gte: today
        }
      }
    })

    const current = todaySyncs
    const limit = LIMITS.FREE.MAX_BOARDS_PER_DAY
    const remaining = Math.max(0, limit - current)

    return {
      allowed: current < limit,
      current,
      limit,
      remaining,
      message: current >= limit
        ? `На сегодня лимит синхронизаций исчерпран (${limit}/день). Оформите Premium!`
        : undefined
    }
  } catch (error) {
    // Если таблицы pinterestBoard нет, просто разрешаем
    return { allowed: true, current: 0, limit: 1, remaining: 1 }
  }
}

/**
 * Проверить лимит пинов за одну синхронизацию
 */
export function checkPinsPerSyncLimit(pinsCount: number, isPremium: boolean): LimitsCheck {
  const limit = isPremium ? LIMITS.PREMIUM.MAX_PINS_PER_SYNC : LIMITS.FREE.MAX_PINS_PER_SYNC

  if (limit === Infinity) {
    return { allowed: true, current: pinsCount, limit: -1, remaining: -1 }
  }

  return {
    allowed: pinsCount <= limit,
    current: pinsCount,
    limit,
    remaining: 0,
    message: pinsCount > limit
      ? `Слишком много пинов (${pinsCount}). Free версия позволяет импортировать до ${limit} пинов за раз. Оформите Premium!`
      : undefined
  }
}

/**
 * Получить полную статистику лимитов пользователя
 */
export async function getUserLimitsStats(userId: string): Promise<{
  pins: LimitsCheck
  tasks: LimitsCheck
  activeTasks: LimitsCheck
  boards: LimitsCheck
  boardsSync: LimitsCheck
  limits: UserLimits
}> {
  const [pins, tasks, activeTasks, boards, boardsSync, limits] = await Promise.all([
    checkPinsLimit(userId),
    checkTasksLimit(userId),
    checkActiveTasksLimit(userId),
    checkBoardsLimit(userId),
    checkBoardsSyncLimit(userId),
    getUserLimits(userId),
  ])

  return { pins, tasks, activeTasks, boards, boardsSync, limits }
}
