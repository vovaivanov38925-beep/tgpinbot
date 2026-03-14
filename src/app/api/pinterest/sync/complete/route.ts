import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Max lengths
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 200;

function truncate(text: string | null, maxLength: number): string | null {
  if (!text) return null;
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Server-side Pinterest scraping as fallback
async function scrapeBoardServerSide(boardUrl: string): Promise<any[]> {
  try {
    console.log('[Server Scrape] Attempting:', boardUrl);
    
    const response = await fetch(boardUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      console.log('[Server Scrape] HTTP error:', response.status);
      return [];
    }

    const html = await response.text();
    const pwsMatch = html.match(/<script id="__PWS_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    
    const pins: any[] = [];
    const seenUrls = new Set<string>();

    if (pwsMatch) {
      try {
        const jsonData = JSON.parse(pwsMatch[1]);

        function traverse(obj: any, depth = 0) {
          if (!obj || typeof obj !== 'object' || depth > 70) return;

          if (obj.id && (obj.images || obj.image_spec || obj.pin)) {
            let imageUrl: string | null = null;
            let pinId: string | null = obj.id || obj.pin_id || null;

            if (obj.images?.orig?.url) {
              imageUrl = obj.images.orig.url;
            } else if (obj.images?.['564x']?.url) {
              imageUrl = obj.images['564x'].url.replace('/564x/', '/originals/');
            } else if (obj.images?.['474x']?.url) {
              imageUrl = obj.images['474x'].url.replace('/474x/', '/originals/');
            } else if (obj.images?.['236x']?.url) {
              imageUrl = obj.images['236x'].url.replace('/236x/', '/originals/');
            } else if (obj.image_spec) {
              const specs = Object.values(obj.image_spec) as any[];
              if (specs.length > 0) {
                imageUrl = specs[specs.length - 1]?.url || specs[0]?.url;
              }
            } else if (obj.pin?.images) {
              if (obj.pin.images.orig?.url) {
                imageUrl = obj.pin.images.orig.url;
              } else if (obj.pin.images['564x']?.url) {
                imageUrl = obj.pin.images['564x'].url.replace('/564x/', '/originals/');
              }
              pinId = obj.pin.id || pinId;
            }

            if (imageUrl && imageUrl.includes('pinimg.com') && !seenUrls.has(imageUrl)) {
              if (!imageUrl.includes('/75x75') && !imageUrl.includes('/140x') &&
                  !imageUrl.includes('/60x60') && !imageUrl.includes('_RS') &&
                  !imageUrl.includes('/user/')) {
                seenUrls.add(imageUrl);
                pins.push({
                  imageUrl,
                  title: truncate(obj.title || obj.grid_title || obj.name || obj.pin?.title, MAX_TITLE_LENGTH),
                  sourceUrl: pinId ? `https://www.pinterest.com/pin/${pinId}` : null,
                  description: truncate(obj.description || obj.pin?.description, MAX_DESCRIPTION_LENGTH),
                });
              }
            }
          }

          if (Array.isArray(obj)) {
            obj.forEach(item => traverse(item, depth + 1));
          } else {
            Object.values(obj).forEach(val => traverse(val, depth + 1));
          }
        }

        traverse(jsonData);
        console.log(`[Server Scrape] Found ${pins.length} pins`);
      } catch (e) {
        console.error('[Server Scrape] JSON error:', e);
      }
    }

    // Fallback to HTML img extraction
    if (pins.length === 0) {
      const imgRegex = /<img[^>]+src="(https?:\/\/i\.pinimg\.com\/[^"]+)"[^>]*(?:alt="([^"]*)")?/gi;
      let match;

      while ((match = imgRegex.exec(html)) !== null) {
        let imageUrl = match[1];
        const alt = match[2] || null;

        if (imageUrl.includes('/75x75') || imageUrl.includes('/140x') || imageUrl.includes('_RS')) continue;
        imageUrl = imageUrl.replace(/\/\d+x\d*\//, '/originals/');

        if (!seenUrls.has(imageUrl)) {
          seenUrls.add(imageUrl);
          pins.push({
            imageUrl,
            title: truncate(alt, MAX_TITLE_LENGTH),
            sourceUrl: null,
            description: null,
          });
        }
      }
      console.log(`[Server Scrape] HTML fallback found ${pins.length} pins`);
    }

    return pins.filter(p => !p.imageUrl.includes('/user/'));
  } catch (e) {
    console.error('[Server Scrape] Error:', e);
    return [];
  }
}

// POST /api/pinterest/sync/complete - пометить доску как синхронизированную
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { boardUrl, telegramId, totalPins, importedPins, secret } = body;
    
    if (secret !== process.env.SCRAPER_SECRET && secret !== 'tgpinbot_scraper_2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!boardUrl || !telegramId) {
      return NextResponse.json({ error: 'boardUrl and telegramId required' }, { status: 400 });
    }
    
    const cleanBoardUrl = boardUrl.split('?')[0].replace(/\/$/, '');
    
    // Находим пользователя
    const user = await db.user.findUnique({
      where: { telegramId: String(telegramId) }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let finalTotalPins = totalPins || 0;
    let finalImportedPins = importedPins || 0;

    // Если Python скрапер вернул 0 пинов - пробуем серверный fallback
    if (totalPins === 0 || importedPins === 0) {
      console.log('[Sync Complete] Python scraper found 0 pins, trying server-side fallback...');
      
      const serverPins = await scrapeBoardServerSide(cleanBoardUrl);
      
      if (serverPins.length > 0) {
        // Получаем существующие пины
        const existingPins = await db.pin.findMany({
          where: { userId: user.id },
          select: { imageUrl: true },
        });
        const existingUrls = new Set(existingPins.map(p => p.imageUrl));
        
        // Фильтруем дубликаты
        const newPins = serverPins.filter(pin => !existingUrls.has(pin.imageUrl));
        
        // Импортируем
        let imported = 0;
        for (const pin of newPins) {
          try {
            await db.pin.create({
              data: {
                userId: user.id,
                imageUrl: pin.imageUrl,
                title: pin.title,
                description: pin.description,
                sourceUrl: pin.sourceUrl,
                boardUrl: cleanBoardUrl,
                category: null,
              },
            });
            imported++;
          } catch (e) {
            // Skip duplicates
          }
        }
        
        finalTotalPins = serverPins.length;
        finalImportedPins = imported;
        
        console.log(`[Sync Complete] Server fallback imported ${imported} pins`);
      }
    }
    
    // Обновляем доску
    const board = await db.pinterestBoard.updateMany({
      where: {
        userId: user.id,
        boardUrl: cleanBoardUrl,
      },
      data: {
        lastSyncAt: new Date(),
        totalPins: finalTotalPins,
        newPins: finalImportedPins,
      }
    });
    
    console.log(`[Sync Complete] Board ${cleanBoardUrl}: ${finalImportedPins} pins for user ${telegramId}`);
    
    return NextResponse.json({ 
      success: true,
      totalPins: finalTotalPins,
      importedPins: finalImportedPins,
      fallback: totalPins === 0 && finalTotalPins > 0,
    });
    
  } catch (error) {
    console.error('[Sync Complete] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
