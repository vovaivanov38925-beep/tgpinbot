'use client'

import { useEffect, useState } from 'react'
import {
  Users, Pin, CheckCircle2, Crown, TrendingUp,
  DollarSign, Activity, Clock, Trash2, AlertTriangle
} from 'lucide-react'

interface Stats {
  totalUsers: number
  totalPins: number
  totalTasks: number
  completedTasks: number
  premiumUsers: number
  totalRevenue: number
  totalPayments: number
}

interface RecentUser {
  id: string
  firstName: string | null
  username: string | null
  createdAt: string
}

interface LogEntry {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  details: string | null
  createdAt: string
  admin: { username: string }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [cleanupLoading, setCleanupLoading] = useState(false)

  const fetchStats = () => {
    setLoading(true)
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data.stats)
        setRecentUsers(data.recentUsers || [])
        setRecentLogs(data.recentLogs || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const handleCleanup = async () => {
    if (!confirm('Удалить осиротевшие записи (пины и задачи без пользователей)?')) return
    setCleanupLoading(true)
    try {
      const res = await fetch('/api/admin/cleanup', { method: 'POST' })
      const data = await res.json()
      alert(data.message)
      fetchStats()
    } catch (err) {
      console.error(err)
      alert('Ошибка при очистке')
    } finally {
      setCleanupLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const statCards = [
    { label: 'Пользователи', value: stats?.totalUsers || 0, icon: Users, color: 'from-blue-500 to-cyan-500' },
    { label: 'Пины', value: stats?.totalPins || 0, icon: Pin, color: 'from-pink-500 to-rose-500' },
    { label: 'Задачи', value: stats?.totalTasks || 0, icon: CheckCircle2, color: 'from-green-500 to-emerald-500' },
    { label: 'Премиум', value: stats?.premiumUsers || 0, icon: Crown, color: 'from-amber-500 to-yellow-500' },
  ]

  const actionLabels: Record<string, string> = {
    login: 'Вход в систему',
    logout: 'Выход из системы',
    update_user: 'Обновление пользователя',
    delete_user: 'Удаление пользователя',
    update_payment_settings: 'Обновление настроек оплаты',
    change_password: 'Смена пароля',
    update_setting: 'Обновление настроек',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Дашборд</h1>
        <p className="text-slate-400 mt-1">Обзор активности приложения</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-white">{stat.value.toLocaleString()}</p>
            <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Maintenance Tools */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-amber-500/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Инструменты обслуживания</h2>
            <p className="text-sm text-slate-400">Очистка и исправление данных</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCleanup}
            disabled={cleanupLoading}
            className="px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg font-medium hover:bg-amber-500/30 disabled:opacity-50 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {cleanupLoading ? 'Очистка...' : 'Удалить осиротевшие записи'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Удаляет пины и задачи, которые ссылаются на несуществующих пользователей
        </p>
      </div>

      {/* Revenue & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Доход</h2>
              <p className="text-sm text-slate-400">Всего платежей: {stats?.totalPayments || 0}</p>
            </div>
          </div>
          <div className="text-4xl font-bold text-white mb-2">
            {(stats?.totalRevenue || 0).toLocaleString()} ₽
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Activity className="w-4 h-4 text-green-500" />
            <span>За всё время</span>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Выполнение задач</h2>
              <p className="text-sm text-slate-400">Процент завершённых</p>
            </div>
          </div>
          <div className="text-4xl font-bold text-white mb-2">
            {stats?.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all"
              style={{ width: `${stats?.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%` }}
            />
          </div>
          <p className="text-sm text-slate-400 mt-2">
            {stats?.completedTasks || 0} из {stats?.totalTasks || 0} задач
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white mb-4">Новые пользователи</h2>
          <div className="space-y-3">
            {recentUsers.length === 0 ? (
              <p className="text-slate-400 text-sm">Нет данных</p>
            ) : (
              recentUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white text-sm font-medium">
                      {(user.firstName || user.username || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{user.firstName || user.username || 'Без имени'}</p>
                      <p className="text-xs text-slate-400">{user.username ? `@${user.username}` : 'Нет username'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Logs */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white mb-4">Последние действия</h2>
          <div className="space-y-3">
            {recentLogs.length === 0 ? (
              <p className="text-slate-400 text-sm">Нет данных</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {actionLabels[log.action] || log.action}
                    </p>
                    <p className="text-xs text-slate-400">by {log.admin.username}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {new Date(log.createdAt).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
