/**
 * Subscription Management System
 * Полноценная система управления подписками
 */

import { db } from './db'

// Генерация cuid-подобного ID
function generateId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 10)
  return `c${timestamp}${randomPart}`
}

// Типы планов подписки
export type PlanType = 'month' | 'year' | 'lifetime'

// Статусы подписки
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'refunded'

// Провайдеры оплаты
export type PaymentProvider = 'yookassa' | 'telegram_stars' | 'manual'

// Интерфейс подписки
export interface SubscriptionData {
  id: string
  userId: string
  plan: PlanType
  status: SubscriptionStatus
  provider: PaymentProvider
  transactionId?: string | null
  amount: number
  currency: string
  startedAt?: Date | null
  expiresAt?: Date | null
  cancelledAt?: Date | null
  cancelledReason?: string | null
  metadata?: string | null
  grantedBy?: string | null
  createdAt: Date
  updatedAt: Date
}

// Длительность планов в днях
export const PLAN_DURATION: Record<PlanType, number | null> = {
  month: 30,
  year: 365,
  lifetime: null // Бессрочная
}

// Цены по умолчанию (в рублях)
export const DEFAULT_PRICES: Record<PlanType, number> = {
  month: 299,
  year: 1999,
  lifetime: 4999
}

/**
 * Создать новую подписку
 */
export async function createSubscription(params: {
  userId: string
  plan: PlanType
  provider: PaymentProvider
  amount?: number
  currency?: string
  transactionId?: string
  grantedBy?: string
  metadata?: Record<string, any>
}): Promise<SubscriptionData> {
  const {
    userId,
    plan,
    provider,
    amount = DEFAULT_PRICES[plan] * 100, // В копейках
    currency = 'RUB',
    transactionId,
    grantedBy,
    metadata
  } = params

  // Вычисляем даты
  const now = new Date()
  const duration = PLAN_DURATION[plan]
  const expiresAt = duration ? new Date(now.getTime() + duration * 24 * 60 * 60 * 1000) : null

  const subscription = await db.subscription.create({
    data: {
      id: generateId(),  // Генерируем ID вручную
      userId,
      plan,
      status: 'active',
      provider,
      transactionId,
      amount,
      currency,
      startedAt: now,
      expiresAt,
      grantedBy,
      metadata: metadata ? JSON.stringify(metadata) : null
    }
  })

  // Обновляем статус пользователя
  await updateUserPremiumStatus(userId)

  return subscription as SubscriptionData
}

/**
 * Активировать подписку (после подтверждения оплаты)
 */
export async function activateSubscription(subscriptionId: string): Promise<SubscriptionData> {
  const subscription = await db.subscription.findUnique({
    where: { id: subscriptionId }
  })

  if (!subscription) {
    throw new Error('Subscription not found')
  }

  const now = new Date()
  const plan = subscription.plan as PlanType
  const duration = PLAN_DURATION[plan]
  const expiresAt = duration ? new Date(now.getTime() + duration * 24 * 60 * 60 * 1000) : null

  const updated = await db.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'active',
      startedAt: now,
      expiresAt
    }
  })

  // Обновляем статус пользователя
  await updateUserPremiumStatus(subscription.userId)

  return updated as SubscriptionData
}

/**
 * Отменить подписку
 */
export async function cancelSubscription(
  subscriptionId: string,
  reason?: string
): Promise<SubscriptionData> {
  const subscription = await db.subscription.findUnique({
    where: { id: subscriptionId }
  })

  if (!subscription) {
    throw new Error('Subscription not found')
  }

  const updated = await db.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledReason: reason || 'Cancelled by user'
    }
  })

  // Обновляем статус пользователя
  await updateUserPremiumStatus(subscription.userId)

  return updated as SubscriptionData
}

/**
 * Продлить подписку
 */
export async function renewSubscription(params: {
  userId: string
  plan: PlanType
  provider: PaymentProvider
  amount?: number
  transactionId?: string
}): Promise<SubscriptionData> {
  const { userId, plan, provider, amount, transactionId } = params

  // Получаем активную подписку
  const activeSubscription = await getActiveSubscription(userId)

  // Если есть активная подписка - продлеваем от её даты истечения
  let startsFrom = new Date()
  if (activeSubscription?.expiresAt && new Date(activeSubscription.expiresAt) > startsFrom) {
    startsFrom = new Date(activeSubscription.expiresAt)
  }

  const duration = PLAN_DURATION[plan]
  const expiresAt = duration ? new Date(startsFrom.getTime() + duration * 24 * 60 * 60 * 1000) : null

  const subscription = await db.subscription.create({
    data: {
      id: generateId(),  // Генерируем ID вручную
      userId,
      plan,
      status: 'active',
      provider,
      transactionId,
      amount: amount || DEFAULT_PRICES[plan] * 100,
      currency: 'RUB',
      startedAt: startsFrom,
      expiresAt
    }
  })

  // Обновляем статус пользователя
  await updateUserPremiumStatus(userId)

  return subscription as SubscriptionData
}

/**
 * Получить активную подписку пользователя
 */
