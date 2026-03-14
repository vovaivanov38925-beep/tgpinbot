/**
 * Subscription Management System
 * Работает напрямую с БД через Prisma raw queries
 */

import { db } from './db'

// Типы планов подписки
export type PlanType = 'month' | 'year' | 'lifetime'

// Статусы подписки
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'refunded'

// Провайдеры оплаты
export type PaymentProvider = 'yookassa' | 'telegram_stars' | 'ton' | 'manual'

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

// Генерация ID
function generateId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 10)
  return `c${timestamp}${randomPart}`
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
    amount = 0,
    currency = 'RUB',
    transactionId = null,
    grantedBy = null,
    metadata = null
  } = params

  const id = generateId()
  const now = new Date()
  const duration = PLAN_DURATION[plan]
  const expiresAt = duration ? new Date(now.getTime() + duration * 24 * 60 * 60 * 1000) : null

  await db.$executeRaw`
    INSERT INTO subscriptions (
      id, "userId", plan, status, provider, "transactionId",
      amount, currency, "startedAt", "expiresAt", "grantedBy", metadata
    ) VALUES (
      ${id}, ${userId}, ${plan}, ${'active'}, ${provider}, ${transactionId},
      ${amount}, ${currency}, ${now}, ${expiresAt}, ${grantedBy}, ${metadata ? JSON.stringify(metadata) : null}
    )
  `

  // Обновляем статус пользователя
  await updateUserPremiumStatus(userId)

  return {
    id,
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
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Получить активную подписку пользователя
 */
export async function getActiveSubscription(userId: string): Promise<SubscriptionData | null> {
  const now = new Date()

  const results = await db.$queryRaw<any[]>`
    SELECT * FROM subscriptions
    WHERE "userId" = ${userId}
      AND status = ${'active'}
      AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
    ORDER BY "createdAt" DESC
    LIMIT 1
  `

  if (!results || results.length === 0) return null

  return mapRowToSubscription(results[0])
}

/**
 * Получить все подписки пользователя
 */
export async function getUserSubscriptions(userId: string): Promise<SubscriptionData[]> {
  const results = await db.$queryRaw<any[]>`
    SELECT * FROM subscriptions
    WHERE "userId" = ${userId}
    ORDER BY "createdAt" DESC
  `

  return results.map(mapRowToSubscription)
}

/**
 * Обновить статус премиум пользователя
 */
export async function updateUserPremiumStatus(userId: string): Promise<void> {
  const activeSubscription = await getActiveSubscription(userId)

  await db.$executeRaw`
    UPDATE users
    SET "isPremium" = ${!!activeSubscription},
        "premiumExpiry" = ${activeSubscription?.expiresAt || null},
        "updatedAt" = ${new Date()}
    WHERE id = ${userId}
  `
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
  const now = new Date()

  // Получаем подписку
  const results = await db.$queryRaw<any[]>`
    SELECT * FROM subscriptions WHERE id = ${subscriptionId}
  `

  if (!results || results.length === 0) {
    throw new Error('Subscription not found')
  }

  const subscription = results[0]

  // Обновляем статус
  await db.$executeRaw`
    UPDATE subscriptions
    SET status = ${'cancelled'},
        "cancelledAt" = ${now},
        "cancelledReason" = ${reason || `Revoked by admin ${adminId}`},
        "updatedAt" = ${now}
    WHERE id = ${subscriptionId}
  `

  // Обновляем статус пользователя
  await updateUserPremiumStatus(subscription.userId)

  return mapRowToSubscription({
    ...subscription,
    status: 'cancelled',
    cancelledAt: now,
    cancelledReason: reason || `Revoked by admin ${adminId}`
  })
}

/**
 * Проверить истекшие подписки
 */
export async function checkExpiredSubscriptions(): Promise<number> {
  const now = new Date()

  // Находим истекшие
  const expired = await db.$queryRaw<any[]>`
    SELECT id, "userId" FROM subscriptions
    WHERE status = ${'active'}
      AND "expiresAt" IS NOT NULL
      AND "expiresAt" < ${now}
  `

  // Обновляем каждую
  for (const sub of expired) {
    await db.$executeRaw`
      UPDATE subscriptions
      SET status = ${'expired'}, "updatedAt" = ${now}
      WHERE id = ${sub.id}
    `
    await updateUserPremiumStatus(sub.userId)
  }

  return expired.length
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
  revenue: { total: number; thisMonth: number; thisYear: number }
}> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  // Считаем статистику
  const stats = await db.$queryRaw<any[]>`
    SELECT 
      status,
      plan,
      provider,
      amount,
      "createdAt"
    FROM subscriptions
  `

  let total = 0
  let active = 0
  let expired = 0
  let cancelled = 0
  const byPlan: Record<PlanType, number> = { month: 0, year: 0, lifetime: 0 }
  const byProvider: Record<PaymentProvider, number> = { yookassa: 0, telegram_stars: 0, ton: 0, manual: 0 }
  let totalRevenue = 0
  let monthRevenue = 0
  let yearRevenue = 0

  for (const row of stats) {
    total++
    
    if (row.status === 'active') active++
    else if (row.status === 'expired') expired++
    else if (row.status === 'cancelled') cancelled++

    if (row.plan in byPlan) byPlan[row.plan as PlanType]++
    if (row.provider in byProvider) byProvider[row.provider as PaymentProvider]++

    if (row.provider !== 'manual' && row.amount) {
      totalRevenue += row.amount
      const createdAt = new Date(row.createdAt)
      if (createdAt >= startOfMonth) monthRevenue += row.amount
      if (createdAt >= startOfYear) yearRevenue += row.amount
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
      total: Math.round(totalRevenue / 100),
      thisMonth: Math.round(monthRevenue / 100),
      thisYear: Math.round(yearRevenue / 100)
    }
  }
}

