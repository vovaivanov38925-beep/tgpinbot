import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Enable pgcrypto extension for gen_random_uuid()
    await db.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`)

    // Create tables using raw SQL with snake_case columns
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        telegram_id TEXT UNIQUE NOT NULL,
        telegram_chat_id TEXT UNIQUE,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        photo_url TEXT,
        points INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        is_premium BOOLEAN DEFAULT false,
        premium_expiry TIMESTAMP,
        bot_state TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pins (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        title TEXT,
        description TEXT,
        category TEXT,
        source_url TEXT,
        board_url TEXT,
        is_completed BOOLEAN DEFAULT false,
        points INTEGER DEFAULT 10,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pin_id TEXT REFERENCES pins(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        category TEXT,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'pending',
        due_date TIMESTAMP,
        reminder_time TIMESTAMP,
        reminder_sent BOOLEAN DEFAULT false,
        points INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL,
        category TEXT NOT NULL,
        requirement INTEGER NOT NULL,
        points INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_achievements (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
        unlocked_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, achievement_id)
      );

      CREATE TABLE IF NOT EXISTS notification_settings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_reminders BOOLEAN DEFAULT true,
        new_pins BOOLEAN DEFAULT true,
        achievements BOOLEAN DEFAULT true,
        level_up BOOLEAN DEFAULT true,
        task_completed BOOLEAN DEFAULT true,
        reminder_day_before BOOLEAN DEFAULT false,
        reminder_hour_before BOOLEAN DEFAULT false,
        reminder_15_min_before BOOLEAN DEFAULT false,
        quiet_hours_start INTEGER DEFAULT 22,
        quiet_hours_end INTEGER DEFAULT 8,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT UNIQUE,
        role TEXT DEFAULT 'admin',
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payment_settings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        stars_enabled BOOLEAN DEFAULT false,
        stars_month_price INTEGER DEFAULT 299,
        stars_year_price INTEGER DEFAULT 1999,
        stars_lifetime_price INTEGER DEFAULT 4999,
        yookassa_enabled BOOLEAN DEFAULT false,
        yookassa_shop_id TEXT,
        yookassa_secret_key TEXT,
        yookassa_month_price INTEGER DEFAULT 299,
        yookassa_year_price INTEGER DEFAULT 1999,
        yookassa_lifetime_price INTEGER DEFAULT 4999,
        currency TEXT DEFAULT 'RUB',
        trial_days INTEGER DEFAULT 7,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payment_transactions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT DEFAULT 'RUB',
        status TEXT DEFAULT 'pending',
        provider TEXT NOT NULL,
        provider_tx_id TEXT UNIQUE,
        plan_type TEXT NOT NULL,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bot_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        level TEXT NOT NULL,
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        user_id TEXT,
        telegram_id TEXT,
        request_id TEXT,
        duration INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bot_messages (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        telegram_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(chat_id, message_id)
      );

      CREATE TABLE IF NOT EXISTS pinterest_boards (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        board_url TEXT NOT NULL,
        board_name TEXT,
        board_username TEXT,
        last_sync_at TIMESTAMP,
        total_pins INTEGER DEFAULT 0,
        new_pins INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        auto_sync BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, board_url)
      );

      CREATE TABLE IF NOT EXISTS ads (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        link_url TEXT,
        button_text TEXT,
        target_all BOOLEAN DEFAULT true,
        target_premium BOOLEAN DEFAULT false,
        target_free BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'draft',
        scheduled_at TIMESTAMP,
        sent_count INTEGER DEFAULT 0,
        click_count INTEGER DEFAULT 0,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS broadcasts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        target_all BOOLEAN DEFAULT true,
        target_premium BOOLEAN DEFAULT false,
        target_free BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'draft',
        scheduled_at TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        total_recipients INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS broadcast_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        broadcast_id TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        telegram_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        error TEXT,
        sent_at TIMESTAMP,
        UNIQUE(broadcast_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        telegram_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        subject TEXT,
        category TEXT DEFAULT 'general',
        priority TEXT DEFAULT 'normal',
        status TEXT DEFAULT 'open',
        first_message TEXT NOT NULL,
        last_message TEXT,
        last_message_at TIMESTAMP,
        last_message_from TEXT,
        assigned_to TEXT,
        assigned_at TIMESTAMP,
        resolved_at TIMESTAMP,
        closed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS support_messages (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        sender_type TEXT NOT NULL,
        sender_id TEXT,
        sender_name TEXT,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        attachments TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS scraper_tasks (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        board_url TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        total_pins INTEGER DEFAULT 0,
        imported_pins INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        provider TEXT NOT NULL,
        transaction_id TEXT UNIQUE,
        amount INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'RUB',
        started_at TIMESTAMP,
        expires_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        cancelled_reason TEXT,
        metadata TEXT,
        granted_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_entity_type ON admin_logs(entity_type);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_bot_logs_level ON bot_logs(level);
      CREATE INDEX IF NOT EXISTS idx_bot_logs_source ON bot_logs(source);
      CREATE INDEX IF NOT EXISTS idx_bot_logs_created_at ON bot_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_bot_logs_telegram_id ON bot_logs(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_bot_messages_telegram_id ON bot_messages(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_bot_messages_chat_id ON bot_messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_pinterest_boards_user_id ON pinterest_boards(user_id);
      CREATE INDEX IF NOT EXISTS idx_pinterest_boards_board_url ON pinterest_boards(board_url);
      CREATE INDEX IF NOT EXISTS idx_pins_board_url ON pins(board_url);
      CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);
      CREATE INDEX IF NOT EXISTS idx_ads_scheduled_at ON ads(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
      CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled_at ON broadcasts(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_broadcast_logs_broadcast_id ON broadcast_logs(broadcast_id);
      CREATE INDEX IF NOT EXISTS idx_broadcast_logs_status ON broadcast_logs(status);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);
      CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_scraper_tasks_status ON scraper_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_scraper_tasks_created_at ON scraper_tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(provider);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_started_at ON subscriptions(started_at);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at);
    `)

    return NextResponse.json({
      success: true,
      message: 'Database tables created successfully with snake_case columns'
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
