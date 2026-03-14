'use client'

import { useEffect, useState } from 'react'
import {
  Crown,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  RefreshCw,
  Gift,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  CreditCard,
  DollarSign,
  TrendingUp,
  Users
} from 'lucide-react'

interface Subscription {
  id: string
  userId: string
  plan: string
  status: string
  provider: string
  amount: number
  currency: string
  startedAt: string | null
  expiresAt: string | null
  cancelledAt: string | null
  cancelledReason: string | null
  grantedBy: string | null
  createdAt: string
  user: {
    id: string
    telegramId: string
    username: string | null
    firstName: string | null
    lastName: string | null
    photoUrl: string | null
    isPremium: boolean
  }
}

interface Stats {
  total: number
  active: number
  expired: number
  cancelled: number
  byPlan: { month: number; year: number; lifetime: number }
  byProvider: { yookassa: number; telegram_stars: number; manual: number }
  revenue: { total: number; thisMonth: number; thisYear: number }
}

const PLAN_LABELS: Record<string, string> = {
  month: '1 месяц',
  year: '1 год',
  lifetime: 'Навсегда'
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Ожидание', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  active: { label: 'Активна', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  expired: { label: 'Истекла', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertCircle },
  cancelled: { label: 'Отменена', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: XCircle },
  refunded: { label: 'Возврат', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: RefreshCw }
}

