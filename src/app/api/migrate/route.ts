import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Create tables using raw SQL
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "telegramId" TEXT UNIQUE NOT NULL,
        username TEXT,
        "firstName" TEXT,
        "lastName" TEXT,
        "photoUrl" TEXT,
        points INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        "isPremium" BOOLEAN DEFAULT false,
        "premiumExpiry" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pins (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "imageUrl" TEXT NOT NULL,
        title TEXT,
        description TEXT,
        category TEXT,
        "sourceUrl" TEXT,
        "isCompleted" BOOLEAN DEFAULT false,
        points INTEGER DEFAULT 10,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "pinId" TEXT REFERENCES pins(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'pending',
        "dueDate" TIMESTAMP,
        "reminderTime" TIMESTAMP,
        "reminderSent" BOOLEAN DEFAULT false,
        points INTEGER DEFAULT 5,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL,
        category TEXT NOT NULL,
        requirement INTEGER NOT NULL,
        points INTEGER NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_achievements (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "achievementId" TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
        "unlockedAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("userId", "achievementId")
      );

      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        "passwordHash" TEXT NOT NULL,
        email TEXT UNIQUE,
        role TEXT DEFAULT 'admin',
        "isActive" BOOLEAN DEFAULT true,
        "lastLoginAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "adminId" TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        "entityType" TEXT,
        "entityId" TEXT,
        details TEXT,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payment_settings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "starsEnabled" BOOLEAN DEFAULT false,
        "starsMonthPrice" INTEGER DEFAULT 299,
        "starsYearPrice" INTEGER DEFAULT 1999,
        "starsLifetimePrice" INTEGER DEFAULT 4999,
        "yookassaEnabled" BOOLEAN DEFAULT false,
        "yookassaShopId" TEXT,
        "yookassaSecretKey" TEXT,
        "yookassaMonthPrice" INTEGER DEFAULT 299,
        "yookassaYearPrice" INTEGER DEFAULT 1999,
        "yookassaLifetimePrice" INTEGER DEFAULT 4999,
        currency TEXT DEFAULT 'RUB',
        "trialDays" INTEGER DEFAULT 7,
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payment_transactions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT DEFAULT 'RUB',
        status TEXT DEFAULT 'pending',
        provider TEXT NOT NULL,
        "providerTxId" TEXT UNIQUE,
        "planType" TEXT NOT NULL,
        metadata TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_entityType ON admin_logs("entityType");
      CREATE INDEX IF NOT EXISTS idx_admin_logs_createdAt ON admin_logs("createdAt");
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_userId ON payment_transactions("userId");
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_createdAt ON payment_transactions("createdAt");
    `)

    return NextResponse.json({
      success: true,
      message: 'Database tables created successfully'
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
