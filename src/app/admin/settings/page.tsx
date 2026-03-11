'use client'

import { useState } from 'react'
import { Save, Check, Lock, Eye, EyeOff } from 'lucide-react'

export default function AdminSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const handleChangePassword = async () => {
    setError('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Заполните все поля')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    if (newPassword.length < 6) {
      setError('Пароль должен быть минимум 6 символов')
      return
    }

    setSaving(true)

    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    })

    const data = await res.json()

    if (res.ok) {
      setSaved(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSaved(false), 2000)
    } else {
      setError(data.error || 'Ошибка')
    }

    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Настройки</h1>
        <p className="text-slate-400 mt-1">Конфигурация админ-панели</p>
      </div>

      {/* Change Password */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Смена пароля</h2>
            <p className="text-sm text-slate-400">Обновите пароль администратора</p>
          </div>
        </div>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Текущий пароль</label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 pr-10 text-white"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Новый пароль</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Подтверждение пароля</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : saved ? (
              <>
                <Check className="w-4 h-4" />
                Сохранено
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Изменить пароль
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-white mb-4">Информация</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-slate-700/50">
            <span className="text-slate-400">Версия приложения</span>
            <span className="text-white font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-700/50">
            <span className="text-slate-400">Фреймворк</span>
            <span className="text-white font-medium">Next.js 16</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-700/50">
            <span className="text-slate-400">База данных</span>
            <span className="text-white font-medium">SQLite / Prisma</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-400">Telegram API</span>
            <span className="text-white font-medium">Web App SDK</span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-500/10 backdrop-blur-xl rounded-2xl p-6 border border-red-500/30">
        <h2 className="text-lg font-semibold text-red-400 mb-4">Опасная зона</h2>
        <p className="text-slate-400 text-sm mb-4">
          Будьте осторожны с этими действиями. Они необратимы.
        </p>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 border border-red-500/30">
            Очистить логи
          </button>
          <button className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 border border-red-500/30">
            Сбросить базу данных
          </button>
        </div>
      </div>
    </div>
  )
}
