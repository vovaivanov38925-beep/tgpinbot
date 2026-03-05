import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const achievements = [
  // Pins achievements
  { name: 'Первый шаг', description: 'Сохраните свой первый пин', icon: 'Pin', category: 'pins', requirement: 1, points: 10 },
  { name: 'Коллекционер', description: 'Сохраните 10 пинов', icon: 'Folder', category: 'pins', requirement: 10, points: 50 },
  { name: 'Архивариус', description: 'Сохраните 50 пинов', icon: 'Archive', category: 'pins', requirement: 50, points: 150 },
  { name: 'Сокровищница', description: 'Сохраните 100 пинов', icon: 'Gem', category: 'pins', requirement: 100, points: 300 },

  // Tasks achievements
  { name: 'Начинающий', description: 'Выполните первую задачу', icon: 'CheckCircle', category: 'tasks', requirement: 1, points: 15 },
  { name: 'Деятельный', description: 'Выполните 10 задач', icon: 'ListTodo', category: 'tasks', requirement: 10, points: 75 },
  { name: 'Ракета', description: 'Выполните 50 задач', icon: 'Rocket', category: 'tasks', requirement: 50, points: 200 },

  // Social/Level achievements
  { name: 'Новичок', description: 'Достигните 2 уровня', icon: 'Crown', category: 'social', requirement: 2, points: 25 },
  { name: 'Уровень 5', description: 'Достигните 5 уровня', icon: 'Star', category: 'social', requirement: 5, points: 100 },
  { name: 'Уровень 10', description: 'Достигните 10 уровня', icon: 'Sparkles', category: 'social', requirement: 10, points: 250 },
  { name: 'Мастер', description: 'Достигните 20 уровня', icon: 'Award', category: 'social', requirement: 20, points: 500 },

  // Premium achievements
  { name: 'Премиум пользователь', description: 'Оформите премиум подписку', icon: 'Diamond', category: 'premium', requirement: 1, points: 100 },
]

async function main() {
  console.log('Seeding achievements...')

  for (const achievement of achievements) {
    const existing = await prisma.achievement.findFirst({
      where: { name: achievement.name }
    })

    if (!existing) {
      await prisma.achievement.create({
        data: achievement
      })
      console.log(`Created achievement: ${achievement.name}`)
    } else {
      console.log(`Achievement already exists: ${achievement.name}`)
    }
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
