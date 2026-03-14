import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export async function GET() {
  try {
    // Create admin
    await db.admin.create({
      data: {
        username: 'admin',
        passwordHash: hashPassword('admin123'),
        email: 'admin@example.com',
        role: 'superadmin'
      }
    }).catch(() => {}) // Ignore if exists

    // Create payment settings
    await db.paymentSettings.create({
      data: {
        id: 'default',
        starsEnabled: false,
        starsMonthPrice: 299,
        starsYearPrice: 1999,
        starsLifetimePrice: 4999,
        yookassaEnabled: false,
        yookassaMonthPrice: 299,
        yookassaYearPrice: 1999,
        yookassaLifetimePrice: 4999,
        currency: 'RUB',
        trialDays: 7
      }
    }).catch(() => {}) // Ignore if exists

    // Delete existing achievements to remove duplicates
    await db.userAchievement.deleteMany().catch(() => {})
    await db.achievement.deleteMany().catch(() => {})

    const achievements = [
      { name: 'Первый шаг', description: 'Сохраните свой первый пин', icon: 'Pin', category: 'pins', requirement: 1, points: 10 },
      { name: 'Коллекционер', description: 'Сохраните 10 пинов', icon: 'Folder', category: 'pins', requirement: 10, points: 50 },
      { name: 'Начинающий', description: 'Выполните первую задачу', icon: 'CheckCircle', category: 'tasks', requirement: 1, points: 15 },
      { name: 'Деятельный', description: 'Выполните 10 задач', icon: 'ListTodo', category: 'tasks', requirement: 10, points: 75 },
      { name: 'Опытный', description: 'Наберите 100 очков', icon: 'Star', category: 'social', requirement: 100, points: 50 },
      { name: 'Премиум', description: 'Оформите премиум подписку', icon: 'Diamond', category: 'premium', requirement: 1, points: 100 },
      { name: 'Архивариус', description: 'Сохраните 50 пинов', icon: 'Archive', category: 'pins', requirement: 50, points: 200 },
      { name: 'Мастер', description: 'Сохраните 100 пинов', icon: 'Crown', category: 'pins', requirement: 100, points: 500 }
    ]

    for (const a of achievements) {
      await db.achievement.create({ data: a })
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      achievements: achievements.length
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
