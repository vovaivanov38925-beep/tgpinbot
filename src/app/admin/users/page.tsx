'use client'

import { useEffect, useState } from 'react'
import { Search, Crown, Trash2, Edit, ChevronLeft, ChevronRight, X, Gift, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface User {
  id: string
  telegramId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  photoUrl: string | null
  points: number
  level: number
  isPremium: boolean
  premiumExpiry: string | null
  createdAt: string
  _count: { pins: number; tasks: number }
}

interface Subscription {
  id: string
  plan: string
  status: string
  provider: string
  amount: number
  currency: string
  startedAt: string | null
  expiresAt: string | null
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
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
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)

  // Subscription modal state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [subscriptionUser, setSubscriptionUser] = useState<User | null>(null)
  const [userSubscriptions, setUserSubscriptions] = useState<Subscription[]>([])
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false)
  const [grantPlan, setGrantPlan] = useState('month')
  const [grantReason, setGrantReason] = useState('')
  const [granting, setGranting] = useState(false)

  const fetchUsers = async (page: number = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '20')
    if (search) params.set('search', search)

    try {
      const res = await fetch(`/api/admin/users?${params}`)
      const data = await res.json()
      setUsers(data.users || [])
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch {
      console.error('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchUsers(1)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers(1)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return
    setSaving(true)

    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: editingUser.id,
        updates: {
          points: editingUser.points,
          level: editingUser.level,
          isPremium: editingUser.isPremium,
        }
      })
    })

    if (res.ok) {
      setShowEditModal(false)
      fetchUsers(pagination.page)
    }
    setSaving(false)
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Удалить пользователя и все его данные?')) return

    const res = await fetch(`/api/admin/users?userId=${userId}`, { method: 'DELETE' })
    if (res.ok) {
      fetchUsers(pagination.page)
    }
  }

  const handleTogglePremium = async (user: User) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        updates: { isPremium: !user.isPremium }
      })
    })

    if (res.ok) {
      fetchUsers(pagination.page)
    }
  }

  // Open subscription modal for user
  const openSubscriptionModal = async (user: User) => {
    setSubscriptionUser(user)
    setShowSubscriptionModal(true)
    setLoadingSubscriptions(true)

    try {
      const res = await fetch(`/api/admin/subscriptions?action=user&userId=${user.id}`)
      const data = await res.json()
      setUserSubscriptions(data.subscriptions || [])
    } catch {
      console.error('Failed to fetch subscriptions')
      setUserSubscriptions([])
    } finally {
      setLoadingSubscriptions(false)
    }
  }

  // Grant subscription
  const handleGrantSubscription = async () => {
    if (!subscriptionUser) return
    setGranting(true)

    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grant',
          userId: subscriptionUser.id,
          plan: grantPlan,
          reason: grantReason
        })
      })

      if (res.ok) {
        // Refresh subscriptions
        const subRes = await fetch(`/api/admin/subscriptions?action=user&userId=${subscriptionUser.id}`)
        const subData = await subRes.json()
        setUserSubscriptions(subData.subscriptions || [])
        setGrantPlan('month')
        setGrantReason('')
        fetchUsers(pagination.page)
      }
    } catch {
      console.error('Failed to grant subscription')
    } finally {
      setGranting(false)
    }
  }

  // Revoke subscription
  const handleRevokeSubscription = async (subscriptionId: string) => {
    if (!confirm('Отозвать эту подписку?')) return

    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revoke',
          subscriptionId,
          reason: 'Отозвано администратором'
        })
      })

      if (res.ok && subscriptionUser) {
        // Refresh subscriptions
        const subRes = await fetch(`/api/admin/subscriptions?action=user&userId=${subscriptionUser.id}`)
        const subData = await subRes.json()
        setUserSubscriptions(subData.subscriptions || [])
        fetchUsers(pagination.page)
      }
    } catch {
      console.error('Failed to revoke subscription')
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
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
          <h1 className="text-2xl font-bold text-white">Пользователи</h1>
          <p className="text-slate-400 mt-1">Управление аккаунтами и подписками</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="bg-slate-900/50 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white rounded-lg font-medium hover:opacity-90"
          >
            Найти
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Пользователь</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Статистика</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Уровень</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Подписка</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Дата</th>
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
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Пользователи не найдены
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const daysLeft = user.premiumExpiry ? getDaysLeft(user.premiumExpiry) : null

                  return (
                    <tr key={user.id} className="border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white font-medium">
                            {(user.firstName || user.username || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-white">{user.firstName || 'Без имени'}</p>
                            <p className="text-xs text-slate-400">{user.username ? `@${user.username}` : `ID: ${user.telegramId.slice(0, 10)}...`}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <span className="text-slate-400">Пинов:</span>
                          <span className="text-white ml-1">{user._count.pins}</span>
                          <span className="text-slate-600 mx-2">|</span>
                          <span className="text-slate-400">Задач:</span>
                          <span className="text-white ml-1">{user._count.tasks}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-white">{user.level}</span>
                          <span className="text-sm text-slate-400">lvl</span>
                          <span className="text-sm text-pink-400 ml-2">{user.points} pts</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openSubscriptionModal(user)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                            user.isPremium
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                              : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          <Crown className="w-3 h-3" />
                          {user.isPremium ? (
                            <>
                              Pro
                              {daysLeft !== null && (
                                <span className="ml-1 opacity-70">({daysLeft}д)</span>
                              )}
                            </>
                          ) : 'Free'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openSubscriptionModal(user)}
                            className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                            title="Управление подпиской"
                          >
                            <Gift className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700"
                            title="Редактировать"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
              {pagination.total} пользователей
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchUsers(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-400">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchUsers(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Редактировать пользователя</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Очки</label>
                <input
                  type="number"
                  value={editingUser.points}
                  onChange={(e) => setEditingUser({ ...editingUser, points: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Уровень</label>
                <input
                  type="number"
                  value={editingUser.level}
                  onChange={(e) => setEditingUser({ ...editingUser, level: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editingUser.isPremium}
                  onChange={(e) => setEditingUser({ ...editingUser, isPremium: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <label className="text-sm text-slate-300">Премиум (вручную)</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubscriptionModal && subscriptionUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                Подписки пользователя
              </h2>
              <button onClick={() => setShowSubscriptionModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User info */}
            <div className="mb-4 p-3 bg-slate-900/50 rounded-lg">
              <p className="text-white font-medium">{subscriptionUser.firstName || subscriptionUser.username || 'Без имени'}</p>
              <p className="text-xs text-slate-400">
                {subscriptionUser.username ? `@${subscriptionUser.username}` : `ID: ${subscriptionUser.telegramId}`}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${subscriptionUser.isPremium ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
                  {subscriptionUser.isPremium ? 'PRO' : 'Free'}
                </span>
                {subscriptionUser.premiumExpiry && (
                  <span className="text-xs text-slate-400">
                    до {formatDate(subscriptionUser.premiumExpiry)}
                  </span>
                )}
              </div>
            </div>

            {/* Grant new subscription */}
            <div className="mb-4 p-4 bg-slate-900/30 rounded-xl border border-slate-700/50">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Gift className="w-4 h-4 text-amber-400" />
                Выдать подписку
              </h3>
              <div className="flex gap-2 mb-3">
                <select
                  value={grantPlan}
                  onChange={(e) => setGrantPlan(e.target.value)}
                  className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="month">1 месяц</option>
                  <option value="year">1 год</option>
                  <option value="lifetime">Навсегда</option>
                </select>
                <input
                  type="text"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="Причина..."
                  className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500"
                />
              </div>
              <button
                onClick={handleGrantSubscription}
                disabled={granting}
                className="w-full px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 text-sm"
              >
                {granting ? 'Выдача...' : 'Выдать подписку'}
              </button>
            </div>

            {/* Subscription history */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-3">История подписок</h3>
              {loadingSubscriptions ? (
                <div className="text-center py-4">
                  <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : userSubscriptions.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Нет подписок</p>
              ) : (
                <div className="space-y-2">
                  {userSubscriptions.map((sub) => {
                    const statusInfo = STATUS_LABELS[sub.status] || STATUS_LABELS.pending
                    const StatusIcon = statusInfo.icon
                    const daysLeft = sub.expiresAt ? getDaysLeft(sub.expiresAt) : null

                    return (
                      <div key={sub.id} className="p-3 bg-slate-900/50 rounded-lg flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium text-sm">{PLAN_LABELS[sub.plan] || sub.plan}</span>
                            <span className={`text-xs px-2 py-0.5 rounded border ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {sub.expiresAt ? (
                              <>
                                до {formatDate(sub.expiresAt)}
                                {sub.status === 'active' && daysLeft !== null && (
                                  <span className={`ml-2 ${daysLeft <= 7 ? 'text-red-400' : ''}`}>
                                    ({daysLeft > 0 ? `${daysLeft} дн.` : 'истекает'})
                                  </span>
                                )}
                              </>
                            ) : (
                              'Бессрочно'
                            )}
                          </div>
                        </div>
                        {sub.status === 'active' && (
                          <button
                            onClick={() => handleRevokeSubscription(sub.id)}
                            className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
