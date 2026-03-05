'use client'

import { useEffect, useState } from 'react'
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
  Gift
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
  { id: '5', name: 'Уровень 5', description: 'Достигните 5 уровня', icon: 'Star', category: 'social', requirement: 5, points: 100, unlocked: false },
  { id: '6', name: 'Премиум пользователь', description: 'Оформите премиум подписку', icon: 'Diamond', category: 'premium', requirement: 1, points: 100, unlocked: false }
]

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
  const [levelProgress, setLevelProgress] = useState(0)

  // Initialize data
  useEffect(() => {
    const initApp = async () => {
      try {
        // Get or create user
        const telegramId = 'demo_user_' + Date.now()
        const userRes = await fetch(`/api/user?telegramId=${telegramId}`)
        const userData = await userRes.json()
        setUser(userData)

        // Get categories
        const catRes = await fetch('/api/ai/categorize')
        const catData = await catRes.json()
        setCategories(catData)

        // Get achievements
        const achRes = await fetch(`/api/achievements?userId=${userData.id}`)
        const achData = await achRes.json()
        setAchievements(achData.length > 0 ? achData : sampleAchievements)

        // Get pins
        const pinsRes = await fetch(`/api/pins?userId=${userData.id}`)
        const pinsData = await pinsRes.json()
        setPins(pinsData)

        // Get tasks
        const tasksRes = await fetch(`/api/tasks?userId=${userData.id}`)
        const tasksData = await tasksRes.json()
        setTasks(tasksData)

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

  const handleAddPin = async () => {
    if (!user || !newPinUrl) return

    setIsCategorizing(true)
    try {
      // Categorize pin using AI
      const catRes = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newPinTitle, description: '' })
      })
      const catData = await catRes.json()

      // Create pin
      const res = await fetch('/api/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          imageUrl: newPinUrl,
          title: catData.suggestedTitle || newPinTitle || 'Новый пин',
          description: catData.suggestedDescription || '',
          category: catData.category || 'other'
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
    if (!user || !newTaskTitle) return

    try {
      // Combine date and time for reminder
      let reminderTime = null
      if (newTaskDueDate && newTaskReminderTime) {
        reminderTime = new Date(`${newTaskDueDate}T${newTaskReminderTime}:00`).toISOString()
      } else if (newTaskDueDate) {
        reminderTime = new Date(`${newTaskDueDate}T12:00:00`).toISOString()
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: newTaskTitle,
          description: newTaskDescription,
          priority: newTaskPriority,
          dueDate: newTaskDueDate ? new Date(newTaskDueDate).toISOString() : null,
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

  return (
    <div className="min-h-screen gradient-pink pb-6">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-pink/20">
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
                  {user?.firstName || 'Пользователь'}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500" />
                  Уровень {user?.level || 1}
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
      <main className="max-w-lg mx-auto px-4 pt-4">
        <Tabs defaultValue="pins" className="w-full">
          <TabsList className="grid grid-cols-4 w-full bg-white/50 border border-pink/10">
            <TabsTrigger value="pins" className="data-[state=active]:gradient-pink data-[state=active]:text-white">
              <PinIcon className="w-4 h-4 mr-1" />
              Пины
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:gradient-lavender data-[state=active]:text-white">
              <ListTodo className="w-4 h-4 mr-1" />
              Задачи
            </TabsTrigger>
            <TabsTrigger value="progress" className="data-[state=active]:gradient-peach data-[state=active]:text-white">
              <Trophy className="w-4 h-4 mr-1" />
              Прогресс
            </TabsTrigger>
            <TabsTrigger value="premium" className="data-[state=active]:gradient-full data-[state=active]:text-white">
              <Diamond className="w-4 h-4 mr-1" />
              Премиум
            </TabsTrigger>
          </TabsList>

          {/* Pins Tab */}
          <TabsContent value="pins" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Мои пины</h2>
              <Button
                onClick={() => setShowAddPin(true)}
                size="sm"
                className="gradient-pink text-white border-0 shadow-soft"
              >
                <Plus className="w-4 h-4 mr-1" />
                Добавить
              </Button>
            </div>

            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="grid grid-cols-2 gap-3 pr-2">
                {pins.length === 0 ? (
                  <div className="col-span-2 text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-lavender flex items-center justify-center">
                      <PinIcon className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-muted-foreground mb-4">Пока нет сохранённых идей</p>
                    <p className="text-sm text-muted-foreground/70">
                      Нажмите "Добавить" чтобы сохранить первую идею из Pinterest
                    </p>
                  </div>
                ) : (
                  pins.map((pin, index) => (
                  <Card
                    key={pin.id || `pin-${index}`}
                    className="overflow-hidden cursor-pointer hover:shadow-pink transition-all duration-300 border-pink/10"
                    onClick={() => setSelectedPin(pin)}
                  >
                    <div className="aspect-square relative">
                      <img
                        src={pin.imageUrl}
                        alt={pin.title || 'Pin'}
                        className="w-full h-full object-cover"
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
                    <CardContent className="p-3">
                      <p className="font-medium text-sm truncate">{pin.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{pin.description}</p>
                    </CardContent>
                  </Card>
                )))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-4">
            <div className="flex items-center justify-between mb-4">
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

            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-3 pr-2">
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
                                    {new Date(task.reminderTime).toLocaleDateString('ru-RU', { 
                                      day: 'numeric', 
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
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
          <TabsContent value="progress" className="mt-4">
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-4 pr-2">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="gradient-pink border-0">
                    <CardContent className="p-4 text-center">
                      <PinIcon className="w-8 h-8 mx-auto mb-2 text-white/80" />
                      <p className="text-2xl font-bold text-white">{pins.length}</p>
                      <p className="text-sm text-white/80">Пинов</p>
                    </CardContent>
                  </Card>
                  <Card className="gradient-lavender border-0">
                    <CardContent className="p-4 text-center">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-white/80" />
                      <p className="text-2xl font-bold text-white">
                        {tasks.filter(t => t.status === 'completed').length}
                      </p>
                      <p className="text-sm text-white/80">Выполнено</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Achievements */}
                <Card className="border-pink/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-primary" />
                      Достижения
                    </CardTitle>
                    <CardDescription>
                      Разблокировано: {achievements.filter(a => a.unlocked).length} из {achievements.length}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {achievements.map((achievement, index) => (
                        <div
                          key={achievement.id || `achievement-${index}`}
                          className={`flex items-center gap-3 p-3 rounded-lg ${
                            achievement.unlocked
                              ? 'bg-primary/10 border border-primary/20'
                              : 'bg-muted/50 opacity-60'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            achievement.unlocked ? 'gradient-pink' : 'bg-muted'
                          }`}>
                            {achievementIcons[achievement.icon] || <Medal className="w-5 h-5" />}
                            {!achievement.unlocked && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-bold text-muted-foreground">🔒</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{achievement.name}</p>
                            <p className="text-xs text-muted-foreground">{achievement.description}</p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            +{achievement.points}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Level progress */}
                <Card className="border-pink/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-500" />
                      Уровень {user?.level || 1}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Progress value={levelProgress} className="h-3 bg-pink/20" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{user?.points || 0} очков</span>
                        <span>До уровня {(user?.level || 1) + 1}: {((user?.level || 1) + 1) * 100} очков</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Premium Tab */}
          <TabsContent value="premium" className="mt-4">
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-4 pr-2">
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
      <Dialog open={showAddPin} onOpenChange={setShowAddPin}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Добавить пин</DialogTitle>
            <DialogDescription>
              Вставьте ссылку на изображение или загрузите с Pinterest
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">URL изображения</label>
              <Input
                placeholder="https://..."
                value={newPinUrl}
                onChange={(e) => setNewPinUrl(e.target.value)}
                className="mt-1"
              />
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
            {newPinUrl && (
              <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                <img src={newPinUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPin(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleAddPin}
              disabled={!newPinUrl || isCategorizing}
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
              disabled={!newTaskTitle}
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
    </div>
  )
}