const PROVIDER_LABELS: Record<string, string> = {
  yookassa: 'YooKassa',
  telegram_stars: 'Telegram Stars',
  manual: 'Вручную'
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [providerFilter, setProviderFilter] = useState('')

  // Modals
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [grantUserId, setGrantUserId] = useState('')
  const [grantPlan, setGrantPlan] = useState('month')
  const [grantReason, setGrantReason] = useState('')
  const [granting, setGranting] = useState(false)

  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)
  const [showRevokeModal, setShowRevokeModal] = useState(false)
  const [revokeReason, setRevokeReason] = useState('')
  const [revoking, setRevoking] = useState(false)

  const fetchSubscriptions = async (page: number = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '20')
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    if (planFilter) params.set('plan', planFilter)
    if (providerFilter) params.set('provider', providerFilter)

    try {
      const res = await fetch(`/api/admin/subscriptions?${params}`)
      const data = await res.json()
      setSubscriptions(data.subscriptions || [])
      setPagination({ page, limit: 20, total: data.total || 0, totalPages: data.totalPages || 0 })
    } catch {
      console.error('Failed to fetch subscriptions')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/subscriptions?action=stats')
      const data = await res.json()
      setStats(data.stats)
    } catch {
      console.error('Failed to fetch stats')
    }
  }

  useEffect(() => {
    fetchSubscriptions(1)
    fetchStats()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchSubscriptions(1)
  }

  const handleGrant = async () => {
    if (!grantUserId || !grantPlan) return
    setGranting(true)

    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grant',
          userId: grantUserId,
          plan: grantPlan,
          reason: grantReason
        })
      })

      if (res.ok) {
        setShowGrantModal(false)
        setGrantUserId('')
        setGrantPlan('month')
        setGrantReason('')
        fetchSubscriptions(1)
        fetchStats()
      }
    } catch {
      console.error('Failed to grant subscription')
    } finally {
      setGranting(false)
    }
  }

  const handleRevoke = async () => {
    if (!selectedSubscription) return
    setRevoking(true)

    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revoke',
          subscriptionId: selectedSubscription.id,
          reason: revokeReason
        })
      })

      if (res.ok) {
        setShowRevokeModal(false)
        setSelectedSubscription(null)
        setRevokeReason('')
        fetchSubscriptions(pagination.page)
        fetchStats()
      }
    } catch {
      console.error('Failed to revoke subscription')
    } finally {
      setRevoking(false)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDaysLeft = (expiresAt: string | null) => {
    if (!expiresAt) return null
    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-400" />
            Подписки
          </h1>
          <p className="text-slate-400 mt-1">Управление подписками пользователей</p>
        </div>
        <button
          onClick={() => setShowGrantModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-medium hover:opacity-90"
        >
          <Gift className="w-4 h-4" />
          Выдать подписку
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.active}</p>
                <p className="text-xs text-slate-400">Активных</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.expired}</p>
                <p className="text-xs text-slate-400">Истекших</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-slate-400">Всего</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.revenue.thisMonth.toLocaleString('ru-RU')}₽</p>
                <p className="text-xs text-slate-400">За месяц</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue & Plans Stats */}
      {stats && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-400 mb-3">По планам</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-300">1 месяц</span>
                <span className="text-white font-medium">{stats.byPlan.month}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">1 год</span>
                <span className="text-white font-medium">{stats.byPlan.year}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Навсегда</span>
                <span className="text-white font-medium">{stats.byPlan.lifetime}</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Выручка</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-300">За месяц</span>
                <span className="text-white font-medium">{stats.revenue.thisMonth.toLocaleString('ru-RU')}₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">За год</span>
                <span className="text-white font-medium">{stats.revenue.thisYear.toLocaleString('ru-RU')}₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Всего</span>
                <span className="text-white font-medium">{stats.revenue.total.toLocaleString('ru-RU')}₽</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени или Telegram ID..."
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
          >
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="expired">Истекшие</option>
            <option value="cancelled">Отменённые</option>
            <option value="pending">Ожидание</option>
          </select>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
          >
            <option value="">Все планы</option>
            <option value="month">1 месяц</option>
            <option value="year">1 год</option>
            <option value="lifetime">Навсегда</option>
          </select>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
          >
            <option value="">Все способы</option>
            <option value="yookassa">YooKassa</option>
            <option value="telegram_stars">Telegram Stars</option>
            <option value="manual">Вручную</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white rounded-lg font-medium hover:opacity-90"
          >
            Найти
          </button>
        </form>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Пользователь</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">План</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Статус</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Оплата</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Срок</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Подписки не найдены
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => {
                  const statusInfo = STATUS_LABELS[sub.status] || STATUS_LABELS.pending
                  const StatusIcon = statusInfo.icon
                  const daysLeft = getDaysLeft(sub.expiresAt)

                  return (
                    <tr key={sub.id} className="border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white font-medium">
                            {(sub.user.firstName || sub.user.username || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-white">{sub.user.firstName || 'Без имени'}</p>
                            <p className="text-xs text-slate-400">
                              {sub.user.username ? `@${sub.user.username}` : `ID: ${sub.user.telegramId.slice(0, 10)}...`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white font-medium">{PLAN_LABELS[sub.plan] || sub.plan}</p>
                          <p className="text-xs text-slate-400">{PROVIDER_LABELS[sub.provider] || sub.provider}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white">
                            {sub.amount > 0 ? `${(sub.amount / 100).toLocaleString('ru-RU')} ${sub.currency}` : 'Бесплатно'}
                          </p>
                          {sub.grantedBy && (
                            <p className="text-xs text-slate-400">Выдано админом</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          {sub.expiresAt ? (
                            <>
                              <p className="text-white">{formatDate(sub.expiresAt)}</p>
                              {sub.status === 'active' && daysLeft !== null && (
                                <p className={`text-xs ${daysLeft <= 7 ? 'text-red-400' : daysLeft <= 30 ? 'text-yellow-400' : 'text-slate-400'}`}>
                                  {daysLeft > 0 ? `${daysLeft} дн.` : 'Истекает сегодня'}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-green-400">Бессрочно</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {sub.status === 'active' && (
                          <button
                            onClick={() => {
                              setSelectedSubscription(sub)
                              setShowRevokeModal(true)
                            }}
                            className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
            <p className="text-sm text-slate-400">
              {pagination.total} подписок
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchSubscriptions(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-400">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchSubscriptions(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grant Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                Выдать подписку
              </h2>
              <button onClick={() => setShowGrantModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">ID пользователя</label>
                <input
                  type="text"
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                  placeholder="cuid_xxx или telegramId"
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">План</label>
                <select
                  value={grantPlan}
                  onChange={(e) => setGrantPlan(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="month">1 месяц</option>
                  <option value="year">1 год</option>
                  <option value="lifetime">Навсегда</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Причина (опционально)</label>
                <input
                  type="text"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="Например: Победитель конкурса"
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGrantModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Отмена
              </button>
              <button
                onClick={handleGrant}
                disabled={granting || !grantUserId}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {granting ? 'Выдача...' : 'Выдать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      {showRevokeModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                Отозвать подписку
              </h2>
              <button onClick={() => setShowRevokeModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4 p-3 bg-slate-900/50 rounded-lg">
              <p className="text-sm text-slate-400">Пользователь:</p>
              <p className="text-white font-medium">
                {selectedSubscription.user.firstName || selectedSubscription.user.username || 'Без имени'}
              </p>
              <p className="text-sm text-slate-400 mt-1">План: {PLAN_LABELS[selectedSubscription.plan]}</p>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Причина отзыва</label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Например: Нарушение правил"
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRevokeModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Отмена
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {revoking ? 'Отзыв...' : 'Отозвать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
