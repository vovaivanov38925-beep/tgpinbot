'use client'

import { useEffect, useState } from 'react'
import { Save, CreditCard, Star, Check } from 'lucide-react'

interface PaymentSettings {
  id: string
  starsEnabled: boolean
  starsMonthPrice: number
  starsYearPrice: number
  starsLifetimePrice: number
  yookassaEnabled: boolean
  yookassaShopId: string | null
  yookassaSecretKey: string | null
  yookassaMonthPrice: number
  yookassaYearPrice: number
  yookassaLifetimePrice: number
  currency: string
  trialDays: number
}

export default function AdminPaymentsPage() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/payments')
      .then(res => res.json())
      .then(data => {
        setSettings(data.settings)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setSaved(false)

    const res = await fetch('/api/admin/payments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })

    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  const updateSetting = (key: keyof PaymentSettings, value: string | number | boolean) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="text-center text-slate-400 py-12">
        Ошибка загрузки настроек
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Настройки оплаты</h1>
          <p className="text-slate-400 mt-1">Конфигурация платёжных систем</p>
        </div>
        <button
          onClick={handleSave}
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
              Сохранить
            </>
          )}
        </button>
      </div>

      {/* Telegram Stars */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Star className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Telegram Stars</h2>
            <p className="text-sm text-slate-400">Внутренняя валюта Telegram</p>
          </div>
          <label className="ml-auto flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-slate-400">Включить</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={settings.starsEnabled}
                onChange={(e) => updateSetting('starsEnabled', e.target.checked)}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${settings.starsEnabled ? 'bg-pink-500' : 'bg-slate-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${settings.starsEnabled ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
              </div>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Месяц (Stars)</label>
            <input
              type="number"
              value={settings.starsMonthPrice}
              onChange={(e) => updateSetting('starsMonthPrice', parseInt(e.target.value) || 0)}
              disabled={!settings.starsEnabled}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Год (Stars)</label>
            <input
              type="number"
              value={settings.starsYearPrice}
              onChange={(e) => updateSetting('starsYearPrice', parseInt(e.target.value) || 0)}
              disabled={!settings.starsEnabled}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Навсегда (Stars)</label>
            <input
              type="number"
              value={settings.starsLifetimePrice}
              onChange={(e) => updateSetting('starsLifetimePrice', parseInt(e.target.value) || 0)}
              disabled={!settings.starsEnabled}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* YooKassa */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">YooKassa</h2>
            <p className="text-sm text-slate-400">Платёжная система</p>
          </div>
          <label className="ml-auto flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-slate-400">Включить</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={settings.yookassaEnabled}
                onChange={(e) => updateSetting('yookassaEnabled', e.target.checked)}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${settings.yookassaEnabled ? 'bg-pink-500' : 'bg-slate-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${settings.yookassaEnabled ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
              </div>
            </div>
          </label>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Shop ID</label>
              <input
                type="text"
                value={settings.yookassaShopId || ''}
                onChange={(e) => updateSetting('yookassaShopId', e.target.value)}
                disabled={!settings.yookassaEnabled}
                placeholder="123456"
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Secret Key</label>
              <input
                type="password"
                value={settings.yookassaSecretKey || ''}
                onChange={(e) => updateSetting('yookassaSecretKey', e.target.value)}
                disabled={!settings.yookassaEnabled}
                placeholder="live_..."
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Месяц (₽)</label>
              <input
                type="number"
                value={settings.yookassaMonthPrice}
                onChange={(e) => updateSetting('yookassaMonthPrice', parseInt(e.target.value) || 0)}
                disabled={!settings.yookassaEnabled}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Год (₽)</label>
              <input
                type="number"
                value={settings.yookassaYearPrice}
                onChange={(e) => updateSetting('yookassaYearPrice', parseInt(e.target.value) || 0)}
                disabled={!settings.yookassaEnabled}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Навсегда (₽)</label>
              <input
                type="number"
                value={settings.yookassaLifetimePrice}
                onChange={(e) => updateSetting('yookassaLifetimePrice', parseInt(e.target.value) || 0)}
                disabled={!settings.yookassaEnabled}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* General Settings */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-white mb-4">Общие настройки</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Валюта</label>
            <select
              value={settings.currency}
              onChange={(e) => updateSetting('currency', e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="RUB">Рубль (RUB)</option>
              <option value="USD">Доллар (USD)</option>
              <option value="EUR">Евро (EUR)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Пробный период (дней)</label>
            <input
              type="number"
              value={settings.trialDays}
              onChange={(e) => updateSetting('trialDays', parseInt(e.target.value) || 0)}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
