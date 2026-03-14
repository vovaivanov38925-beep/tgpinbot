import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.pin.deleteMany()
  console.log(`Deleted ${result.count} pins`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
