'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, Search, ChevronLeft, ChevronRight, X, Send, Clock, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface Ticket {
  id: string
  telegramId: string
  chatId: string
  category: string
  status: string
  priority: string
  firstMessage: string
  lastMessage: string | null
  lastMessageAt: string | null
  lastMessageFrom: string | null
  createdAt: string
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    username: string | null
    telegramId: string
  }
  _count: {
    messages: number
  }
  statusInfo: {
    label: string
    emoji: string
    color: string
  }
  categoryInfo: {
    label: string
    emoji: string
  }
}

interface TicketDetails extends Ticket {
  messages: Array<{
    id: string
    senderType: string
    senderName: string | null
    message: string
    createdAt: string
  }>
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    username: string | null
    telegramId: string
    isPremium: boolean
    level: number
    points: number
  }
}

interface Stats {
  total: number
  open: number
  in_progress: number
  waiting_user: number
  resolved: number
  closed: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Открыт', color: 'text-green-400', bg: 'bg-green-500/20' },
  in_progress: { label: 'В работе', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  waiting_user: { label: 'Ожидает', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  resolved: { label: 'Решён', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  closed: { label: 'Закрыт', color: 'text-gray-400', bg: 'bg-gray-500/20' },
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, open: 0, in_progress: 0, waiting_user: 0, resolved: 0, closed: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedTicket, setSelectedTicket] = useState<TicketDetails | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const fetchTickets = async (pageNum: number = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(pageNum))
    params.set('limit', '15')
    if (search) params.set('search', search)
    if (statusFilter !== 'all') params.set('status', statusFilter)

    try {
      const res = await fetch(`/api/admin/support/tickets?${params}`)
      const data = await res.json()
      setTickets(data.tickets || [])
      setStats(data.stats || stats)
      setTotalPages(data.pages || 1)
      setPage(data.page || 1)
    } catch {
      console.error('Failed to fetch tickets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchTickets(1)
  }, [statusFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchTickets(1)
  }

  const openTicket = async (ticketId: string) => {
    setLoadingDetails(true)
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`)
      const data = await res.json()
      setSelectedTicket(data)
    } catch {
      console.error('Failed to fetch ticket details')
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleReply = async () => {
    if (!selectedTicket || !replyText.trim()) return
    setSending(true)

    try {
      const res = await fetch('/api/admin/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply',
          ticketId: selectedTicket.id,
          message: replyText,
          adminId: 'admin',
          adminName: 'Поддержка',
        })
      })

      if (res.ok) {
        setReplyText('')
        // Refresh ticket details
        const detailsRes = await fetch(`/api/admin/support/tickets/${selectedTicket.id}`)
        const data = await detailsRes.json()
        setSelectedTicket(data)
        fetchTickets(page)
      }
    } catch {
      console.error('Failed to send reply')
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          ticketId,
          status: newStatus,
          adminId: 'admin',
        })
      })

      if (res.ok) {
        fetchTickets(page)
        if (selectedTicket?.id === ticketId) {
          openTicket(ticketId)
        }
      }
    } catch {
      console.error('Failed to update status')
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Техподдержка</h1>
          <p className="text-slate-400 mt-1">Управление обращениями пользователей</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50">
          <p className="text-slate-400 text-sm">Всего</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <button
          onClick={() => setStatusFilter('open')}
          className={`bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border text-left ${statusFilter === 'open' ? 'border-green-500' : 'border-slate-700/50'}`}
        >
          <p className="text-slate-400 text-sm">Открытых</p>
          <p className="text-2xl font-bold text-green-400">{stats.open}</p>
        </button>
        <button
          onClick={() => setStatusFilter('in_progress')}
          className={`bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border text-left ${statusFilter === 'in_progress' ? 'border-yellow-500' : 'border-slate-700/50'}`}
        >
          <p className="text-slate-400 text-sm">В работе</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.in_progress}</p>
        </button>
        <button
          onClick={() => setStatusFilter('waiting_user')}
          className={`bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border text-left ${statusFilter === 'waiting_user' ? 'border-blue-500' : 'border-slate-700/50'}`}
        >
          <p className="text-slate-400 text-sm">Ожидают</p>
          <p className="text-2xl font-bold text-blue-400">{stats.waiting_user}</p>
        </button>
        <button
          onClick={() => setStatusFilter('resolved')}
          className={`bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border text-left ${statusFilter === 'resolved' ? 'border-emerald-500' : 'border-slate-700/50'}`}
        >
          <p className="text-slate-400 text-sm">Решённых</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.resolved}</p>
        </button>
        <button
          onClick={() => setStatusFilter('closed')}
          className={`bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border text-left ${statusFilter === 'closed' ? 'border-gray-500' : 'border-slate-700/50'}`}
        >
          <p className="text-slate-400 text-sm">Закрытых</p>
          <p className="text-2xl font-bold text-gray-400">{stats.closed}</p>
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по сообщениям или имени..."
            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white rounded-lg font-medium hover:opacity-90"
        >
          Найти
        </button>
        {statusFilter !== 'all' && (
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
          >
            Сбросить
          </button>
        )}
      </form>

      {/* Tickets List */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="divide-y divide-slate-700/30">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Обращений не найдено</p>
            </div>
          ) : (
            tickets.map((ticket) => {
              const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open
              return (
                <button
                  key={ticket.id}
                  onClick={() => openTicket(ticket.id)}
                  className="w-full p-4 flex items-start gap-4 hover:bg-slate-700/20 text-left"
                >
                  <div className="flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full ${statusConf.bg} flex items-center justify-center`}>
                      <MessageCircle className={`w-5 h-5 ${statusConf.color}`} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white truncate">
                        {ticket.user.firstName || 'Пользователь'}
                      </span>
                      {ticket.user.username && (
                        <span className="text-slate-400 text-sm">@{ticket.user.username}</span>
                      )}
                      <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${statusConf.bg} ${statusConf.color}`}>
                        {statusConf.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 line-clamp-2 mb-1">
                      {ticket.lastMessage || ticket.firstMessage}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{ticket.categoryInfo?.label || 'Общий'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(ticket.createdAt)}
                      </span>
                      <span>•</span>
                      <span>{ticket._count.messages} сообщ.</span>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
            <p className="text-sm text-slate-400">
              Страница {page} из {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchTickets(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchTickets(page + 1)}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-slate-700 flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Тикет #{selectedTicket.id.slice(-8).toUpperCase()}
                </h2>
                <p className="text-sm text-slate-400">
                  {selectedTicket.categoryInfo?.label} • {STATUS_CONFIG[selectedTicket.status]?.label}
                </p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Info */}
            <div className="p-4 bg-slate-900/50 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white font-medium">
                    {(selectedTicket.user.firstName || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-white">{selectedTicket.user.firstName || 'Пользователь'}</p>
                    <p className="text-sm text-slate-400">
                      {selectedTicket.user.username ? `@${selectedTicket.user.username}` : `ID: ${selectedTicket.user.telegramId.slice(0, 10)}...`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Уровень {selectedTicket.user.level}</p>
                  <p className="text-sm text-pink-400">{selectedTicket.user.points} pts</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[40vh]">
              {selectedTicket.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === 'user' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[80%] p-3 rounded-xl ${
                    msg.senderType === 'user'
                      ? 'bg-slate-700/50 text-white'
                      : 'bg-pink-500/20 text-pink-100'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-slate-400">
                        {msg.senderType === 'user' ? 'Пользователь' : msg.senderName || 'Поддержка'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDate(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply Section */}
            {selectedTicket.status !== 'closed' && (
              <div className="p-4 border-t border-slate-700">
                <div className="flex gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Написать ответ..."
                    className="flex-1 bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                    rows={2}
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim() || sending}
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Status Actions */}
            <div className="p-4 border-t border-slate-700 flex flex-wrap gap-2">
              {selectedTicket.status !== 'closed' && (
                <>
                  {selectedTicket.status !== 'in_progress' && (
                    <button
                      onClick={() => handleStatusChange(selectedTicket.id, 'in_progress')}
                      className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm hover:bg-yellow-500/30"
                    >
                      Взять в работу
                    </button>
                  )}
                  {selectedTicket.status !== 'waiting_user' && (
                    <button
                      onClick={() => handleStatusChange(selectedTicket.id, 'waiting_user')}
                      className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30"
                    >
                      Ожидает ответа
                    </button>
                  )}
                  <button
                    onClick={() => handleStatusChange(selectedTicket.id, 'resolved')}
                    className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/30"
                  >
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Решён
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedTicket.id, 'closed')}
                    className="px-3 py-1.5 bg-gray-500/20 text-gray-400 rounded-lg text-sm hover:bg-gray-500/30"
                  >
                    Закрыть
                  </button>
                </>
              )}
              {selectedTicket.status === 'closed' && (
                <button
                  onClick={() => handleStatusChange(selectedTicket.id, 'open')}
                  className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30"
                  >
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    Переоткрыть
                  </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
