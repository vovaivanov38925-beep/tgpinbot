import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Enable pgcrypto extension for gen_random_uuid()
    await db.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`)

    // Create tables using raw SQL with camelCase columns (quoted)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "telegramId" TEXT UNIQUE NOT NULL,
        "telegramChatId" TEXT UNIQUE,
        username TEXT,
        "firstName" TEXT,
        "lastName" TEXT,
        "photoUrl" TEXT,
        points INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        "isPremium" BOOLEAN DEFAULT false,
        "premiumExpiry" TIMESTAMP,
        "botState" TEXT,
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
        "boardUrl" TEXT,
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
        "imageUrl" TEXT,
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

      CREATE TABLE IF NOT EXISTS notification_settings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "taskReminders" BOOLEAN DEFAULT true,
        "newPins" BOOLEAN DEFAULT true,
        achievements BOOLEAN DEFAULT true,
        "levelUp" BOOLEAN DEFAULT true,
        "taskCompleted" BOOLEAN DEFAULT true,
        "reminderDayBefore" BOOLEAN DEFAULT false,
        "reminderHourBefore" BOOLEAN DEFAULT false,
        "reminder15MinBefore" BOOLEAN DEFAULT false,
        "quietHoursStart" INTEGER DEFAULT 22,
        "quietHoursEnd" INTEGER DEFAULT 8,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
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

      CREATE TABLE IF NOT EXISTS bot_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        level TEXT NOT NULL,
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        "userId" TEXT,
        "telegramId" TEXT,
        "requestId" TEXT,
        duration INTEGER,
        "createdAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bot_messages (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "telegramId" TEXT NOT NULL,
        "chatId" TEXT NOT NULL,
        "messageId" INTEGER NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("chatId", "messageId")
      );

      CREATE TABLE IF NOT EXISTS pinterest_boards (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "boardUrl" TEXT NOT NULL,
        "boardName" TEXT,
        "boardUsername" TEXT,
        "lastSyncAt" TIMESTAMP,
        "totalPins" INTEGER DEFAULT 0,
        "newPins" INTEGER DEFAULT 0,
        "isActive" BOOLEAN DEFAULT true,
        "autoSync" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("userId", "boardUrl")
      );

      CREATE TABLE IF NOT EXISTS ads (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        "imageUrl" TEXT,
        "linkUrl" TEXT,
        "buttonText" TEXT,
        "targetAll" BOOLEAN DEFAULT true,
        "targetPremium" BOOLEAN DEFAULT false,
        "targetFree" BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'draft',
        "scheduledAt" TIMESTAMP,
        "sentCount" INTEGER DEFAULT 0,
        "clickCount" INTEGER DEFAULT 0,
        "createdBy" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS broadcasts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        "imageUrl" TEXT,
        "targetAll" BOOLEAN DEFAULT true,
        "targetPremium" BOOLEAN DEFAULT false,
        "targetFree" BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'draft',
        "scheduledAt" TIMESTAMP,
        "startedAt" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "totalRecipients" INTEGER DEFAULT 0,
        "sentCount" INTEGER DEFAULT 0,
        "failedCount" INTEGER DEFAULT 0,
        "createdBy" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS broadcast_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "broadcastId" TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
        "userId" TEXT NOT NULL,
        "telegramId" TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        error TEXT,
        "sentAt" TIMESTAMP,
        UNIQUE("broadcastId", "userId")
      );

      CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "telegramId" TEXT NOT NULL,
        "chatId" TEXT NOT NULL,
        subject TEXT,
        category TEXT DEFAULT 'general',
        priority TEXT DEFAULT 'normal',
        status TEXT DEFAULT 'open',
        "firstMessage" TEXT NOT NULL,
        "lastMessage" TEXT,
        "lastMessageAt" TIMESTAMP,
        "lastMessageFrom" TEXT,
        "assignedTo" TEXT,
        "assignedAt" TIMESTAMP,
        "resolvedAt" TIMESTAMP,
        "closedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS support_messages (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "ticketId" TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        "senderType" TEXT NOT NULL,
        "senderId" TEXT,
        "senderName" TEXT,
        message TEXT NOT NULL,
        "isRead" BOOLEAN DEFAULT false,
        "readAt" TIMESTAMP,
        attachments TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS scraper_tasks (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "boardUrl" TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        "totalPins" INTEGER DEFAULT 0,
        "importedPins" INTEGER DEFAULT 0,
        "errorMessage" TEXT,
        "startedAt" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        provider TEXT NOT NULL,
        "transactionId" TEXT UNIQUE,
        amount INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'RUB',
        "startedAt" TIMESTAMP,
        "expiresAt" TIMESTAMP,
        "cancelledAt" TIMESTAMP,
        "cancelledReason" TEXT,
        metadata TEXT,
        "grantedBy" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_entity_type ON admin_logs("entityType");
      CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs("createdAt");
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions("userId");
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions("createdAt");
      CREATE INDEX IF NOT EXISTS idx_bot_logs_level ON bot_logs(level);
      CREATE INDEX IF NOT EXISTS idx_bot_logs_source ON bot_logs(source);
      CREATE INDEX IF NOT EXISTS idx_bot_logs_created_at ON bot_logs("createdAt");
      CREATE INDEX IF NOT EXISTS idx_bot_logs_telegram_id ON bot_logs("telegramId");
      CREATE INDEX IF NOT EXISTS idx_bot_messages_telegram_id ON bot_messages("telegramId");
      CREATE INDEX IF NOT EXISTS idx_bot_messages_chat_id ON bot_messages("chatId");
      CREATE INDEX IF NOT EXISTS idx_pinterest_boards_user_id ON pinterest_boards("userId");
      CREATE INDEX IF NOT EXISTS idx_pinterest_boards_board_url ON pinterest_boards("boardUrl");
      CREATE INDEX IF NOT EXISTS idx_pins_board_url ON pins("boardUrl");
      CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);
      CREATE INDEX IF NOT EXISTS idx_ads_scheduled_at ON ads("scheduledAt");
      CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
      CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled_at ON broadcasts("scheduledAt");
      CREATE INDEX IF NOT EXISTS idx_broadcast_logs_broadcast_id ON broadcast_logs("broadcastId");
      CREATE INDEX IF NOT EXISTS idx_broadcast_logs_status ON broadcast_logs(status);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets("createdAt");
      CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages("ticketId");
      CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages("createdAt");
      CREATE INDEX IF NOT EXISTS idx_scraper_tasks_status ON scraper_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_scraper_tasks_created_at ON scraper_tasks("createdAt");
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions("userId");
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(provider);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_started_at ON subscriptions("startedAt");
      CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions("expiresAt");
      CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions("createdAt");
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
