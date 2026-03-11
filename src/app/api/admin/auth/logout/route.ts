import { NextResponse } from 'next/server'
import { clearAuthCookie, getCurrentAdmin, logAdminAction } from '@/lib/admin-auth'

export async function POST() {
  try {
    const admin = await getCurrentAdmin()
    
    if (admin) {
      await logAdminAction(admin.id, 'logout')
    }
    
    await clearAuthCookie()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ success: true })
  }
}
