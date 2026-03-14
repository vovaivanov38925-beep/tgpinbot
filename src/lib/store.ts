import { create } from 'zustand'

export interface User {
  id: string
  telegramId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  photoUrl: string | null
  points: number
  level: number
  isPremium: boolean
  premiumExpiry: string | null
  createdAt: string
  updatedAt: string
  achievements: UserAchievement[]
  _count: {
    pins: number
    tasks: number
  }
}

export interface UserAchievement {
  id: string
  userId: string
  achievementId: string
  unlockedAt: string
  achievement: Achievement
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: string
  requirement: number
  points: number
  unlocked?: boolean
  unlockedAt?: string | null
}

export interface Pin {
  id: string
  userId: string
  imageUrl: string
  title: string | null
  description: string | null
  category: string | null
  sourceUrl: string | null
  boardUrl: string | null
  isCompleted: boolean
  points: number
  createdAt: string
  updatedAt: string
  tasks: Task[]
}

export interface Task {
  id: string
  userId: string
  pinId: string | null
  title: string
  description: string | null
  imageUrl: string | null
  category: string | null
  priority: string
  status: string
  dueDate: string | null
  reminderTime: string | null
  reminderSent: boolean
  points: number
  createdAt: string
  updatedAt: string
  pin?: Pin | null
}

export interface Category {
  id: string
  name: string
  icon: string
}

interface AppState {
  user: User | null
  pins: Pin[]
  tasks: Task[]
  achievements: Achievement[]
  categories: Category[]
  isLoading: boolean
  activeTab: string
  
  setUser: (user: User | null) => void
  setPins: (pins: Pin[]) => void
  addPin: (pin: Pin) => void
  updatePin: (pin: Pin) => void
  removePin: (id: string) => void
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (task: Task) => void
  removeTask: (id: string) => void
  setAchievements: (achievements: Achievement[]) => void
  setCategories: (categories: Category[]) => void
  setLoading: (loading: boolean) => void
  setActiveTab: (tab: string) => void
}

export const useStore = create<AppState>((set) => ({
  user: null,
  pins: [],
  tasks: [],
  achievements: [],
  categories: [],
  isLoading: true,
  activeTab: 'pins',
  
  setUser: (user) => set({ user }),
  setPins: (pins) => set({ pins }),
  addPin: (pin) => set((state) => ({ pins: [pin, ...state.pins] })),
  updatePin: (pin) => set((state) => ({
    pins: state.pins.map((p) => p.id === pin.id ? pin : p)
  })),
  removePin: (id) => set((state) => ({
    pins: state.pins.filter((p) => p.id !== id)
  })),
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (task) => set((state) => ({
    tasks: state.tasks.map((t) => t.id === task.id ? task : t)
  })),
  removeTask: (id) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== id)
  })),
  setAchievements: (achievements) => set({ achievements }),
  setCategories: (categories) => set({ categories }),
  setLoading: (isLoading) => set({ isLoading }),
  setActiveTab: (activeTab) => set({ activeTab })
}))
