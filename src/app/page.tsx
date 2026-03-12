'use client'

import { useEffect, useState, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStore, type Pin, type Task, type Achievement } from '@/lib/store'
import {
  Pin as PinIcon,
  CheckCircle2,
  Circle,
  Clock,
  Bell,
  Calendar,
  Star,
  Sparkles,
  Crown,
  Diamond,
  Plus,
  Trash2,
  ChefHat,
  Shirt,
  Wrench,
  Plane,
  Dumbbell,
  Home,
  Palette,
  Flower2,
  Heart,
  Baby,
  Cat,
  Laptop,
  BookOpen,
  Zap,
  Target,
  Trophy,
  Medal,
  Award,
  Rocket,
  Folder,
  Archive,
  Gem,
  ListTodo,
  Loader2,
  X,
  ExternalLink,
  ChevronRight,
  Gift,
  Layers,
  RefreshCw,
  Link
} from 'lucide-react'

// Icon mapping for categories
const categoryIcons: Record<string, React.ReactNode> = {
  recipe: <ChefHat className="w-4 h-4" />,
  fashion: <Shirt className="w-4 h-4" />,
  diy: <Wrench className="w-4 h-4" />,
  travel: <Plane className="w-4 h-4" />,
  fitness: <Dumbbell className="w-4 h-4" />,
  beauty: <Sparkles className="w-4 h-4" />,
  home: <Home className="w-4 h-4" />,
  art: <Palette className="w-4 h-4" />,
  garden: <Flower2 className="w-4 h-4" />,
  wedding: <Heart className="w-4 h-4" />,
  kids: <Baby className="w-4 h-4" />,
  pets: <Cat className="w-4 h-4" />,
  tech: <Laptop className="w-4 h-4" />,
  books: <BookOpen className="w-4 h-4" />,
  other: <Sparkles className="w-4 h-4" />
}

// Icon mapping for achievements
const achievementIcons: Record<string, React.ReactNode> = {
  Pin: <PinIcon className="w-5 h-5" />,
  Folder: <Folder className="w-5 h-5" />,
  Archive: <Archive className="w-5 h-5" />,
  Gem: <Gem className="w-5 h-5" />,
  CheckCircle: <CheckCircle2 className="w-5 h-5" />,
  ListTodo: <ListTodo className="w-5 h-5" />,
  Rocket: <Rocket className="w-5 h-5" />,
  Crown: <Crown className="w-5 h-5" />,
  Star: <Star className="w-5 h-5" />,
  Sparkles: <Sparkles className="w-5 h-5" />,
  Award: <Award className="w-5 h-5" />,
  Diamond: <Diamond className="w-5 h-5" />
}

// Sample achievements for fallback
const sampleAchievements: Achievement[] = [
  { id: '1', name: 'Первый шаг', description: 'Сохраните свой первый пин', icon: 'Pin', category: 'pins', requirement: 1, points: 10, unlocked: false },
  { id: '2', name: 'Коллекционер', description: 'Сохраните 10 пинов', icon: 'Folder', category: 'pins', requirement: 10, points: 50, unlocked: false },
  { id: '3', name: 'Начинающий', description: 'Выполните первую задачу', icon: 'CheckCircle', category: 'tasks', requirement: 1, points: 15, unlocked: false },
  { id: '4', name: 'Деятельный', description: 'Выполните 10 задач', icon: 'ListTodo', category: 'tasks', requirement: 10, points: 75, unlocked: false },
  { id: '5', name: 'Опытный', description: 'Наберите 100 очков', icon: 'Star', category: 'social', requirement: 100, points: 50, unlocked: false },
  { id: '6', name: 'Премиум', description: 'Оформите премиум подписку', icon: 'Diamond', category: 'premium', requirement: 1, points: 100, unlocked: false }
]

// Pinterest Board interface
interface PinterestBoard {
  id: string
  boardUrl: string
  boardName: string | null
  boardUsername: string | null
  lastSyncAt: string | null
  totalPins: number
  newPins: number
  isActive: boolean
  autoSync: boolean
  createdAt: string
}