/**
 * Получить подписки с пагинацией
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

  const offset = (page - 1) * limit

  let whereConditions = 'WHERE 1=1'
  const queryParams: any[] = []
  let paramIndex = 1

  if (status) {
    whereConditions += ` AND s.status = $${paramIndex++}`
    queryParams.push(status)
  }
  if (plan) {
    whereConditions += ` AND s.plan = $${paramIndex++}`
    queryParams.push(plan)
  }
  if (provider) {
    whereConditions += ` AND s.provider = $${paramIndex++}`
    queryParams.push(provider)
  }
  if (search) {
    whereConditions += ` AND (u."telegramId" ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex} OR u."firstName" ILIKE $${paramIndex})`
    queryParams.push(`%${search}%`)
    paramIndex++
  }

  // Получаем общее количество
  const countResult = await db.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) as count FROM subscriptions s JOIN users u ON s."userId" = u.id ${whereConditions}`,
    ...queryParams
  )
  const total = Number(countResult[0]?.count || 0)

  // Получаем записи
  const results = await db.$queryRawUnsafe<any[]>(
    `SELECT s.*, u.id as user_id, u."telegramId", u.username, u."firstName", u."lastName", u."photoUrl", u."isPremium"
     FROM subscriptions s
     JOIN users u ON s."userId" = u.id
     ${whereConditions}
     ORDER BY s."createdAt" DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    ...queryParams, limit, offset
  )

  const subscriptions = results.map(row => ({
    ...mapRowToSubscription(row),
    user: {
      id: row.user_id,
      telegramId: row.telegramId,
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      photoUrl: row.photoUrl,
      isPremium: row.isPremium
    }
  }))

  return {
    subscriptions,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  }
}

/**
 * Маппинг строки из БД в объект
 */
function mapRowToSubscription(row: any): SubscriptionData {
  return {
    id: row.id,
    userId: row.userId,
    plan: row.plan,
    status: row.status,
    provider: row.provider,
    transactionId: row.transactionId,
    amount: row.amount,
    currency: row.currency,
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
    cancelledAt: row.cancelledAt,
    cancelledReason: row.cancelledReason,
    metadata: row.metadata,
    grantedBy: row.grantedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}
