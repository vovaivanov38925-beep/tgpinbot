import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/pinterest/sync/pending - получить доски для синхронизации
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const secret = searchParams.get('secret');
    
    if (secret !== process.env.SCRAPER_SECRET && secret !== 'tgpinbot_scraper_2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Находим доски которые нужно синхронизировать
    // PinterestBoard с lastSyncAt = null означают что они pending
    const pendingBoards = await db.pinterestBoard.findMany({
      where: {
        lastSyncAt: null,
        isActive: true,
      },
      include: {
        user: {
          select: { telegramId: true }
        }
      },
      take: 20,
    });
    
    console.log(`[Sync Pending] Found ${pendingBoards.length} pending boards`);
    
    return NextResponse.json({
      boards: pendingBoards.map(b => ({
        boardUrl: b.boardUrl,
        telegramId: b.user.telegramId,
        boardName: b.boardName,
      }))
    });
    
  } catch (error) {
    console.error('[Sync Pending] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
