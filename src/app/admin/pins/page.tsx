'use client'

import { useEffect, useState } from 'react'
import { Search, Trash2, Eye, ChevronLeft, ChevronRight, X, Pin, CheckCircle2, ExternalLink } from 'lucide-react'

interface User {
  id: string
  firstName: string | null
  username: string | null
  telegramId: string
}

interface Pin {
  id: string
  imageUrl: string
  title: string | null
  description: string | null
  category: string | null
  sourceUrl: string | null
  isCompleted: boolean
  points: number
  createdAt: string
  user: User
  _count: { tasks: number }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const categoryLabels: Record<string, string> = {
  recipe: 'Рецепты',
  fashion: 'Мода',
  diy: 'DIY',
  travel: 'Путешествия',
  fitness: 'Фитнес',
  beauty: 'Красота',
  home: 'Дом',
  art: 'Искусство',
  garden: 'Сад',
  wedding: 'Свадьба',
  kids: 'Дети',
  pets: 'Питомцы',
  tech: 'Технологии',
  books: 'Книги',
  other: 'Другое'
}

export default function AdminPinsPage() {
  const [pins, setPins] = useState<Pin[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null)

  const fetchPins = async (page: number = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '20')
    if (search) params.set('search', search)
    if (categoryFilter) params.set('category', categoryFilter)

    try {
      const res = await fetch(`/api/admin/pins?${params}`)
      const data = await res.json()
      setPins(data.pins || [])
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch {
      console.error('Failed to fetch pins')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchPins(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchPins(1)
  }

  const handleDelete = async (pinId: string) => {
    if (!confirm('Удалить этот пин?')) return

    const res = await fetch(`/api/admin/pins?pinId=${pinId}`, { method: 'DELETE' })
    if (res.ok) {
      fetchPins(pagination.page)
      setSelectedPin(null)
    }
  }

  const handleToggleComplete = async (pin: Pin) => {
    const res = await fetch('/api/admin/pins', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pinId: pin.id,
        updates: { isCompleted: !pin.isCompleted }
      })
    })

    if (res.ok) {
      fetchPins(pagination.page)
      if (selectedPin?.id === pin.id) {
        setSelectedPin({ ...pin, isCompleted: !pin.isCompleted })
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Пины</h1>
          <p className="text-slate-400 mt-1">Управление сохранёнными идеями</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="bg-slate-900/50 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 w-48"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
          >
            <option value="">Все категории</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white rounded-lg font-medium hover:opacity-90"
          >
            Найти
          </button>
        </form>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <p className="text-sm text-slate-400">Всего пинов</p>
          <p className="text-2xl font-bold text-white">{pagination.total}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <p className="text-sm text-slate-400">На странице</p>
          <p className="text-2xl font-bold text-white">{pins.length}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <p className="text-sm text-slate-400">Завершено</p>
          <p className="text-2xl font-bold text-green-400">{pins.filter(p => p.isCompleted).length}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <p className="text-sm text-slate-400">В процессе</p>
          <p className="text-2xl font-bold text-amber-400">{pins.filter(p => !p.isCompleted).length}</p>
        </div>
      </div>

      {/* Pins Grid */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pins.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Pin className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Пины не найдены</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
            {pins.map((pin) => (
              <div
                key={pin.id}
                className="group relative bg-slate-700/30 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-pink-500/50 transition-all"
                onClick={() => setSelectedPin(pin)}
              >
                <div className="aspect-square relative">
                  <img
                    src={pin.imageUrl}
                    alt={pin.title || 'Pin'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23374151" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="%239CA3AF">Ошибка</text></svg>'
                    }}
                  />
                  {pin.isCompleted && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-xs text-white font-medium truncate">{pin.title || 'Без названия'}</p>
                      <p className="text-xs text-slate-300 truncate">@{pin.user.username || pin.user.firstName || 'User'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
            <p className="text-sm text-slate-400">
              {pagination.total} пинов
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchPins(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-400">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchPins(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pin Detail Modal */}
      {selectedPin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPin(null)}>
          <div className="bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto border border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Image */}
              <div className="relative">
                <img
                  src={selectedPin.imageUrl}
                  alt={selectedPin.title || 'Pin'}
                  className="w-full aspect-square object-cover"
                />
                {selectedPin.isCompleted && (
                  <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Завершено
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">{selectedPin.title || 'Без названия'}</h2>
                  <button
                    onClick={() => setSelectedPin(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* User */}
                <div className="flex items-center gap-3 mb-4 p-3 bg-slate-700/30 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white font-medium">
                    {(selectedPin.user.firstName || selectedPin.user.username || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-white">{selectedPin.user.firstName || 'Без имени'}</p>
                    <p className="text-sm text-slate-400">@{selectedPin.user.username || 'no_username'}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                    <span className="text-slate-400">Категория</span>
                    <span className="text-white">{categoryLabels[selectedPin.category || ''] || selectedPin.category || 'Не указана'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                    <span className="text-slate-400">Очки</span>
                    <span className="text-pink-400 font-medium">{selectedPin.points}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                    <span className="text-slate-400">Задач</span>
                    <span className="text-white">{selectedPin._count.tasks}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                    <span className="text-slate-400">Создан</span>
                    <span className="text-white">{new Date(selectedPin.createdAt).toLocaleString('ru-RU')}</span>
                  </div>
                </div>

                {selectedPin.description && (
                  <div className="mb-6">
                    <p className="text-sm text-slate-400 mb-1">Описание</p>
                    <p className="text-white text-sm">{selectedPin.description}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleToggleComplete(selectedPin)}
                    className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                      selectedPin.isCompleted
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-green-600 text-white hover:bg-green-500'
                    }`}
                  >
                    {selectedPin.isCompleted ? 'Отметить невыполненным' : 'Отметить выполненным'}
                  </button>
                  {selectedPin.sourceUrl && (
                    <a
                      href={selectedPin.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(selectedPin.id)}
                    className="p-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
