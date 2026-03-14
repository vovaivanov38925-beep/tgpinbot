import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkBoardsSyncLimit } from '@/lib/limits';

// Extract board metadata from Pinterest page
async function getBoardMetadata(boardUrl: string): Promise<{ boardName: string | null; boardUsername: string | null }> {
  try {
    const response = await fetch(boardUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) return { boardName: null, boardUsername: null };

    const html = await response.text();
    
    // Extract username from URL
    const urlParts = boardUrl.split('/').filter(Boolean);
    const usernameFromUrl = urlParts.length >= 2 ? urlParts[urlParts.length - 2] : null;
    
    // Try to extract from __PWS_DATA__
    const pwsMatch = html.match(/<script id="__PWS_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (pwsMatch) {
      try {
        const jsonData = JSON.parse(pwsMatch[1]);
        
        // Find board name - multiple strategies
        function findBoardInfo(obj: any, depth = 0): { name: string | null; username: string | null } | null {
          if (!obj || typeof obj !== 'object' || depth > 80) return null;
          
          // Strategy 1: Look for board object with specific structure
          if (obj.id && typeof obj.id === 'string') {
            // Check if this looks like a board (not a pin)
            const hasBoardFields = obj.board_pins !== undefined || 
                                   obj.section_count !== undefined ||
                                   obj.pin_count !== undefined ||
                                   obj.collaborated_by_me !== undefined ||
                                   obj.is_collaborative !== undefined;
            
            // Board ID is usually a long numeric string
            const isBoardId = obj.id.length >= 15 && /^\d+$/.test(obj.id);
            
            if ((hasBoardFields || isBoardId) && obj.name && typeof obj.name === 'string') {
              // Verify it's not a pin (pins have pin_id or images)
              if (!obj.pin_id && !obj.images && !obj.image_spec) {
                return { 
                  name: obj.name.slice(0, 60),
                  username: obj.owner?.username || obj.username || null 
                };
              }
            }
          }
          
          // Strategy 2: Look for nested board data
          if (obj.board && obj.board.name) {
            return {
              name: obj.board.name.slice(0, 60),
              username: obj.board.owner?.username || usernameFromUrl
            };
          }
          
          // Recurse
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const result = findBoardInfo(item, depth + 1);
              if (result?.name) return result;
            }
          } else {
            for (const val of Object.values(obj)) {
              const result = findBoardInfo(val as any, depth + 1);
              if (result?.name) return result;
            }
          }
          return null;
        }
        
        const boardInfo = findBoardInfo(jsonData);
        if (boardInfo?.name) {
          console.log('[Board Metadata] Found in PWS_DATA:', boardInfo.name);
          return { boardName: boardInfo.name, boardUsername: boardInfo.username || usernameFromUrl };
        }
      } catch (e) {
        console.error('[Board Metadata] JSON parse error:', e);
      }
    }
    
    // Fallback 1: Try HTML meta tags
    const metaMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    if (metaMatch) {
      const title = metaMatch[1].trim();
      // Clean up Pinterest suffix
      const cleanTitle = title.replace(/\s*\|\s*Pinterest\s*$/i, '').replace(/\s*на\s*Pinterest\s*$/i, '').trim();
      if (cleanTitle && cleanTitle.length > 0) {
        console.log('[Board Metadata] Found in og:title:', cleanTitle);
        return { boardName: cleanTitle.slice(0, 60), boardUsername: usernameFromUrl };
      }
    }
    
    // Fallback 2: Try title tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1].trim();
      // Clean up Pinterest suffix
      const cleanTitle = title.replace(/\s*\|\s*Pinterest\s*$/i, '').replace(/\s*на\s*Pinterest\s*$/i, '').trim();
      if (cleanTitle && cleanTitle.length > 0 && cleanTitle !== 'Pinterest') {
        console.log('[Board Metadata] Found in title:', cleanTitle);
        return { boardName: cleanTitle.slice(0, 60), boardUsername: usernameFromUrl };
      }
    }
    
    // Fallback 3: Try h1 tag
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      const h1Text = h1Match[1].trim();
      if (h1Text.length > 0 && h1Text.length < 100) {
        console.log('[Board Metadata] Found in h1:', h1Text);
        return { boardName: h1Text.slice(0, 60), boardUsername: usernameFromUrl };
      }
    }
    
    // Fallback 4: Extract from URL slug
    const boardSlug = urlParts[urlParts.length - 1] || null;
    if (boardSlug) {
      const boardName = boardSlug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .slice(0, 60);
      console.log('[Board Metadata] Fallback to URL slug:', boardName);
      return { boardName, boardUsername: usernameFromUrl };
    }
    
    return { boardName: null, boardUsername: usernameFromUrl };
  } catch (e) {
    console.error('[Board Metadata] Error:', e);
    return { boardName: null, boardUsername: null };
  }
}

// POST - создать задачу на парсинг
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, boardUrl } = body;

    console.log('[Scraper Task] Request:', { userId, boardUrl });

    if (!userId || !boardUrl) {
      return NextResponse.json(
        { success: false, error: 'userId и boardUrl обязательны' },
        { status: 400 }
      );
    }

    // Проверяем пользователя
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    console.log('[Scraper Task] User:', { id: user.id, isPremium: user.isPremium });

    // Проверяем лимит синхронизаций (только для FREE)
    if (!user.isPremium) {
      const limitCheck = await checkBoardsSyncLimit(userId);
      console.log('[Scraper Task] Limit check:', limitCheck);
      
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: limitCheck.message || 'Лимит синхронизаций исчерпан',
            limitExceeded: true,
          },
          { status: 403 }
        );
      }
    }

    // Создаём/обновляем запись доски
    const cleanBoardUrl = boardUrl.split('?')[0].replace(/\/$/, '');
    
    console.log('[Scraper Task] Clean URL:', cleanBoardUrl);
    
    // Получаем метаданные доски (название, username)
    console.log('[Scraper Task] Fetching board metadata...');
    const boardMetadata = await getBoardMetadata(cleanBoardUrl);
    console.log('[Scraper Task] Board metadata:', boardMetadata);

    try {
      const existingBoard = await db.pinterestBoard.findUnique({
        where: {
          userId_boardUrl: {
            userId,
            boardUrl: cleanBoardUrl,
          }
        }
      });

      if (existingBoard) {
        // Обновляем существующую запись - сбрасываем lastSyncAt для новой синхронизации
        await db.pinterestBoard.update({
          where: { id: existingBoard.id },
          data: {
            lastSyncAt: null, // null означает "pending sync"
            boardName: boardMetadata.boardName || existingBoard.boardName,
            boardUsername: boardMetadata.boardUsername || existingBoard.boardUsername,
          }
        });
        console.log('[Scraper Task] Updated existing board:', existingBoard.id);
      } else {
        // Создаём новую запись
        const newBoard = await db.pinterestBoard.create({
          data: {
            userId,
            boardUrl: cleanBoardUrl,
            boardName: boardMetadata.boardName,
            boardUsername: boardMetadata.boardUsername,
            totalPins: 0,
            newPins: 0,
          }
        });
        console.log('[Scraper Task] Created new board:', newBoard.id);
      }
    } catch (dbError: any) {
      console.error('[Scraper Task] DB Error:', dbError);
      return NextResponse.json(
        { success: false, error: 'Ошибка базы данных: ' + dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Доска добавлена в очередь синхронизации',
      boardUrl: cleanBoardUrl,
    });

  } catch (error: any) {
    console.error('[Scraper Task] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера: ' + error.message },
      { status: 500 }
    );
  }
}
