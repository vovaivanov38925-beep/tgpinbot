import { cookies } from 'next/headers'
import { prisma } from './db'
import crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
const TOKEN_NAME = 'admin_token'

export interface AdminSession {
  id: string
  username: string
  role: string
}

// Hash password with salt
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

// Verify password
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return hash === verifyHash
}

// Generate JWT token
export function generateToken(payload: AdminSession): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const tokenPayload = Buffer.from(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + 24 * 60 * 60 // 24 hours
  })).toString('base64url')
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${tokenPayload}`)
    .digest('base64url')
  
  return `${header}.${tokenPayload}.${signature}`
}

// Verify JWT token
export function verifyToken(token: string): AdminSession | null {
  try {
    const [header, payload, signature] = token.split('.')
    if (!header || !payload || !signature) return null
    
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url')
    
    if (signature !== expectedSignature) return null
    
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString())
    
    // Check expiration
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    
    return {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    }
  } catch {
    return null
  }
}

// Set auth cookie
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/'
  })
}

// Clear auth cookie
export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(TOKEN_NAME)
}

// Get current admin from cookie
export async function getCurrentAdmin(): Promise<AdminSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(TOKEN_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

// Log admin action
export async function logAdminAction(
  adminId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        entityType,
        entityId,
        details: details ? JSON.stringify(details) : null,
        ipAddress,
        userAgent
      }
    })
  } catch (error) {
    console.error('Failed to log admin action:', error)
  }
}

// Create default admin if not exists
export async function ensureDefaultAdmin() {
  const existingAdmin = await prisma.admin.findFirst()
  if (!existingAdmin) {
    await prisma.admin.create({
      data: {
        username: 'admin',
        passwordHash: hashPassword('admin123'),
        role: 'superadmin',
        email: 'admin@example.com'
      }
    })
    console.log('Created default admin: admin / admin123')
  }
}
