import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Max lengths for text fields
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_BOARD_NAME_LENGTH = 50;

function truncate(text: string | null, maxLength: number): string | null {
  if (!text) return null;
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

interface ScrapedPin {
  imageUrl: string;
  title: string | null;
  sourceUrl: string | null;
  description: string | null;
  pinId: string | null;
}

function parseBoardUrl(boardUrl: string): { username: string; boardSlug: string } | null {
  try {
    const url = new URL(boardUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      return { username: pathParts[0], boardSlug: pathParts[1] };
    }
    return null;
  } catch {
    return null;
  }
}

// Extract title from aria-label (format: "Страница пина «Название»" or "Pin page «Title»")
function extractTitleFromAriaLabel(ariaLabel: string): string | null {
  // Русский формат: Страница пина «Название»
  const ruMatch = ariaLabel.match(/Страница пина\s*«([^»]+)»/i);
  if (ruMatch) return ruMatch[1].trim();

  // Английский формат: Pin page «Title» or "Title" Pin
  const enMatch = ariaLabel.match(/Pin\s*(?:page\s*)?[«"]([^»"]+)[»"]|«([^»]+)»/i);
  if (enMatch) return (enMatch[1] || enMatch[2]).trim();

  // Простой формат в кавычках
  const quoteMatch = ariaLabel.match(/«([^»]+)»|"([^"]+)"/);
  if (quoteMatch) return (quoteMatch[1] || quoteMatch[2]).trim();

  return null;
}

async function scrapePinterestBoard(boardUrl: string): Promise<{
  success: boolean;
  boardName: string | null;
  boardUsername: string | null;
  pins: ScrapedPin[];
  error?: string;
}> {
  const boardInfo = parseBoardUrl(boardUrl);
  if (!boardInfo) {
    return { success: false, boardName: null, boardUsername: null, pins: [], error: 'Invalid URL' };
  }

  try {
    console.log('[ScrapeImport] Fetching:', boardUrl);

    const response = await fetch(boardUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'sec-ch-ua': '"Chromium";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
      },
    });

    if (!response.ok) {
      return { success: false, boardName: null, boardUsername: boardInfo.username, pins: [], error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    console.log('[ScrapeImport] HTML length:', html.length);

    const pwsMatch = html.match(/<script id="__PWS_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    const pins: ScrapedPin[] = [];
    const seenPinIds = new Set<string>();
    const seenUrls = new Set<string>();
    let boardName: string | null = null;
    let boardId: string | null = null;

    if (pwsMatch) {
      try {
        const jsonData = JSON.parse(pwsMatch[1]);

        // Найти ID доски из URL
        const resourceResponses = jsonData?.props?.initialReduxState?.resources?.data;
        if (resourceResponses) {
          for (const key of Object.keys(resourceResponses)) {
            if (key.includes('BoardResource') || key.includes('board')) {
              const boardData = resourceResponses[key]?.data;
              if (boardData?.id) {
                boardId = boardData.id;
                boardName = boardData.name || boardName;
                console.log('[ScrapeImport] Found board:', boardName, 'ID:', boardId);
                break;
              }
            }
          }
        }

        // Функция для проверки что пин принадлежит доске
        function isBoardPin(pinObj: any): boolean {
          if (boardId && pinObj.board?.id === boardId) return true;
          if (boardId && pinObj.board_id === boardId) return true;
          if (pinObj.board && !pinObj.is_downstream_promotion) return true;
          if (pinObj.is_downstream_promotion) return false;
          if (pinObj.promoter) return false;
          if (pinObj.is_promoted) return false;
          return true;
        }

        function traverse(obj: any, depth = 0) {
          if (!obj || typeof obj !== 'object' || depth > 80) return;

          const hasPinData = obj.id && (
            obj.images ||
            obj.image_spec ||
            obj.pinJoin ||
            obj.grid_title ||
            obj.title
          );

          const isPinObject = obj.id && typeof obj.id === 'string' && obj.id.length > 10 &&
            (obj.images || obj.image_spec || obj.grid_data);

          if (hasPinData || isPinObject) {
            if (!isBoardPin(obj)) return;

            let imageUrl: string | null = null;
            let pinId: string | null = obj.id || null;
            let title: string | null = null;
            let description: string | null = null;

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
                const sortedSpecs = specs.sort((a, b) => (b.width || 0) - (a.width || 0));
                imageUrl = sortedSpecs[0]?.url;
              }
            }

            title = obj.title || obj.grid_title || obj.name || obj.seo_title || null;
            description = obj.description || obj.seo_description || null;

            if (imageUrl && imageUrl.includes('pinimg.com')) {
              if (!imageUrl.includes('/75x75') && !imageUrl.includes('/140x') &&
                  !imageUrl.includes('/60x60') && !imageUrl.includes('/30x30') &&
                  !imageUrl.includes('_RS') && !imageUrl.includes('/user/')) {

                imageUrl = imageUrl
                  .replace('/236x/', '/originals/')
                  .replace('/474x/', '/originals/')
                  .replace('/564x/', '/originals/');

                const duplicateKey = pinId || imageUrl;
                if (!seenPinIds.has(duplicateKey) && !seenUrls.has(imageUrl)) {
                  seenPinIds.add(duplicateKey);
                  seenUrls.add(imageUrl);

                  pins.push({
                    imageUrl,
                    title,
                    sourceUrl: pinId ? `https://www.pinterest.com/pin/${pinId}` : null,
                    description,
                    pinId,
                  });
                }
              }
            }
          }

          if (obj.name && obj.id && !boardName && (obj.owner || obj.board_order !== undefined || obj.section_count !== undefined)) {
            boardName = obj.name;
          }

          if (Array.isArray(obj)) {
            obj.forEach(item => traverse(item, depth + 1));
          } else {
            Object.values(obj).forEach(val => traverse(val, depth + 1));
          }
        }

        traverse(jsonData);
        console.log(`[ScrapeImport] Extracted ${pins.length} pins from JSON`);
      } catch (e) {
        console.error('[ScrapeImport] JSON parse error:', e);
      }
    }

    // Fallback: Извлечение из HTML через aria-label
    if (pins.length === 0) {
      console.log('[ScrapeImport] Falling back to HTML extraction with aria-label');

      const pinLinkRegex = /<a[^>]*aria-label="([^"]*)"[^>]*href="\/pin\/(\d+)\/?"[^>]*>/gi;
      let linkMatch;

      while ((linkMatch = pinLinkRegex.exec(html)) !== null) {
        const ariaLabel = linkMatch[1];
        const pinId = linkMatch[2];

        if (seenPinIds.has(pinId)) continue;

        const title = extractTitleFromAriaLabel(ariaLabel);

        const searchStart = Math.max(0, linkMatch.index - 500);
        const searchEnd = Math.min(html.length, linkMatch.index + linkMatch[0].length + 500);
        const searchArea = html.substring(searchStart, searchEnd);

        const imgMatch = searchArea.match(/<img[^>]*src="(https?:\/\/i\.pinimg\.com\/[^"]+)"/i);
        if (imgMatch) {
          let imageUrl = imgMatch[1];

          if (imageUrl.includes('/75x75') || imageUrl.includes('/140x') ||
              imageUrl.includes('/60x60') || imageUrl.includes('/30x30') ||
              imageUrl.includes('_RS')) {
            continue;
          }

          imageUrl = imageUrl
            .replace(/\/\d+x\d*\//, '/originals/')
            .replace('/236x/', '/originals/')
            .replace('/474x/', '/originals/')
            .replace('/564x/', '/originals/');

          if (!seenUrls.has(imageUrl)) {
            seenPinIds.add(pinId);
            seenUrls.add(imageUrl);

            pins.push({
              imageUrl,
              title,
              sourceUrl: `https://www.pinterest.com/pin/${pinId}`,
              description: null,
              pinId,
            });
          }
        }
      }

      // Если не нашли через aria-label
      if (pins.length === 0) {
        console.log('[ScrapeImport] Trying simple img extraction');

        const imgRegex = /<img[^>]*src="(https?:\/\/i\.pinimg\.com\/[^"]+)"[^>]*(?:alt="([^"]*)")?/gi;
        let imgMatch;

        while ((imgMatch = imgRegex.exec(html)) !== null) {
          let imageUrl = imgMatch[1];
          const alt = imgMatch[2] || null;

          if (imageUrl.includes('/75x75') || imageUrl.includes('/140x') ||
              imageUrl.includes('/60x60') || imageUrl.includes('_RS') ||
              imageUrl.includes('/user/')) {
            continue;
          }

          imageUrl = imageUrl
            .replace(/\/\d+x\d*\//, '/originals/')
            .replace('/236x/', '/originals/')
            .replace('/474x/', '/originals/')
            .replace('/564x/', '/originals/');

          if (!seenUrls.has(imageUrl)) {
            seenUrls.add(imageUrl);
            pins.push({
              imageUrl,
              title: truncate(alt, MAX_TITLE_LENGTH),
              sourceUrl: null,
              description: null,
              pinId: null,
            });
          }
        }
      }
    }

    // Get board name from meta
    if (!boardName) {
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
      if (titleMatch) {
        boardName = titleMatch[1].replace(' | Pinterest', '').trim();
      }
    }

    const filteredPins = pins
      .filter(pin => !pin.imageUrl.includes('/user/'))
      .map(pin => ({
        imageUrl: pin.imageUrl,
        title: truncate(pin.title, MAX_TITLE_LENGTH),
        sourceUrl: pin.sourceUrl,
        description: truncate(pin.description, MAX_DESCRIPTION_LENGTH),
        pinId: pin.pinId,
      }));

    return {
      success: filteredPins.length > 0,
      boardName: truncate(boardName, MAX_BOARD_NAME_LENGTH),
      boardUsername: boardInfo.username,
      pins: filteredPins,
    };

  } catch (error) {
    console.error('[ScrapeImport] Error:', error);
    return {
      success: false,
      boardName: null,
      boardUsername: boardInfo.username,
      pins: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// POST /api/pinterest/scrape-import - Scrape and import in one request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telegramId, boardUrl, saveBoard = true } = body;

    if (!telegramId || !boardUrl) {
      return NextResponse.json(
        { error: 'telegramId и boardUrl обязательны' },
        { status: 400 }
      );
    }

    if (!boardUrl.includes('pinterest.')) {
      return NextResponse.json(
        { error: 'URL должен быть Pinterest' },
        { status: 400 }
      );
    }

    // Find user
    const user = await db.user.findUnique({
      where: { telegramId: String(telegramId) },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    const cleanUrl = boardUrl.split('?')[0].replace(/\/$/, '');

    // Scrape pins
    const scrapeResult = await scrapePinterestBoard(cleanUrl);

    if (!scrapeResult.success || scrapeResult.pins.length === 0) {
      return NextResponse.json({
        success: false,
        error: scrapeResult.error || 'Не удалось найти пины на доске',
        boardName: scrapeResult.boardName,
        boardUsername: scrapeResult.boardUsername,
      });
    }

    // Get existing pins
    const existingPins = await db.pin.findMany({
      where: { userId: user.id },
      select: { imageUrl: true },
    });
    const existingUrls = new Set(existingPins.map(p => p.imageUrl));

    // Filter duplicates
    const newPins = scrapeResult.pins.filter(pin => !existingUrls.has(pin.imageUrl));

    if (newPins.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Все пины уже существуют',
        imported: 0,
        skipped: scrapeResult.pins.length,
        boardName: scrapeResult.boardName,
      });
    }

    // Import pins
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
            boardUrl: cleanUrl,
            category: scrapeResult.boardName || scrapeResult.boardUsername,
          },
        });
        imported++;
      } catch (e: any) {
        if (!e.message?.includes('Unique constraint')) {
          console.log('[ScrapeImport] Skip pin:', e.message?.substring(0, 50));
        }
      }
    }

    // Save board for sync
    if (saveBoard) {
      try {
        await db.pinterestBoard.upsert({
          where: {
            userId_boardUrl: {
              userId: user.id,
              boardUrl: cleanUrl,
            },
          },
          update: {
            boardName: scrapeResult.boardName,
            boardUsername: scrapeResult.boardUsername,
            lastSyncAt: new Date(),
            totalPins: scrapeResult.pins.length,
            newPins: imported,
          },
          create: {
            userId: user.id,
            boardUrl: cleanUrl,
            boardName: scrapeResult.boardName,
            boardUsername: scrapeResult.boardUsername,
            lastSyncAt: new Date(),
            totalPins: scrapeResult.pins.length,
            newPins: imported,
          },
        });
      } catch (e) {
        console.log('[ScrapeImport] Board save error:', e);
      }
    }

    console.log(`[ScrapeImport] Complete: ${imported} pins imported for user ${telegramId}`);

    return NextResponse.json({
      success: true,
      message: `Импортировано ${imported} пинов`,
      imported,
      skipped: scrapeResult.pins.length - newPins.length,
      total: scrapeResult.pins.length,
      boardName: scrapeResult.boardName,
      boardUsername: scrapeResult.boardUsername,
      boardUrl: cleanUrl,
    });

  } catch (error) {
    console.error('[ScrapeImport] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
