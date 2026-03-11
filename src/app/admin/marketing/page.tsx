'use client'

import { useEffect, useState } from 'react'
import {
  Megaphone, Send, Plus, Trash2, Edit, X, Crown, Users, Clock,
  CheckCircle, XCircle, Play, Pause
} from 'lucide-react'

interface Ad {
  id: string
  title: string
  content: string
  imageUrl: string | null
  linkUrl: string | null
  buttonText: string | null
  targetAll: boolean
  targetPremium: boolean
  targetFree: boolean
  status: string
  scheduledAt: string | null
  sentCount: number
  clickCount: number
  createdAt: string
}

interface Broadcast {
  id: string
  title: string
  content: string
  imageUrl: string | null
  targetAll: boolean
  targetPremium: boolean
  targetFree: boolean
  status: string
  scheduledAt: string | null
  totalRecipients: number
  sentCount: number
  failedCount: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

type Tab = 'broadcasts' | 'ads'

export default function AdminMarketingPage() {
  const [tab, setTab] = useState<Tab>('broadcasts')
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Broadcast | Ad | null>(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [formLinkUrl, setFormLinkUrl] = useState('')
  const [formButtonText, setFormButtonText] = useState('')
  const [formTargetAll, setFormTargetAll] = useState(true)
  const [formTargetPremium, setFormTargetPremium] = useState(false)
  const [formTargetFree, setFormTargetFree] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [broadcastsRes, adsRes] = await Promise.all([
        fetch('/api/broadcast'),
        fetch('/api/ads')
      ])
      const broadcastsData = await broadcastsRes.json()
      const adsData = await adsRes.json()
      setBroadcasts(Array.isArray(broadcastsData) ? broadcastsData : [])
      setAds(Array.isArray(adsData) ? adsData : [])
    } catch (e) {
      console.error('Failed to fetch data', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [])

  const resetForm = () => {
    setFormTitle('')
    setFormContent('')
    setFormImageUrl('')
    setFormLinkUrl('')
    setFormButtonText('')
    setFormTargetAll(true)
    setFormTargetPremium(false)
    setFormTargetFree(false)
    setEditingItem(null)
  }

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (item: Broadcast | Ad) => {
    setEditingItem(item)
    setFormTitle(item.title)
    setFormContent(item.content)
    setFormImageUrl(item.imageUrl || '')
    setFormTargetAll(item.targetAll)
    setFormTargetPremium(item.targetPremium)
    setFormTargetFree(item.targetFree)
    if ('linkUrl' in item) {
      setFormLinkUrl(item.linkUrl || '')
      setFormButtonText(item.buttonText || '')
    }
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formTitle || !formContent) return
    setSaving(true)

    const isAd = tab === 'ads'
    const url = isAd ? '/api/ads' : '/api/broadcast'
    const method = editingItem ? 'PATCH' : 'POST'

    const body: Record<string, unknown> = {
      title: formTitle,
      content: formContent,
      imageUrl: formImageUrl || null,
      targetAll: formTargetAll,
      targetPremium: formTargetPremium,
      targetFree: formTargetFree
    }

    if (isAd) {
      body.linkUrl = formLinkUrl || null
      body.buttonText = formButtonText || null
    }

    if (editingItem) {
      body.id = editingItem.id
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        setShowModal(false)
        resetForm()
        fetchData()
      }
    } catch (e) {
      console.error('Failed to save', e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить?')) return

    const url = tab === 'ads' ? `/api/ads?id=${id}` : `/api/broadcast?id=${id}`
    const res = await fetch(url, { method: 'DELETE' })
    if (res.ok) {
      fetchData()
    }
  }

  const handleSendBroadcast = async (broadcastId: string) => {
    if (!confirm('Запустить рассылку сейчас?')) return
    setSending(true)

    try {
      const res = await fetch('/api/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcastId })
      })

      const data = await res.json()

      if (res.ok) {
        alert(`Рассылка отправлена!\nОтправлено: ${data.broadcast.sentCount}\nОшибок: ${data.broadcast.failedCount}`)
        fetchData()
      } else {
        alert('Ошибка: ' + data.error)
      }
    } catch (e) {
      console.error('Failed to send broadcast', e)
      alert('Ошибка отправки')
    } finally {
      setSending(false)
    }
  }

  const handleSendAd = async (adId: string) => {
    if (!confirm('Отправить рекламу сейчас?')) return
    setSending(true)

    try {
      const res = await fetch('/api/ads/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId })
      })

      const data = await res.json()

      if (res.ok) {
        alert(`Реклама отправлена!\nОтправлено: ${data.sentCount}\nОшибок: ${data.failedCount}`)
        fetchData()
      } else {
        alert('Ошибка: ' + data.error)
      }
    } catch (e) {
      console.error('Failed to send ad', e)
      alert('Ошибка отправки')
    } finally {
      setSending(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-slate-700/50 text-slate-400',
      scheduled: 'bg-blue-500/20 text-blue-400',
      sending: 'bg-yellow-500/20 text-yellow-400',
      sent: 'bg-green-500/20 text-green-400',
      active: 'bg-green-500/20 text-green-400',
      paused: 'bg-orange-500/20 text-orange-400',
      completed: 'bg-purple-500/20 text-purple-400',
      failed: 'bg-red-500/20 text-red-400'
    }
    const labels: Record<string, string> = {
      draft: 'Черновик',
      scheduled: 'Запланировано',
      sending: 'Отправка...',
      sent: 'Отправлено',
      active: 'Активно',
      paused: 'Пауза',
      completed: 'Завершено',
      failed: 'Ошибка'
    }
    return (
      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    )
  }

  const getTargetLabel = (item: Broadcast | Ad) => {
    if (item.targetAll || (!item.targetPremium && !item.targetFree)) return 'Все'
    if (item.targetPremium && item.targetFree) return 'Все'
    if (item.targetPremium) return 'Premium'
    if (item.targetFree) return 'Free'
    return 'Все'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Маркетинг</h1>
          <p className="text-slate-400 mt-1">Рассылки и рекламные интеграции</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white rounded-lg font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Создать
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('broadcasts')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            tab === 'broadcasts'
              ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white'
              : 'bg-slate-800/50 text-slate-400 hover:text-white'
          }`}
        >
          <Send className="w-4 h-4" />
          Рассылки
        </button>
        <button
          onClick={() => setTab('ads')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            tab === 'ads'
              ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white'
              : 'bg-slate-800/50 text-slate-400 hover:text-white'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Реклама
        </button>
      </div>

      {/* Content */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'broadcasts' ? (
          broadcasts.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Нет рассылок</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {broadcasts.map((item) => (
                <div key={item.id} className="p-4 hover:bg-slate-700/20">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-white truncate">{item.title}</h3>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-sm text-slate-400 line-clamp-2 mb-2">{item.content}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {getTargetLabel(item)}
                        </span>
                        {item.status === 'sent' && (
                          <>
                            <span className="flex items-center gap-1 text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              {item.sentCount}
                            </span>
                            {item.failedCount > 0 && (
                              <span className="flex items-center gap-1 text-red-400">
                                <XCircle className="w-3 h-3" />
                                {item.failedCount}
                              </span>
                            )}
                          </>
                        )}
                        <span>{new Date(item.createdAt).toLocaleDateString('ru-RU')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === 'draft' && (
                        <button
                          onClick={() => handleSendBroadcast(item.id)}
                          disabled={sending}
                          className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30"
                          title="Отправить"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : ads.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Нет рекламы</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {ads.map((item) => (
              <div key={item.id} className="p-4 hover:bg-slate-700/20">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-white truncate">{item.title}</h3>
                      {getStatusBadge(item.status)}
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-2 mb-2">{item.content}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {getTargetLabel(item)}
                      </span>
                      <span>Отправок: {item.sentCount}</span>
                      <span>Кликов: {item.clickCount}</span>
                      <span>{new Date(item.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(item.status === 'draft' || item.status === 'active') && (
                      <button
                        onClick={() => handleSendAd(item.id)}
                        disabled={sending}
                        className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30"
                        title="Отправить"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                {editingItem ? 'Редактировать' : tab === 'broadcasts' ? 'Новая рассылка' : 'Новая реклама'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm() }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Название</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Название для админки"
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Текст сообщения (HTML)</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="<b>Заголовок</b>&#10;&#10;Текст сообщения..."
                  rows={5}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">URL картинки (опционально)</label>
                <input
                  type="text"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              {tab === 'ads' && (
                <>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Ссылка (опционально)</label>
                    <input
                      type="text"
                      value={formLinkUrl}
                      onChange={(e) => setFormLinkUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Текст кнопки (опционально)</label>
                    <input
                      type="text"
                      value={formButtonText}
                      onChange={(e) => setFormButtonText(e.target.value)}
                      placeholder="Подробнее"
                      className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-2">Целевая аудитория</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formTargetAll}
                      onChange={(e) => {
                        setFormTargetAll(e.target.checked)
                        if (e.target.checked) {
                          setFormTargetPremium(false)
                          setFormTargetFree(false)
                        }
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-slate-300">Все пользователи</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formTargetPremium}
                      onChange={(e) => {
                        setFormTargetPremium(e.target.checked)
                        if (e.target.checked) setFormTargetAll(false)
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span className="text-slate-300">Только Premium</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formTargetFree}
                      onChange={(e) => {
                        setFormTargetFree(e.target.checked)
                        if (e.target.checked) setFormTargetAll(false)
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-slate-300">Только Free</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formTitle || !formContent}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
