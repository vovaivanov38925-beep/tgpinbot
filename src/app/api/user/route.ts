import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Get user by telegramId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramId = searchParams.get('telegramId')

    if (!telegramId) {
      return NextResponse.json({ error: 'Telegram ID is required' }, { status: 400 })
    }

    let user = await db.user.findUnique({
      where: { telegramId },
      include: {
        achievements: {
          include: {
            achievement: true
          }
        },
        _count: {
          select: {
            pins: true,
            tasks: true
          }
        }
      }
    })

    if (!user) {
      user = await db.user.create({
        data: {
          telegramId,
          points: 0,
          level: 1,
          isPremium: false
        },
        include: {
          achievements: {
            include: {
              achievement: true
            }
          },
          _count: {
            select: {
              pins: true,
              tasks: true
            }
          }
        }
      })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// POST - Create or update user with Telegram data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telegramId, firstName, lastName, username, photoUrl } = body

    if (!telegramId) {
      return NextResponse.json({ error: 'Telegram ID is required' }, { status: 400 })
    }

    // Upsert user - create if not exists, update if exists
    const user = await db.user.upsert({
      where: { telegramId },
      create: {
        telegramId,
        firstName: firstName || null,
        lastName: lastName || null,
        username: username || null,
        photoUrl: photoUrl || null,
        points: 0,
        level: 1,
        isPremium: false
      },
      update: {
        firstName: firstName || null,
        lastName: lastName || null,
        username: username || null,
        photoUrl: photoUrl || null
      },
      include: {
        achievements: {
          include: {
            achievement: true
          }
        },
        _count: {
          select: {
            pins: true,
            tasks: true
          }
        }
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error creating/updating user:', error)
    return NextResponse.json({ error: 'Failed to create/update user' }, { status: 500 })
  }
}

// PATCH - Update user data
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { telegramId, ...updateData } = body

    if (!telegramId) {
      return NextResponse.json({ error: 'Telegram ID is required' }, { status: 400 })
    }

    const user = await db.user.update({
      where: { telegramId },
      data: updateData,
      include: {
        achievements: {
          include: {
            achievement: true
          }
        }
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
