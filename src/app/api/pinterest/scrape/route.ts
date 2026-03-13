import { NextRequest, NextResponse } from 'next/server';

// Max lengths for text fields
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_BOARD_NAME_LENGTH = 100;

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
}

interface ScrapeResult {
  success: boolean;
  boardName: string | null;
  boardUsername: string | null;
  pins: ScrapedPin[];
  totalPins: number;
  error?: string;
}

// User agents for requests
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Extract board info from URL
function parseBoardUrl(boardUrl: string): { username: string; boardSlug: string } | null {
  try {
    const url = new URL(boardUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Format: /username/board-slug/ or /username/board-slug
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

// Scrape Pinterest board page
async function scrapeBoardPage(boardUrl: string): Promise<ScrapeResult> {
  const boardInfo = parseBoardUrl(boardUrl);
  if (!boardInfo) {
    return {
      success: false,
      boardName: null,
      boardUsername: null,
      pins: [],
      totalPins: 0,
      error: 'Invalid Pinterest board URL format. Expected: pinterest.com/username/board-name',
    };
  }

  try {
    // Use mobile version - simpler HTML, less JS protection
    const mobileUrl = boardUrl.replace('www.pinterest', 'pinterest').replace('pinterest.com', 'pinterest.com');
    
    // Fetch the board page with mobile-like headers
    const response = await fetch(mobileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'referer': 'https://www.google.com/',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        success: false,
        boardName: null,
        boardUsername: boardInfo.username,
        pins: [],
        totalPins: 0,
        error: `Failed to fetch board page: ${response.status} ${response.statusText}`,
      };
    }

    const html = await response.text();

    // Extract pins from HTML using multiple methods
    const pins = extractPinsFromHtml(html);

    // Extract board name
    const boardName = extractBoardName(html);

    return {
      success: pins.length > 0,
      boardName,
      boardUsername: boardInfo.username,
      pins,
      totalPins: pins.length,
    };
  } catch (error) {
    console.error('Error scraping Pinterest board:', error);
    return {
      success: false,
      boardName: null,
      boardUsername: boardInfo.username,
      pins: [],
      totalPins: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Extract pins from HTML
function extractPinsFromHtml(html: string): ScrapedPin[] {
  const pins: ScrapedPin[] = [];
  const seenUrls = new Set<string>();
  const boardPinIds = new Set<string>();

  // Method 0: Extract valid pin IDs from board-feed-item-list JSON-LD (most reliable)
  // This gives us the actual pin IDs that belong to this board
  const itemListMatch = html.match(/<script data-test-id="board-feed-item-list"[^>]*>([\s\S]*?)<\/script>/);
  if (itemListMatch) {
    try {
      const jsonLdData = JSON.parse(itemListMatch[1]);
      if (jsonLdData.itemListElement && Array.isArray(jsonLdData.itemListElement)) {
        jsonLdData.itemListElement.forEach((item: any) => {
          if (item.url) {
            // Extract pin ID from URL like https://www.pinterest.com/pin/123456/
            const pinIdMatch = item.url.match(/\/pin\/(\d+)/);
            if (pinIdMatch) {
              boardPinIds.add(pinIdMatch[1]);
            }
          }
        });
        console.log(`[Pinterest] Found ${boardPinIds.size} pin IDs in board-feed-item-list`);
      }
    } catch (e) {
      console.error('Error parsing board-feed-item-list:', e);
    }
  }

  // Method 1: Look for pin data in embedded JSON (most reliable)
  try {
    // Pinterest embeds data in <script id="__PWS_DATA__" type="application/json">
    const pwsDataMatch = html.match(/<script id="__PWS_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (pwsDataMatch) {
      const jsonData = JSON.parse(pwsDataMatch[1]);
      const extractedFromJson = extractPinsFromPwsData(jsonData, boardPinIds);
      console.log(`[Pinterest] Extracted ${extractedFromJson.length} pins from PWS_DATA`);
      extractedFromJson.forEach(pin => {
        if (!seenUrls.has(pin.imageUrl)) {
          seenUrls.add(pin.imageUrl);
          pins.push(pin);
        }
      });
    }
  } catch (e) {
    console.error('Error parsing PWS_DATA:', e);
  }

  // Method 2: Extract images from grid items with correct context
  // Only take images that are inside board feed (grid-non-story-pin-image-unknown timing attribute)
  const gridImgRegex = /elementtiming="grid-non-story-pin-image[^"]*"[^>]*src="https?:\/\/i\.pinimg\.com\/[^"]+"/gi;
  const gridImgMatches = html.match(gridImgRegex) || [];
  
  gridImgMatches.forEach(match => {
    const urlMatch = match.match(/src="(https?:\/\/i\.pinimg\.com\/[^"]+)"/);
    if (urlMatch) {
      // Convert to original quality
      const originalUrl = urlMatch[1].replace(/\/\d+x\d*\//, '/originals/');

      if (!seenUrls.has(originalUrl)) {
        seenUrls.add(originalUrl);
        
        // Try to extract alt text for title
        const altMatch = match.match(/alt="([^"]+)"/);
        const title = altMatch ? altMatch[1] : null;
        
        pins.push({
          imageUrl: originalUrl,
          title: truncate(title, MAX_TITLE_LENGTH),
          sourceUrl: null,
          description: null,
        });
      }
    }
  });
  
  console.log(`[Pinterest] Found ${gridImgMatches.length} grid images, total unique: ${pins.length}`);

  // Method 3: Look for images in srcset (higher quality versions)
  const srcsetRegex = /srcset="[^"]*i\.pinimg\.com\/originals\/[^"]+"/gi;
  const srcsetMatches = html.match(srcsetRegex) || [];
  
  srcsetMatches.forEach(match => {
    // Extract originals URL
    const origMatch = match.match(/i\.pinimg\.com\/originals\/[^"'\s]+/);
    if (origMatch) {
      const originalUrl = `https://${origMatch[0]}`;
      if (!seenUrls.has(originalUrl)) {
        seenUrls.add(originalUrl);
        pins.push({
          imageUrl: originalUrl,
          title: null,
          sourceUrl: null,
          description: null,
        });
      }
    }
  });

  // Method 4: Fallback - extract pin images from HTML (but only if we haven't found enough)
  if (pins.length < 5) {
    const pinImgRegex = /https?:\/\/i\.pinimg\.com\/[^"'\s]+\.(jpg|jpeg|png|gif|webp)/gi;
    const imgMatches = html.match(pinImgRegex) || [];

    imgMatches.forEach(url => {
      // Skip profile images and small thumbnails
      if (url.includes('/75x75') || url.includes('/140x140') || url.includes('_RS/')) {
        return;
      }
      
      // Convert to original quality
      const originalUrl = url.replace(/\/\d+x\d*\//, '/originals/');

      if (!seenUrls.has(originalUrl)) {
        seenUrls.add(originalUrl);
        pins.push({
          imageUrl: originalUrl,
          title: null,
          sourceUrl: null,
          description: null,
        });
      }
    });
  }
  
  console.log(`[Pinterest] Total pins extracted: ${pins.length}`);
  return pins;
}

// Extract pins from Pinterest's embedded JSON data
function extractPinsFromPwsData(data: any, boardPinIds: Set<string>): ScrapedPin[] {
  const pins: ScrapedPin[] = [];
  const seenIds = new Set<string>();

  function traverse(obj: any, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 20) return;

    // Look for pin objects with images
    if (obj.id && (obj.images || obj.image_url || obj.image)) {
      const pinId = String(obj.id);
      
      // If we have board pin IDs, only accept pins from that list
      // Otherwise accept all pins with images
      if (boardPinIds.size > 0 && !boardPinIds.has(pinId)) {
        // This pin is not in our board, skip it (it's likely a recommendation)
        // But still traverse children
      } else {
        if (seenIds.has(pinId)) return;
        seenIds.add(pinId);

        let imageUrl: string | null = null;

        // Try different image formats
        if (obj.images?.orig?.url) {
          imageUrl = obj.images.orig.url;
        } else if (obj.images?.['564x']?.url) {
          imageUrl = obj.images['564x'].url.replace('/564x/', '/originals/');
        } else if (obj.images?.['474x']?.url) {
          imageUrl = obj.images['474x'].url.replace('/474x/', '/originals/');
        } else if (obj.image_url) {
          imageUrl = obj.image_url;
        } else if (obj.image?.url) {
          imageUrl = obj.image.url;
        } else if (typeof obj.image === 'string') {
          imageUrl = obj.image;
        }

        if (imageUrl && imageUrl.includes('pinimg.com')) {
          // Ensure original quality
          if (!imageUrl.includes('/originals/')) {
            imageUrl = imageUrl.replace(/\/\d+x\d*\//, '/originals/');
          }
          
          pins.push({
            imageUrl,
            title: truncate(obj.title || obj.grid_title || obj.name || null, MAX_TITLE_LENGTH),
            sourceUrl: obj.link || (obj.id ? `https://pinterest.com/pin/${obj.id}` : null),
            description: truncate(obj.description || obj.grid_description || obj.text || null, MAX_DESCRIPTION_LENGTH),
          });
        }
      }
    }

    // Also look for thumbnail/url patterns (only if no board pin IDs filter)
    if (boardPinIds.size === 0 && obj.url && typeof obj.url === 'string' && obj.url.includes('pinimg.com')) {
      const imageUrl = obj.url.replace(/\/\d+x\d*\//, '/originals/');
      if (!pins.find(p => p.imageUrl === imageUrl)) {
        pins.push({
          imageUrl,
          title: truncate(obj.title || obj.name || null, MAX_TITLE_LENGTH),
          sourceUrl: obj.source_url || null,
          description: truncate(obj.description || null, MAX_DESCRIPTION_LENGTH),
        });
      }
    }

    // Traverse nested objects
    if (Array.isArray(obj)) {
      obj.forEach(item => traverse(item, depth + 1));
    } else {
      Object.values(obj).forEach(val => traverse(val, depth + 1));
    }
  }

  traverse(data);
  return pins;
}

// Extract board name from HTML
function extractBoardName(html: string): string | null {
  // Try meta tag
  const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  if (ogTitleMatch) {
    const name = ogTitleMatch[1].replace(' | Pinterest', '').trim();
    return truncate(name, MAX_BOARD_NAME_LENGTH);
  }

  // Try h1 tag
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (h1Match) {
    return truncate(h1Match[1].trim(), MAX_BOARD_NAME_LENGTH);
  }

  // Try title tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    const name = titleMatch[1].split('|')[0].trim();
    return truncate(name, MAX_BOARD_NAME_LENGTH);
  }

  return null;
}

// Use Microlink API as fallback
async function scrapeWithMicrolink(boardUrl: string): Promise<ScrapeResult> {
  try {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(boardUrl)}&data.images=true`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status === 'success' && data.data) {
      const pins: ScrapedPin[] = [];

      // Extract images
      if (data.data.images && Array.isArray(data.data.images)) {
        data.data.images.forEach((img: any) => {
          if (img.url && (img.url.includes('pinimg.com') || img.type?.startsWith('image'))) {
            pins.push({
              imageUrl: img.url,
              title: truncate(img.alt || null, MAX_TITLE_LENGTH),
              sourceUrl: null,
              description: null,
            });
          }
        });
      }

      return {
        success: true,
        boardName: truncate(data.data.title || null, MAX_BOARD_NAME_LENGTH),
        boardUsername: null,
        pins,
        totalPins: pins.length,
      };
    }

    return {
      success: false,
      boardName: null,
      boardUsername: null,
      pins: [],
      totalPins: 0,
      error: 'Microlink API failed',
    };
  } catch (error) {
    return {
      success: false,
      boardName: null,
      boardUsername: null,
      pins: [],
      totalPins: 0,
      error: error instanceof Error ? error.message : 'Microlink API error',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { boardUrl, useMicrolink = false } = body;

    if (!boardUrl) {
      return NextResponse.json(
        { error: 'Board URL is required' },
        { status: 400 }
      );
    }

    // Validate Pinterest URL
    if (!boardUrl.includes('pinterest.')) {
      return NextResponse.json(
        { error: 'URL must be a valid Pinterest board URL' },
        { status: 400 }
      );
    }

    // Clean URL - remove trailing slash and query params
    const cleanUrl = boardUrl.split('?')[0].replace(/\/$/, '');

    let result: ScrapeResult;

    if (useMicrolink) {
      result = await scrapeWithMicrolink(cleanUrl);
    } else {
      // Try direct scraping first
      result = await scrapeBoardPage(cleanUrl);

      // If direct scraping fails or returns no pins, try Microlink
      if (!result.success || result.pins.length === 0) {
        console.log('Direct scraping failed, trying Microlink...');
        const microlinkResult = await scrapeWithMicrolink(cleanUrl);

        if (microlinkResult.success && microlinkResult.pins.length > 0) {
          result = microlinkResult;
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Pinterest scrape error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const boardUrl = searchParams.get('url');

  if (!boardUrl) {
    return NextResponse.json(
      { error: 'Board URL is required. Use ?url=https://pinterest.com/username/board-name' },
      { status: 400 }
    );
  }

  // Clean URL
  const cleanUrl = boardUrl.split('?')[0].replace(/\/$/, '');

  // Try direct scraping
  let result = await scrapeBoardPage(cleanUrl);

  // Fallback to Microlink if needed
  if (!result.success || result.pins.length === 0) {
    const microlinkResult = await scrapeWithMicrolink(cleanUrl);
    if (microlinkResult.success && microlinkResult.pins.length > 0) {
      result = microlinkResult;
    }
  }

  return NextResponse.json(result);
}
