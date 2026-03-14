import { NextRequest, NextResponse } from 'next/server';

// Max lengths for text fields
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_BOARD_NAME_LENGTH = 50;

// Truncate text helper
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

interface ScrapeResult {
  success: boolean;
  boardName: string | null;
  boardUsername: string | null;
  pins: ScrapedPin[];
  totalPins: number;
  error?: string;
  debug?: any;
}

// Extract board info from URL
function parseBoardUrl(boardUrl: string): { username: string; boardSlug: string } | null {
  try {
    const url = new URL(boardUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts.length >= 2) {
      return {
        username: pathParts[0],
        boardSlug: pathParts[1],
      };
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

// Extract pin ID from Pinterest URL
function extractPinId(url: string): string | null {
  const match = url.match(/pin\/(\d+)/);
  return match ? match[1] : null;
}

// Main scraping function
async function scrapeBoard(boardUrl: string): Promise<ScrapeResult> {
  const boardInfo = parseBoardUrl(boardUrl);
  if (!boardInfo) {
    return {
      success: false,
      boardName: null,
      boardUsername: null,
      pins: [],
      totalPins: 0,
      error: 'Invalid Pinterest board URL format',
    };
  }

  try {
    console.log('[Pinterest] Fetching:', boardUrl);

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
      return {
        success: false,
        boardName: null,
        boardUsername: boardInfo.username,
        pins: [],
        totalPins: 0,
        error: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    console.log('[Pinterest] HTML length:', html.length);

    const pins: ScrapedPin[] = [];
    const seenPinIds = new Set<string>();
    const seenUrls = new Set<string>();
    let boardName: string | null = null;
    let boardId: string | null = null;

    // Extract __PWS_DATA__ from HTML
    const pwsMatch = html.match(/<script id="__PWS_DATA__" type="application\/json">([\s\S]*?)<\/script>/);

    if (pwsMatch) {
      console.log('[Pinterest] Found __PWS_DATA__, parsing...');

      try {
        const jsonData = JSON.parse(pwsMatch[1]);

        // Найти ID доски из URL
        const resourceResponses = jsonData?.props?.initialReduxState?.resources?.data;
        if (resourceResponses) {
          console.log('[Pinterest] Found resources data');

          // Ищем BoardResource для получения ID доски
          for (const key of Object.keys(resourceResponses)) {
            if (key.includes('BoardResource') || key.includes('board')) {
              const boardData = resourceResponses[key]?.data;
              if (boardData?.id) {
                boardId = boardData.id;
                boardName = boardData.name || boardName;
                console.log('[Pinterest] Found board:', boardName, 'ID:', boardId);
                break;
              }
            }
          }
        }

        // Функция для проверки что пин принадлежит доске
        function isBoardPin(pinObj: any): boolean {
          // Проверяем что у пина есть board и он совпадает с доской
          if (boardId && pinObj.board?.id === boardId) return true;
          if (boardId && pinObj.board_id === boardId) return true;

          // Если нет boardId, проверяем по другим признакам
          // Пины доски обычно имеют is_repin = false или board совпадает
          if (pinObj.board && !pinObj.is_downstream_promotion) return true;

          // Игнорируем рекламные и рекомендуемые
          if (pinObj.is_downstream_promotion) return false;
          if (pinObj.promoter) return false;
          if (pinObj.is_promoted) return false;

          return true;
        }

        // Traverse JSON to find pins - ТОЛЬКО пины доски
        function traverse(obj: any, depth = 0, inBoardFeed = false) {
          if (!obj || typeof obj !== 'object' || depth > 80) return;

          // Проверяем если мы в разделе BoardFeedResource
          if (obj.resourceOptions?.board_id || obj.resourceOptions?.boardId) {
            inBoardFeed = true;
          }

          // Проверяем структуру пина
          const hasPinData = obj.id && (
            obj.images ||
            obj.image_spec ||
            obj.pinJoin ||
            obj.grid_title ||
            obj.title
          );

          // Дополнительная проверка - это объект с данными пина
          const isPinObject = obj.id && typeof obj.id === 'string' && obj.id.length > 10 &&
            (obj.images || obj.image_spec || obj.grid_data);

          if (hasPinData || isPinObject) {
            // Проверяем что это пин доски, а не рекомендуемый
            if (!isBoardPin(obj)) {
              return; // Пропускаем рекомендуемые пины
            }

            let imageUrl: string | null = null;
            let pinId: string | null = obj.id || null;
            let title: string | null = null;
            let description: string | null = null;

            // Извлекаем изображение
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
                // Берем самое большое изображение
                const sortedSpecs = specs.sort((a, b) => (b.width || 0) - (a.width || 0));
                imageUrl = sortedSpecs[0]?.url;
              }
            }

            // Извлекаем заголовок - несколько источников
            title = obj.title || obj.grid_title || obj.name || obj.seo_title || null;

            // Извлекаем описание
            description = obj.description || obj.seo_description || null;

            if (imageUrl && imageUrl.includes('pinimg.com')) {
              // Пропускаем миниатюры и аватарки
              if (!imageUrl.includes('/75x75') && !imageUrl.includes('/140x') &&
                  !imageUrl.includes('/60x60') && !imageUrl.includes('/30x30') &&
                  !imageUrl.includes('_RS') && !imageUrl.includes('/user/')) {

                // Конвертируем в оригинальное качество
                imageUrl = imageUrl
                  .replace('/236x/', '/originals/')
                  .replace('/474x/', '/originals/')
                  .replace('/564x/', '/originals/');

                // Проверяем дубликаты по pinId или URL
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

          // Check for board name
          if (obj.name && obj.id && !boardName && (obj.owner || obj.board_order !== undefined || obj.section_count !== undefined)) {
            boardName = obj.name;
          }

          // Continue traversing
          if (Array.isArray(obj)) {
            obj.forEach(item => traverse(item, depth + 1, inBoardFeed));
          } else {
            Object.values(obj).forEach(val => traverse(val, depth + 1, inBoardFeed));
          }
        }

        traverse(jsonData);
        console.log(`[Pinterest] Extracted ${pins.length} pins from JSON (board only)`);
      } catch (e) {
        console.error('[Pinterest] JSON parse error:', e);
      }
    }

    // Fallback: Извлечение из HTML через aria-label
    if (pins.length === 0) {
      console.log('[Pinterest] Falling back to HTML extraction with aria-label');

      // Извлекаем пины через ссылки с aria-label
      // Формат: <a aria-label="Страница пина «Название»" href="/pin/123456/">
      const pinLinkRegex = /<a[^>]*aria-label="([^"]*)"[^>]*href="\/pin\/(\d+)\/?"[^>]*>/gi;
      let linkMatch;

      while ((linkMatch = pinLinkRegex.exec(html)) !== null) {
        const ariaLabel = linkMatch[1];
        const pinId = linkMatch[2];

        if (seenPinIds.has(pinId)) continue;

        const title = extractTitleFromAriaLabel(ariaLabel);

        // Ищем изображение рядом с этой ссылкой
        // Ищем впереди или сзади img тег
        const searchStart = Math.max(0, linkMatch.index - 500);
        const searchEnd = Math.min(html.length, linkMatch.index + linkMatch[0].length + 500);
        const searchArea = html.substring(searchStart, searchEnd);

        const imgMatch = searchArea.match(/<img[^>]*src="(https?:\/\/i\.pinimg\.com\/[^"]+)"/i);
        if (imgMatch) {
          let imageUrl = imgMatch[1];

          // Пропускаем мелкие изображения
          if (imageUrl.includes('/75x75') || imageUrl.includes('/140x') ||
              imageUrl.includes('/60x60') || imageUrl.includes('/30x30') ||
              imageUrl.includes('_RS')) {
            continue;
          }

          // Конвертируем в оригинальное качество
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

      // Если не нашли через aria-label, пробуем просто img теги
      if (pins.length === 0) {
        console.log('[Pinterest] Trying simple img extraction');

        const imgRegex = /<img[^>]*src="(https?:\/\/i\.pinimg\.com\/[^"]+)"[^>]*alt="([^"]*)"?/gi;
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

    // Also try to get board name from meta
    if (!boardName) {
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
      if (titleMatch) {
        boardName = titleMatch[1].replace(' | Pinterest', '').trim();
      }
    }

    // Format results
    const filteredPins = pins
      .filter(pin => !pin.imageUrl.includes('/user/'))
      .map(pin => ({
        imageUrl: pin.imageUrl,
        title: truncate(pin.title, MAX_TITLE_LENGTH),
        sourceUrl: pin.sourceUrl,
        description: truncate(pin.description, MAX_DESCRIPTION_LENGTH),
        pinId: pin.pinId,
      }));

    console.log(`[Pinterest] Final count: ${filteredPins.length} pins (board only)`);

    return {
      success: filteredPins.length > 0,
      boardName: truncate(boardName, MAX_BOARD_NAME_LENGTH),
      boardUsername: boardInfo.username,
      pins: filteredPins,
      totalPins: filteredPins.length,
    };

  } catch (error) {
    console.error('[Pinterest] Error:', error);
    return {
      success: false,
      boardName: null,
      boardUsername: boardInfo.username,
      pins: [],
      totalPins: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { boardUrl } = body;

    if (!boardUrl) {
      return NextResponse.json({ error: 'Board URL is required' }, { status: 400 });
    }

    if (!boardUrl.includes('pinterest.')) {
      return NextResponse.json({ error: 'Must be a Pinterest URL' }, { status: 400 });
    }

    const cleanUrl = boardUrl.split('?')[0].replace(/\/$/, '');
    const result = await scrapeBoard(cleanUrl);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const boardUrl = searchParams.get('url');

  if (!boardUrl) {
    return NextResponse.json({ error: 'URL required' }, { status: 400 });
  }

  const cleanUrl = boardUrl.split('?')[0].replace(/\/$/, '');
  const result = await scrapeBoard(cleanUrl);

  return NextResponse.json(result);
}