export async function getActiveSubscription(userId: string): Promise<SubscriptionData | null> {
  const now = new Date()

  const subscription = await db.subscription.findFirst({
    where: {
      userId,
      status: 'active',
      OR: [
        { expiresAt: null }, // lifetime
        { expiresAt: { gt: now } } // ещё не истекла
      ]
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return subscription as SubscriptionData | null
}

/**
 * Получить все подписки пользователя
 */
export async function getUserSubscriptions(userId: string): Promise<SubscriptionData[]> {
  const subscriptions = await db.subscription.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  })

  return subscriptions as SubscriptionData[]
}

/**
 * Проверить есть ли активная подписка
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await getActiveSubscription(userId)
  return subscription !== null
}

/**
 * Обновить статус премиум пользователя
 */
export async function updateUserPremiumStatus(userId: string): Promise<void> {
  const activeSubscription = await getActiveSubscription(userId)

  await db.user.update({
    where: { id: userId },
    data: {
      isPremium: !!activeSubscription,
      premiumExpiry: activeSubscription?.expiresAt || null
    }
  })
}

/**
 * Проверить истекшие подписки и обновить их статус
 */
export async function checkExpiredSubscriptions(): Promise<number> {
  const now = new Date()

  // Находим все активные подписки с истёкшим сроком
  const expiredSubscriptions = await db.subscription.findMany({
    where: {
      status: 'active',
      expiresAt: { lt: now, not: null }
    }
  })

  // Обновляем статус
  for (const sub of expiredSubscriptions) {
    await db.subscription.update({
      where: { id: sub.id },
      data: { status: 'expired' }
    })

    // Обновляем статус пользователя
    await updateUserPremiumStatus(sub.userId)
  }

  return expiredSubscriptions.length
}

/**
 * Получить статистику подписок
 */
export async function getSubscriptionsStats(): Promise<{
  total: number
  active: number
  expired: number
  cancelled: number
  byPlan: Record<PlanType, number>
  byProvider: Record<PaymentProvider, number>
  revenue: {
    total: number
    thisMonth: number
    thisYear: number
  }
}> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const [total, active, expired, cancelled, allSubscriptions] = await Promise.all([
    db.subscription.count(),
    db.subscription.count({ where: { status: 'active' } }),
    db.subscription.count({ where: { status: 'expired' } }),
    db.subscription.count({ where: { status: 'cancelled' } }),
    db.subscription.findMany({
      select: { plan: true, provider: true, amount: true, currency: true, createdAt: true }
    })
  ])

  // Подсчёт по планам
  const byPlan: Record<PlanType, number> = { month: 0, year: 0, lifetime: 0 }
  const byProvider: Record<PaymentProvider, number> = { yookassa: 0, telegram_stars: 0, manual: 0 }

  let totalRevenue = 0
  let monthRevenue = 0
  let yearRevenue = 0

  for (const sub of allSubscriptions) {
    // По планам
    if (sub.plan in byPlan) {
      byPlan[sub.plan as PlanType]++
    }

    // По провайдерам
    if (sub.provider in byProvider) {
      byProvider[sub.provider as PaymentProvider]++
    }

    // Выручка (только активные и завершённые, не manual)
    if (sub.provider !== 'manual' && sub.amount) {
      totalRevenue += sub.amount
      const created = new Date(sub.createdAt)
      if (created >= startOfMonth) {
        monthRevenue += sub.amount
      }
      if (created >= startOfYear) {
        yearRevenue += sub.amount
      }
    }
  }

  return {
    total,
    active,
    expired,
    cancelled,
    byPlan,
    byProvider,
    revenue: {
      total: Math.round(totalRevenue / 100), // В рублях
      thisMonth: Math.round(monthRevenue / 100),
      thisYear: Math.round(yearRevenue / 100)
    }
  }
}

/**
 * Получить подписки с пагинацией (для админки)
 */
export async function getSubscriptionsPaginated(params: {
  page?: number
  limit?: number
  status?: SubscriptionStatus
  plan?: PlanType
  provider?: PaymentProvider
  search?: string
}): Promise<{
  subscriptions: any[]
  total: number
  page: number
  totalPages: number
}> {
  const { page = 1, limit = 20, status, plan, provider, search } = params

  const where: any = {}

  if (status) where.status = status
  if (plan) where.plan = plan
  if (provider) where.provider = provider

  if (search) {
    where.OR = [
      { user: { telegramId: { contains: search, mode: 'insensitive' } } },
      { user: { username: { contains: search, mode: 'insensitive' } } },
      { user: { firstName: { contains: search, mode: 'insensitive' } } }
    ]
  }

  const [subscriptions, total] = await Promise.all([
    db.subscription.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            isPremium: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    db.subscription.count({ where })
  ])

  return {
    subscriptions,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  }
}

/**
 * Выдать подписку вручную (админом)
 */
export async function grantSubscription(params: {
  userId: string
  plan: PlanType
  adminId: string
  reason?: string
}): Promise<SubscriptionData> {
  const { userId, plan, adminId, reason } = params

  return createSubscription({
    userId,
    plan,
    provider: 'manual',
    amount: 0,
    grantedBy: adminId,
    metadata: { reason: reason || 'Granted by admin' }
  })
}

/**
 * Отозвать подписку
 */
export async function revokeSubscription(params: {
  subscriptionId: string
  adminId: string
  reason?: string
}): Promise<SubscriptionData> {
  const { subscriptionId, adminId, reason } = params

  const subscription = await db.subscription.findUnique({
    where: { id: subscriptionId }
  })

  if (!subscription) {
    throw new Error('Subscription not found')
  }

  const updated = await db.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledReason: reason || `Revoked by admin ${adminId}`
    }
  })

  // Обновляем статус пользователя
  await updateUserPremiumStatus(subscription.userId)

  return updated as SubscriptionData
}
