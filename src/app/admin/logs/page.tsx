'use client'

import { useEffect, useState } from 'react'
import { Search, Filter, Clock, ChevronLeft, ChevronRight } from 'lucide-react'

interface LogEntry {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  details: string | null
  ipAddress: string | null
  createdAt: string
  admin: { username: string }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const actionLabels: Record<string, string> = {
  login: 'Вход в систему',
  logout: 'Выход из системы',
  update_user: 'Обновление пользователя',
  delete_user: 'Удаление пользователя',
  update_payment_settings: 'Настройки оплаты',
  change_password: 'Смена пароля',
  update_setting: 'Обновление настроек',
}

const entityTypeLabels: Record<string, string> = {
  user: 'Пользователь',
  pin: 'Пин',
  task: 'Задача',
  payment_settings: 'Настройки оплаты',
  app_settings: 'Настройки приложения',
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
  })

  const fetchLogs = async (page: number = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '20')
    if (filters.action) params.set('action', filters.action)
    if (filters.entityType) params.set('entityType', filters.entityType)

    try {
      const res = await fetch(`/api/admin/logs?${params}`)
      const data = await res.json()
      setLogs(data.logs || [])
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch {
      console.error('Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchLogs(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Логи действий</h1>
        <p className="text-slate-400 mt-1">История всех действий администраторов</p>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-4 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Фильтры</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Действие</label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="">Все действия</option>
              <option value="login">Вход</option>
              <option value="logout">Выход</option>
              <option value="update_user">Обновление пользователя</option>
              <option value="delete_user">Удаление пользователя</option>
              <option value="update_payment_settings">Настройки оплаты</option>
              <option value="change_password">Смена пароля</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Тип сущности</label>
            <select
              value={filters.entityType}
              onChange={(e) => handleFilterChange('entityType', e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="">Все типы</option>
              <option value="user">Пользователь</option>
              <option value="pin">Пин</option>
              <option value="task">Задача</option>
              <option value="payment_settings">Настройки оплаты</option>
              <option value="app_settings">Настройки приложения</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Время</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Админ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Действие</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Тип</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Нет записей
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Clock className="w-4 h-4 text-slate-500" />
                        {new Date(log.createdAt).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-white font-medium">
                      {log.admin.username}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 rounded-lg bg-slate-700/50 text-xs font-medium text-slate-300">
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {log.entityType ? (entityTypeLabels[log.entityType] || log.entityType) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 font-mono">
                      {log.ipAddress || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
            <p className="text-sm text-slate-400">
              Показано {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} из {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-400">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