export default function PinterestApp() {
  const {
    user,
    pins,
    tasks,
    achievements,
    categories,
    isLoading,
    setUser,
    setPins,
    addPin,
    updatePin,
    removePin,
    setTasks,
    addTask,
    updateTask,
    removeTask,
    setAchievements,
    setCategories,
    setLoading
  } = useStore()

  const [showAddPin, setShowAddPin] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null)
  const [newPinUrl, setNewPinUrl] = useState('')
  const [newPinTitle, setNewPinTitle] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('medium')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [newTaskReminderTime, setNewTaskReminderTime] = useState('')
  const [isCategorizing, setIsCategorizing] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [isAddingPin, setIsAddingPin] = useState(false)
  const isAddingTaskRef = useRef(false) // Для мгновенной блокировки
  const lastTaskAddTimeRef = useRef(0) // Для защиты от быстрых кликов
  const [extractedData, setExtractedData] = useState<{imageUrl: string, title: string | null, description: string | null, sourceUrl: string | null} | null>(null)
  const [levelProgress, setLevelProgress] = useState(0)

  // Boards state
  const [boards, setBoards] = useState<PinterestBoard[]>([])
  const [showAddBoard, setShowAddBoard] = useState(false)
  const [newBoardUrl, setNewBoardUrl] = useState('')
  const [isScrapingBoard, setIsScrapingBoard] = useState(false)
  const [isSyncingBoard, setIsSyncingBoard] = useState<string | null>(null)
  const [scrapedBoardData, setScrapedBoardData] = useState<{boardName: string | null, pins: any[]} | null>(null)

  // Initialize data
  useEffect(() => {
    const initApp = async () => {
      try {
        // Wait for Telegram WebApp to be ready
        const waitForTelegram = (): Promise<void> => {
          return new Promise((resolve) => {
            if (typeof window === 'undefined') {
              resolve()
              return
            }

            // Check if already loaded
            if ((window as any).Telegram?.WebApp) {
              resolve()
              return
            }

            // Wait for script to load
            let attempts = 0
            const maxAttempts = 50 // 5 seconds max
            const interval = setInterval(() => {
              attempts++
              if ((window as any).Telegram?.WebApp) {
                clearInterval(interval)
                resolve()
              } else if (attempts >= maxAttempts) {
                clearInterval(interval)
                resolve()
              }
            }, 100)
          })
        }

        await waitForTelegram()

        // Get Telegram user data
        let telegramId = 'demo_user'
        let firstName = 'Гость'
        let lastName = ''
        let username = null
        let photoUrl = null
        let isRealTelegramUser = false

        // Check if running in Telegram
        const tg = (window as any).Telegram
        console.log('Telegram WebApp:', tg?.WebApp)
        console.log('initDataUnsafe:', tg?.WebApp?.initDataUnsafe)
        console.log('Platform:', tg?.WebApp?.platform)
        console.log('Version:', tg?.WebApp?.version)

        if (tg?.WebApp?.initDataUnsafe?.user) {
          const tgUser = tg.WebApp.initDataUnsafe.user
          console.log('Telegram user:', tgUser)
          telegramId = String(tgUser.id)
          firstName = tgUser.first_name || 'Пользователь'
          lastName = tgUser.last_name || ''
          username = tgUser.username || null
          photoUrl = tgUser.photo_url || null
          isRealTelegramUser = true
          console.log('Using Telegram data:', { telegramId, firstName, lastName, username, photoUrl })
        } else {
          // Проверяем платформу
          const platform = tg?.WebApp?.platform || 'unknown'
          console.log('No Telegram user data found', { platform })

          // Если открыто в Telegram но нет данных пользователя - возможна проблема
          if (platform !== 'unknown' && platform !== 'web') {
            console.warn('App opened in Telegram but no user data! Check Mini App configuration.')
          }
        }

        // Create or get user
        const userRes = await fetch('/api/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramId, firstName, lastName, username, photoUrl })
        })
        const userData = await userRes.json()
        console.log('User data from API:', userData)

        if (!userRes.ok || !userData.id) {
          console.error('Failed to get/create user:', userData)
          throw new Error(userData.error || 'Failed to create user')
        }

        setUser(userData)

        // Get categories
        const catRes = await fetch('/api/ai/categorize')
        const catData = await catRes.json()
        setCategories(Array.isArray(catData) ? catData : [])

        // Get achievements
        const achRes = await fetch(`/api/achievements?userId=${userData.id}`)
        const achData = await achRes.json()
        setAchievements(Array.isArray(achData) && achData.length > 0 ? achData : sampleAchievements)

        // Get pins
        const pinsRes = await fetch(`/api/pins?userId=${userData.id}`)
        const pinsData = await pinsRes.json()
        setPins(Array.isArray(pinsData?.pins) ? pinsData.pins : (Array.isArray(pinsData) ? pinsData : []))

        // Get tasks
        const tasksRes = await fetch(`/api/tasks?userId=${userData.id}`)
        const tasksData = await tasksRes.json()
        setTasks(Array.isArray(tasksData?.tasks) ? tasksData.tasks : (Array.isArray(tasksData) ? tasksData : []))

        // Get boards
        const boardsRes = await fetch(`/api/pinterest/sync?userId=${userData.id}`)
        const boardsData = await boardsRes.json()
        setBoards(Array.isArray(boardsData?.boards) ? boardsData.boards : [])

        setLoading(false)
      } catch (error) {
        console.error('Error initializing app:', error)
        setLoading(false)
      }
    }

    initApp()
  }, [])

  // Calculate level progress
  useEffect(() => {
    if (user) {
      const pointsForCurrentLevel = user.level * 100
      const pointsForNextLevel = (user.level + 1) * 100
      const progress = ((user.points - pointsForCurrentLevel + 100) / (pointsForNextLevel - pointsForCurrentLevel + 100)) * 100
      setLevelProgress(Math.min(Math.max(progress, 0), 100))
    }
  }, [user])

  // Extract image from Pinterest URL
  const extractFromUrl = async (url: string) => {
    if (!url) return
    
    setIsExtracting(true)
    setExtractedData(null)
    
    try {
      const res = await fetch('/api/extract-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      const data = await res.json()
      
      if (data.imageUrl) {
        setExtractedData(data)
        if (data.title && !newPinTitle) {
          setNewPinTitle(data.title)
        }
      } else if (data.error) {
        console.log('Extract error:', data.error)
        // If extraction failed, try to use URL directly
        setExtractedData({ imageUrl: url, title: null, description: null, sourceUrl: url })
      }
    } catch (error) {
      console.error('Error extracting:', error)
      // Fallback to using URL directly
      setExtractedData({ imageUrl: url, title: null, description: null, sourceUrl: url })
    } finally {
      setIsExtracting(false)
    }
  }

  const handleAddPin = async () => {
    const imageUrl = extractedData?.imageUrl || newPinUrl
    if (!user || !imageUrl) return

    setIsCategorizing(true)
    try {
      // Categorize pin using AI
      const catRes = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newPinTitle || extractedData?.title, description: extractedData?.description || '' })
      })
      const catData = await catRes.json()

      // Create pin
      const res = await fetch('/api/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          imageUrl: imageUrl,
          title: newPinTitle || extractedData?.title || catData.suggestedTitle || 'Новый пин',
          description: extractedData?.description || catData.suggestedDescription || '',
          category: catData.category || 'other',
          sourceUrl: extractedData?.sourceUrl || newPinUrl
        })
      })
      const pin = await res.json()
      addPin(pin)

      // Update user points
      if (user) {
        setUser({ ...user, points: user.points + pin.points })
      }

      setNewPinUrl('')
      setNewPinTitle('')
      setExtractedData(null)
      setShowAddPin(false)
    } catch (error) {
      console.error('Error adding pin:', error)
    } finally {
      setIsCategorizing(false)
    }
  }

  const handleDeletePin = async (id: string) => {
    try {
      await fetch(`/api/pins?id=${id}`, { method: 'DELETE' })
      removePin(id)
    } catch (error) {
      console.error('Error deleting pin:', error)
    }
  }

  const handleAddTask = async () => {
    // Мгновенная блокировка через ref (синхронно)
    const now = Date.now()
    if (!user || !newTaskTitle || isAddingTaskRef.current) return

    // Защита от быстрых кликов - минимум 1 секунда между попытками
    if (now - lastTaskAddTimeRef.current < 1000) return

    isAddingTaskRef.current = true
    lastTaskAddTimeRef.current = now
    setIsAddingTask(true)

    try {
      // Combine date and time for reminder (keep local time, don't convert to UTC)
      let reminderTime: string | null = null
      if (newTaskDueDate && newTaskReminderTime) {
        reminderTime = `${newTaskDueDate}T${newTaskReminderTime}:00`
      } else if (newTaskDueDate) {
        reminderTime = `${newTaskDueDate}T12:00:00`
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: newTaskTitle,
          description: newTaskDescription,
          priority: newTaskPriority,
          dueDate: newTaskDueDate ? `${newTaskDueDate}T12:00:00` : null,
          reminderTime
        })
      })
      const task = await res.json()
      addTask(task)

      setNewTaskTitle('')
      setNewTaskDescription('')
      setNewTaskPriority('medium')
      setNewTaskDueDate('')
      setNewTaskReminderTime('')
      setShowAddTask(false)
    } catch (error) {
      console.error('Error adding task:', error)
    } finally {
      isAddingTaskRef.current = false
      setIsAddingTask(false)
    }
  }

  const handleToggleTask = async (task: Task) => {
    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed'
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: newStatus })
      })
      const updatedTask = await res.json()
      updateTask(updatedTask)

      // Update user points if task completed
      if (newStatus === 'completed' && user) {
        setUser({ ...user, points: user.points + task.points })
      }
    } catch (error) {
      console.error('Error toggling task:', error)
    }
  }

  const handleDeleteTask = async (id: string) => {
    try {
      await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
      removeTask(id)
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  // Scrape board URL
  const scrapeBoard = async (url: string) => {
    if (!url) return

    setIsScrapingBoard(true)
    setScrapedBoardData(null)

    try {
      const res = await fetch('/api/pinterest/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardUrl: url })
      })
      const data = await res.json()

      if (data.success && data.pins.length > 0) {
        setScrapedBoardData({
          boardName: data.boardName,
          pins: data.pins
        })
      } else {
        alert(data.error || 'Не удалось получить пины с доски')
      }
    } catch (error) {
      console.error('Error scraping board:', error)
      alert('Ошибка при скрейпинге доски')
    } finally {
      setIsScrapingBoard(false)
    }
  }

  // Sync board pins
  const syncBoard = async () => {
    if (!user || !newBoardUrl || !scrapedBoardData) return

    setIsSyncingBoard('new')

    try {
      const res = await fetch('/api/pinterest/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          boardUrl: newBoardUrl,
          pins: scrapedBoardData.pins,
          boardName: scrapedBoardData.boardName,
          boardUsername: null
        })
      })
      const data = await res.json()

      if (data.success) {
        alert(`Синхронизация завершена!\nДобавлено: ${data.newPinsAdded} пинов\n+${data.pointsEarned} очков`)

        // Refresh boards
        const boardsRes = await fetch(`/api/pinterest/sync?userId=${user.id}`)
        const boardsData = await boardsRes.json()
        setBoards(Array.isArray(boardsData?.boards) ? boardsData.boards : [])

        // Refresh pins
        const pinsRes = await fetch(`/api/pins?userId=${user.id}`)
        const pinsData = await pinsRes.json()
        setPins(Array.isArray(pinsData?.pins) ? pinsData.pins : (Array.isArray(pinsData) ? pinsData : []))

        // Update user points
        if (user && data.pointsEarned) {
          setUser({ ...user, points: user.points + data.pointsEarned })
        }

        setShowAddBoard(false)
        setNewBoardUrl('')
        setScrapedBoardData(null)
      } else {
        alert(data.error || 'Ошибка синхронизации')
      }
    } catch (error) {
      console.error('Error syncing board:', error)
      alert('Ошибка при синхронизации')
    } finally {
      setIsSyncingBoard(null)
    }
  }

  // Re-sync existing board
  const resyncBoard = async (board: PinterestBoard) => {
    if (!user) return

    setIsSyncingBoard(board.id)

    try {
      // First scrape
      const scrapeRes = await fetch('/api/pinterest/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardUrl: board.boardUrl })
      })
      const scrapeData = await scrapeRes.json()

      if (!scrapeData.success || scrapeData.pins.length === 0) {
        alert('Не удалось получить пины с доски')
        setIsSyncingBoard(null)
        return
      }

      // Then sync
      const syncRes = await fetch('/api/pinterest/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          boardUrl: board.boardUrl,
          pins: scrapeData.pins,
          boardName: scrapeData.boardName || board.boardName,
          boardUsername: board.boardUsername
        })
      })
      const syncData = await syncRes.json()

      if (syncData.success) {
        alert(`Синхронизация завершена!\nДобавлено: ${syncData.newPinsAdded} новых пинов`)

        // Refresh boards
        const boardsRes = await fetch(`/api/pinterest/sync?userId=${user.id}`)
        const boardsData = await boardsRes.json()
        setBoards(Array.isArray(boardsData?.boards) ? boardsData.boards : [])

        // Refresh pins
        const pinsRes = await fetch(`/api/pins?userId=${user.id}`)
        const pinsData = await pinsRes.json()
        setPins(Array.isArray(pinsData?.pins) ? pinsData.pins : (Array.isArray(pinsData) ? pinsData : []))

        // Update user points
        if (user && syncData.pointsEarned) {
          setUser({ ...user, points: user.points + syncData.pointsEarned })
        }
      } else {
        alert(syncData.error || 'Ошибка синхронизации')
      }
    } catch (error) {
      console.error('Error resyncing board:', error)
      alert('Ошибка при синхронизации')
    } finally {
      setIsSyncingBoard(null)
    }
  }

  // Delete board
  const deleteBoard = async (boardId: string) => {
    if (!user) return
    
    const confirmed = confirm('Удалить доску и все её пины?')
    if (!confirmed) return

    try {
      const res = await fetch('/api/pinterest/sync', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, userId: user.id, deletePins: true })
      })
      const data = await res.json()
      
      // Update boards list
      setBoards(boards.filter(b => b.id !== boardId))
      
      // Refresh pins list
      const pinsRes = await fetch(`/api/pins?userId=${user.id}`)
      const pinsData = await pinsRes.json()
      setPins(Array.isArray(pinsData?.pins) ? pinsData.pins : (Array.isArray(pinsData) ? pinsData : []))
      
      if (data.deletedPins > 0) {
        console.log(`Deleted ${data.deletedPins} pins`)
      }
    } catch (error) {
      console.error('Error deleting board:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-pink">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-lavender flex items-center justify-center animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <p className="text-lg font-medium text-foreground/70">Загрузка...</p>
        </div>
      </div>
    )
  }

  // Проверяем, зашел ли пользователь как гость (не через Telegram)
  const isGuest = user?.telegramId === 'demo_user'

  return (
    <div className="h-dvh overflow-hidden overflow-x-hidden gradient-pink flex flex-col">
      {/* Предупреждение для гостей */}
      {isGuest && (
        <div className="bg-amber-500/90 text-white px-4 py-2 text-center text-sm shrink-0">
          ⚠️ <strong>Демо-режим</strong> — откройте приложение через Telegram бота для полного доступа
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-pink/20 shrink-0">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 border-2 border-pink">
                <AvatarImage src={user?.photoUrl || ''} />
                <AvatarFallback className="gradient-pink text-white">
                  {user?.firstName?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-foreground">
                  {user?.firstName || 'Гость'}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500" />
                  lvl {user?.level || 1}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-lavender/20 px-3 py-1.5 rounded-full">
                <Zap className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">{user?.points || 0}</span>
              </div>
              {user?.isPremium && (
                <Badge className="gradient-full text-white border-0">
                  <Crown className="w-3 h-3 mr-1" />
                  PRO
                </Badge>
              )}
            </div>
          </div>
          
          {/* Level progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Прогресс уровня</span>
              <span>{Math.round(levelProgress)}%</span>
            </div>
            <Progress value={levelProgress} className="h-2 bg-pink/20" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 pt-4 flex-1 overflow-hidden flex flex-col w-full">
        <Tabs defaultValue="pins" className="w-full flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full bg-muted/30 shrink-0 flex gap-2 p-2 rounded-2xl h-[72px]">
            <TabsTrigger value="pins" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl transition-all flex flex-col items-center justify-center py-2 gap-1 h-full">
              <PinIcon className="w-5 h-5" />
              <span className="text-xs font-medium">Пины</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex-1 data-[state=active]:bg-violet-500 data-[state=active]:text-white rounded-xl transition-all flex flex-col items-center justify-center py-2 gap-1 h-full">
              <ListTodo className="w-5 h-5" />
              <span className="text-xs font-medium">Задачи</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-white rounded-xl transition-all flex flex-col items-center justify-center py-2 gap-1 h-full">
              <Trophy className="w-5 h-5" />
              <span className="text-xs font-medium">Прогресс</span>
            </TabsTrigger>
            <TabsTrigger value="premium" className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-pink-500 data-[state=active]:text-white rounded-xl transition-all flex flex-col items-center justify-center py-2 gap-1 h-full">
              <Crown className="w-5 h-5" />
              <span className="text-xs font-medium">PRO</span>
            </TabsTrigger>
          </TabsList>

          {/* Pins Tab */}
          <TabsContent value="pins" className="mt-4 flex-1 flex flex-col overflow-hidden w-full data-[state=inactive]:hidden">
            <ScrollArea className="flex-1 h-0 w-full overflow-x-hidden">
              <div className="space-y-4 pr-2 pb-4 w-full max-w-full">
                {/* Boards Section */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <Layers className="w-5 h-5 text-blue-500" />
                      Мои доски
                    </h3>
                    <Button
                      onClick={() => setShowAddBoard(true)}
                      size="sm"
                      variant="outline"
                      className="border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Добавить
                    </Button>
                  </div>

                  {boards.length === 0 ? (
                    <Card className="border-dashed border-blue-500/30 bg-blue-500/5 w-full">
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-2">Нет подключённых досок</p>
                        <p className="text-xs text-muted-foreground/70">
                          Добавьте доску Pinterest для синхронизации пинов
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2 w-full">
                      {boards.map((board) => (
                        <Card key={board.id} className="border-blue-500/20 hover:shadow-lg transition-all duration-300 w-full overflow-hidden">
                          <CardContent className="p-3 overflow-hidden">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                                <Layers className="w-5 h-5 text-blue-500" />
                              </div>
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <p className="font-medium text-sm truncate w-full">{board.boardName || 'Доска без названия'}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <PinIcon className="w-3 h-3" />
                                    {board.totalPins} пинов
                                  </span>
                                  {board.lastSyncAt && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {new Date(board.lastSyncAt).toLocaleDateString('ru-RU')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                                  onClick={() => resyncBoard(board)}
                                  disabled={isSyncingBoard === board.id}
                                >
                                  {isSyncingBoard === board.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-4 h-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteBoard(board.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pins Section */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold">Мои пины</h3>
                    <Button
                      onClick={() => setShowAddPin(true)}
                      size="sm"
                      className="gradient-pink text-white border-0 shadow-soft"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Добавить
                    </Button>
                  </div>

                  {pins.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full gradient-lavender flex items-center justify-center">
                        <PinIcon className="w-7 h-7 text-white" />
                      </div>
                      <p className="text-muted-foreground mb-2 text-sm">Пока нет сохранённых идей</p>
                      <p className="text-xs text-muted-foreground/70">
                        Нажмите "Добавить" чтобы сохранить первую идею
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 w-full">
                      {pins.map((pin, index) => (
                        <Card
                          key={pin.id || `pin-${index}`}
                          className="overflow-hidden cursor-pointer hover:shadow-pink transition-all duration-300 border-pink/10 w-full"
                          onClick={() => setSelectedPin(pin)}
                        >
                          <div className="aspect-square relative w-full overflow-hidden">
                            <img
                              src={pin.imageUrl}
                              alt={pin.title || 'Pin'}
                              className="w-full h-full object-cover max-w-full"
                            />
                            {pin.isCompleted && (
                              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 text-white" />
                              </div>
                            )}
                            {pin.category && (
                              <div className="absolute bottom-2 left-2">
                                <Badge variant="secondary" className="bg-white/90 text-xs">
                                  {categoryIcons[pin.category]}
                                  <span className="ml-1">{categories.find(c => c.id === pin.category)?.name || pin.category}</span>
                                </Badge>
                              </div>
                            )}
                          </div>
                          <CardContent className="p-3 overflow-hidden">
                            <p className="font-medium text-sm truncate w-full">{pin.title}</p>
                            <p className="text-xs text-muted-foreground truncate w-full">{pin.description}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-4 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-lg font-semibold">Мои задачи</h2>
              <Button
                onClick={() => setShowAddTask(true)}
                size="sm"
                className="gradient-lavender text-white border-0 shadow-soft"
              >
                <Plus className="w-4 h-4 mr-1" />
                Добавить
              </Button>
            </div>

            <ScrollArea className="flex-1 h-0">
              <div className="space-y-3 pr-2 pb-4">
                {tasks.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-pink flex items-center justify-center">
                      <ListTodo className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-muted-foreground mb-4">Нет задач</p>
                    <p className="text-sm text-muted-foreground/70">
                      Создайте первую задачу или добавьте её из сохранённого пина
                    </p>
                  </div>
                ) : (
                  <>
                    {tasks.filter(t => t.status !== 'completed').map((task, index) => (
                      <Card key={task.id || `task-${index}`} className="border-lavender/20 hover:shadow-lavender transition-all duration-300">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => handleToggleTask(task)}
                              className="mt-1 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Circle className="w-5 h-5" />
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{task.title}</p>
                              {task.description && (
                                <p className="text-sm text-muted-foreground">{task.description}</p>
                              )}
                              {task.reminderTime && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                                  <Bell className="w-3 h-3" />
                                  <span>
                                    {new Date(task.reminderTime).toLocaleString('ru-RU', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      timeZone: 'Europe/Moscow'
                                    })}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                {task.priority === 'high' && (
                                  <Badge variant="destructive" className="text-xs">Важно</Badge>
                                )}
                                {task.priority === 'medium' && (
                                  <Badge variant="secondary" className="text-xs">Средний</Badge>
                                )}
                                {task.category && (
                                  <Badge variant="outline" className="text-xs">
                                    {categoryIcons[task.category]}
                                    <span className="ml-1">{task.category}</span>
                                  </Badge>
                                )}
                                <Badge className="bg-lavender/20 text-xs">
                                  <Zap className="w-3 h-3 mr-1" />
                                  {task.points}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteTask(task.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {tasks.filter(t => t.status === 'completed').length > 0 && (
                      <div key="completed-section">
                        <div className="flex items-center gap-2 mt-6 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <p className="text-sm font-medium text-muted-foreground">Выполнено</p>
                        </div>
                        {tasks.filter(t => t.status === 'completed').map((task, index) => (
                          <Card key={task.id || `completed-${index}`} className="opacity-60 border-green-500/20 mb-3">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => handleToggleTask(task)}
                                  className="mt-1 text-green-500"
                                >
                                  <CheckCircle2 className="w-5 h-5" />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium line-through">{task.title}</p>
                                  <Badge className="bg-green-500/20 text-green-600 text-xs mt-1">
                                    +{task.points} очков
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="mt-4 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="flex-1 h-0">
              <div className="space-y-4 px-1 pb-4">
                {/* Level Header */}
                <Card className="gradient-full border-0 overflow-hidden">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
                      <Trophy className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Уровень {user?.level || 1}</h3>
                    <div className="max-w-xs mx-auto">
                      <Progress value={levelProgress} className="h-3 bg-white/20" />
                      <p className="text-white/80 text-sm mt-2">{user?.points || 0} очков</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats */}
                <Card className="border-pink/10">
                  <CardHeader>
                    <CardTitle>Статистика</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="gradient-pink rounded-lg p-3 text-center">
                        <PinIcon className="w-6 h-6 mx-auto mb-1 text-white/80" />
                        <p className="text-xl font-bold text-white">{pins.length}</p>
                        <p className="text-xs text-white/80">Пинов</p>
                      </div>
                      <div className="gradient-lavender rounded-lg p-3 text-center">
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-white/80" />
                        <p className="text-xl font-bold text-white">{tasks.filter(t => t.status === 'completed').length}</p>
                        <p className="text-xs text-white/80">Выполнено</p>
                      </div>
                      <div className="gradient-peach rounded-lg p-3 text-center">
                        <Zap className="w-6 h-6 mx-auto mb-1 text-white/80" />
                        <p className="text-xl font-bold text-white">{user?.points || 0}</p>
                        <p className="text-xs text-white/80">Очков</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Achievements */}
                <Card className="border-pink/10">
                  <CardHeader>
                    <CardTitle>Достижения</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {achievements.map((a) => (
                        <div key={a.id} className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${a.unlocked ? 'gradient-pink' : 'bg-muted'}`}>
                            {achievementIcons[a.icon] || <Star className={`w-5 h-5 ${a.unlocked ? 'text-white' : 'text-muted-foreground'}`} />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{a.name}</p>
                            <p className="text-xs text-muted-foreground">{a.description}</p>
                          </div>
                          <Badge variant={a.unlocked ? 'default' : 'secondary'} className={a.unlocked ? 'gradient-pink border-0' : ''}>
                            +{a.points}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Premium Tab */}
          <TabsContent value="premium" className="mt-4 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="flex-1 h-0">
              <div className="space-y-4 pr-2 pb-4">
                <Card className="gradient-full border-0 overflow-hidden">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
                      <Crown className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Pinterest Pro</h3>
                    <p className="text-white/80 text-sm mb-4">
                      Раскройте полный потенциал вашего вдохновения
                    </p>
                    <Badge className="bg-white/20 text-white border-0 mb-4">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Премиум подписка
                    </Badge>
                  </CardContent>
                </Card>

                <Card className="border-pink/10">
                  <CardHeader>
                    <CardTitle>Преимущества Premium</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { icon: <Zap className="w-5 h-5" />, title: 'Безлимитные пины', desc: 'Сохраняйте сколько угодно идей' },
                        { icon: <Sparkles className="w-5 h-5" />, title: 'AI-категоризация', desc: 'Умная сортировка ваших пинов' },
                        { icon: <Target className="w-5 h-5" />, title: 'Продвинутые задачи', desc: 'Создавайте подзадачи и напоминания' },
                        { icon: <Trophy className="w-5 h-5" />, title: 'Эксклюзивные достижения', desc: 'Особые награды для Premium' },
                        { icon: <Gift className="w-5 h-5" />, title: 'Бонусные очки', desc: 'Двойные очки за каждое действие' }
                      ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full gradient-pink flex items-center justify-center text-white">
                            {feature.icon}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{feature.title}</p>
                            <p className="text-xs text-muted-foreground">{feature.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-pink/10">
                  <CardHeader>
                    <CardTitle>Выберите план</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button className="w-full gradient-pink text-white border-0 h-12 justify-between">
                      <div className="text-left">
                        <p className="font-semibold">Месяц</p>
                        <p className="text-xs opacity-80">Гибкий план</p>
                      </div>
                      <span className="text-lg font-bold">299 ₽</span>
                    </Button>
                    <Button className="w-full gradient-lavender text-white border-0 h-12 justify-between">
                      <div className="text-left">
                        <p className="font-semibold">Год</p>
                        <p className="text-xs opacity-80">Выгода 40%</p>
                      </div>
                      <span className="text-lg font-bold">1 999 ₽</span>
                    </Button>
                    <Button variant="outline" className="w-full h-12 justify-between border-pink/30">
                      <div className="text-left">
                        <p className="font-semibold">Навсегда</p>
                        <p className="text-xs text-muted-foreground">Один раз и навсегда</p>
                      </div>
                      <span className="text-lg font-bold">4 999 ₽</span>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </main>

      {/* Add Pin Dialog */}
      <Dialog open={showAddPin} onOpenChange={(open) => {
        setShowAddPin(open)
        if (!open) {
          setNewPinUrl('')
          setNewPinTitle('')
          setExtractedData(null)
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Добавить пин</DialogTitle>
            <DialogDescription>
              Вставьте ссылку из Pinterest или прямую ссылку на изображение
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Ссылка на пин Pinterest</label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="https://pinterest.com/pin/..."
                  value={newPinUrl}
                  onChange={(e) => {
                    const value = e.target.value
                    setNewPinUrl(value)
                    setExtractedData(null)
                    // Auto-extract when URL looks like Pinterest
                    if (value.includes('pinterest') || value.includes('pin.')) {
                      setTimeout(() => extractFromUrl(value), 300)
                    }
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && extractFromUrl(newPinUrl)}
                />
                <Button 
                  onClick={() => extractFromUrl(newPinUrl)}
                  disabled={!newPinUrl || isExtracting}
                  size="icon"
                  className="gradient-pink text-white border-0 shrink-0"
                  title="Извлечь"
                >
                  {isExtracting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Вставьте ссылку — картинка загрузится автоматически
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Название (опционально)</label>
              <Input
                placeholder="Название пина"
                value={newPinTitle}
                onChange={(e) => setNewPinTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            {(extractedData?.imageUrl || newPinUrl) && (
              <div className="aspect-square rounded-lg overflow-hidden bg-muted relative">
                {isExtracting ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <img 
                    src={extractedData?.imageUrl || newPinUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999">Ошибка загрузки</text></svg>'
                    }}
                  />
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddPin(false)
              setNewPinUrl('')
              setNewPinTitle('')
              setExtractedData(null)
            }}>
              Отмена
            </Button>
            <Button
              onClick={handleAddPin}
              disabled={(!extractedData?.imageUrl && !newPinUrl) || isCategorizing}
              className="gradient-pink text-white border-0"
            >
              {isCategorizing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Анализ...
                </>
              ) : (
                'Добавить'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Новая задача</DialogTitle>
            <DialogDescription>
              Создайте задачу из вашего вдохновения
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Название</label>
              <Input
                placeholder="Что нужно сделать?"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Описание</label>
              <Textarea
                placeholder="Добавьте детали..."
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Дата
                </label>
                <Input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Bell className="w-4 h-4" />
                  Напомнить
                </label>
                <Input
                  type="time"
                  value={newTaskReminderTime}
                  onChange={(e) => setNewTaskReminderTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Приоритет</label>
              <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Низкий</SelectItem>
                  <SelectItem value="medium">Средний</SelectItem>
                  <SelectItem value="high">Высокий</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTask(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleAddTask}
              disabled={!newTaskTitle || isAddingTask}
              className="gradient-lavender text-white border-0"
            >
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pin Detail Dialog */}
      <Dialog open={!!selectedPin} onOpenChange={() => setSelectedPin(null)}>
        <DialogContent className="max-w-sm">
          {selectedPin && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPin.title || 'Пин'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="aspect-square rounded-lg overflow-hidden">
                  <img
                    src={selectedPin.imageUrl}
                    alt={selectedPin.title || 'Pin'}
                    className="w-full h-full object-cover"
                  />
                </div>
                {selectedPin.description && (
                  <p className="text-sm text-muted-foreground">{selectedPin.description}</p>
                )}
                <div className="flex items-center gap-2">
                  {selectedPin.category && (
                    <Badge variant="secondary">
                      {categoryIcons[selectedPin.category]}
                      <span className="ml-1">{categories.find(c => c.id === selectedPin.category)?.name}</span>
                    </Badge>
                  )}
                  <Badge className="bg-lavender/20">
                    <Zap className="w-3 h-3 mr-1" />
                    {selectedPin.points}
                  </Badge>
                </div>
              </div>
              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    handleDeletePin(selectedPin.id)
                    setSelectedPin(null)
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Удалить
                </Button>
                <Button
                  className="flex-1 gradient-pink text-white border-0"
                  onClick={() => {
                    setNewTaskTitle(selectedPin.title || '')
                    setNewTaskDescription(selectedPin.description || '')
                    setSelectedPin(null)
                    setShowAddTask(true)
                  }}
                >
                  <ListTodo className="w-4 h-4 mr-2" />
                  В задачу
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Board Dialog */}
      <Dialog open={showAddBoard} onOpenChange={(open) => {
        setShowAddBoard(open)
        if (!open) {
          setNewBoardUrl('')
          setScrapedBoardData(null)
        }
      }}>
        <DialogContent className="sm:max-w-[400px] max-w-[calc(100vw-32px)] w-full overflow-hidden">
          <DialogHeader>
            <DialogTitle>Добавить доску Pinterest</DialogTitle>
            <DialogDescription>
              Вставьте ссылку на доску Pinterest для синхронизации пинов
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 w-full overflow-hidden">
            <div className="w-full">
              <label className="text-sm font-medium">Ссылка на доску</label>
              <div className="flex gap-2 mt-1 w-full overflow-hidden">
                <Input
                  placeholder="pinterest.com/username/board"
                  value={newBoardUrl}
                  onChange={(e) => setNewBoardUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && scrapeBoard(newBoardUrl)}
                  className="flex-1 min-w-0 w-full overflow-hidden"
                />
                <Button 
                  onClick={() => scrapeBoard(newBoardUrl)}
                  disabled={!newBoardUrl || isScrapingBoard}
                  size="icon"
                  className="bg-blue-500 hover:bg-blue-600 text-white border-0 shrink-0"
                >
                  {isScrapingBoard ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Формат: pinterest.com/username/board-name
              </p>
            </div>

            {scrapedBoardData && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg w-full overflow-hidden">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-blue-500 shrink-0" />
                  <p className="font-medium text-sm truncate">{scrapedBoardData.boardName || 'Доска'}</p>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  Найдено пинов: <span className="font-semibold text-blue-500">{scrapedBoardData.pins.length}</span>
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 break-words">
                  ⚠️ Pinterest показывает только ~15 пинов при первой загрузке. Для синхронизации всех пинов повторяйте синхронизацию несколько раз.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => {
              setShowAddBoard(false)
              setNewBoardUrl('')
              setScrapedBoardData(null)
            }} className="w-full sm:w-auto">
              Отмена
            </Button>
            <Button
              onClick={syncBoard}
              disabled={!scrapedBoardData || isSyncingBoard === 'new'}
              className="bg-blue-500 hover:bg-blue-600 text-white border-0 w-full sm:w-auto"
            >
              {isSyncingBoard === 'new' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Синхронизация...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Синхронизировать
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
