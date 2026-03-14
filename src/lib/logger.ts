import { db } from './db'

export type LogLevel = 'info' | 'warning' | 'error' | 'debug'
export type LogSource = 'telegram' | 'api' | 'database' | 'scheduler' | 'payment' | 'extract' | 'ai' | 'admin' | 'pinterest' | 'gamification'

interface LogOptions {
  level: LogLevel
  source: LogSource
  message: string
  details?: Record<string, unknown>
  userId?: string
  telegramId?: string
  requestId?: string
  duration?: number
}

/**
 * Логирование событий бота в базу данных
 */
export async function logToDb(options: LogOptions): Promise<void> {
  try {
    await db.botLog.create({
      data: {
        level: options.level,
        source: options.source,
        message: options.message,
        details: options.details ? JSON.stringify(options.details) : null,
        userId: options.userId || null,
        telegramId: options.telegramId || null,
        requestId: options.requestId || null,
        duration: options.duration || null,
      }
    })
  } catch (error) {
    // Если не удалось записать в БД, выводим в консоль
    console.error('Failed to write log to database:', error)
    console.log('Original log:', options)
  }
}

/**
 * Быстрые методы для логирования
 */
export const logger = {
  info: (source: LogSource, message: string, details?: Record<string, unknown>, userId?: string) =>
    logToDb({ level: 'info', source, message, details, userId }),

  warning: (source: LogSource, message: string, details?: Record<string, unknown>, userId?: string) =>
    logToDb({ level: 'warning', source, message, details, userId }),

  error: (source: LogSource, message: string, details?: Record<string, unknown>, userId?: string) =>
    logToDb({ level: 'error', source, message, details, userId }),

  debug: (source: LogSource, message: string, details?: Record<string, unknown>, userId?: string) =>
    logToDb({ level: 'debug', source, message, details, userId }),

  // Логирование с замером времени выполнения
  timed: async <T>(
    source: LogSource,
    message: string,
    fn: () => Promise<T>,
    userId?: string
  ): Promise<T> => {
    const start = Date.now()
    try {
      const result = await fn()
      const duration = Date.now() - start
      await logToDb({ level: 'info', source, message, duration, userId })
      return result
    } catch (error) {
      const duration = Date.now() - start
      await logToDb({
        level: 'error',
        source,
        message: `${message} (failed)`,
        details: { error: error instanceof Error ? error.message : String(error) },
        duration,
        userId
      })
      throw error
    }
  }
}

export default logger
