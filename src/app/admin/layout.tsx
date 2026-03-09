'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  Shield
} from 'lucide-react'

interface AdminData {
  id: string
  username: string
  role: string
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [admin, setAdmin] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    // Skip auth check on login page
    if (pathname === '/admin/login') {
      setLoading(false)
      return
    }

    let mounted = true

    fetch('/api/admin/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!mounted) return
        if (data.admin) {
          setAdmin(data.admin)
        } else {
          router.push('/admin/login')
        }
      })
      .catch(() => {
        if (mounted) router.push('/admin/login')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const navItems = [
    { href: '/admin', icon: LayoutDashboard, label: 'Дашборд' },
    { href: '/admin/users', icon: Users, label: 'Пользователи' },
    { href: '/admin/logs', icon: FileText, label: 'Логи' },
    { href: '/admin/payments', icon: CreditCard, label: 'Оплата' },
    { href: '/admin/settings', icon: Settings, label: 'Настройки' },
  ]

  // Login page - no layout
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!admin) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-800/95 backdrop-blur-xl border-r border-slate-700/50 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white">Admin Panel</h1>
                <p className="text-xs text-slate-400">Pinterest to Action</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-pink-500/20 to-violet-500/20 text-white border border-pink-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </a>
              )
            })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-slate-700/50">
            <div className="flex items-center justify-between mb-3 px-4">
              <div>
                <p className="text-sm font-medium text-white">{admin.username}</p>
                <p className="text-xs text-slate-400">{admin.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Выйти
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden bg-slate-800/95 backdrop-blur-xl border-b border-slate-700/50 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-semibold text-white">Admin Panel</span>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-red-400"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        {/* Page content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
