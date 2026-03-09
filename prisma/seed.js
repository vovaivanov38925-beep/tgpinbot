const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const prisma = new PrismaClient()

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: hashPassword('admin123'),
      email: 'admin@example.com',
      role: 'superadmin'
    }
  })
  console.log('Admin created: admin / admin123')

  await prisma.paymentSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
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
  })
  console.log('Payment settings created')

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
    await prisma.achievement.create({ data: a })
  }
  console.log('Achievements created:', achievements.length)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
