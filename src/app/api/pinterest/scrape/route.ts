import { NextRequest, NextResponse } from 'next/server';

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

  // Method 1: Look for pin data in embedded JSON (most reliable)
  try {
    // Pinterest embeds data in <script id="__PWS_DATA__" type="application/json">
    const pwsDataMatch = html.match(/<script id="__PWS_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (pwsDataMatch) {
      const jsonData = JSON.parse(pwsDataMatch[1]);
      const extractedFromJson = extractPinsFromPwsData(jsonData);
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

  // Method 2: Look for pin images in HTML (fallback)
  // Match i.pinimg.com URLs in various formats
  const pinImgRegex = /https?:\/\/i\.pinimg\.com\/[^"'\s]+\.(jpg|jpeg|png|gif|webp)/gi;
  const imgMatches = html.match(pinImgRegex) || [];

  imgMatches.forEach(url => {
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
  
  console.log(`[Pinterest] Found ${imgMatches.length} image URLs in HTML, total unique: ${pins.length}`);

  // Method 3: Extract pin URLs and titles from anchor tags
  const pinLinkRegex = /<a[^>]*href="\/pin\/(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let linkMatch;
  while ((linkMatch = pinLinkRegex.exec(html)) !== null) {
    const pinId = linkMatch[1];
    const linkContent = linkMatch[2];

    // Extract title from alt or title attribute
    const titleMatch = linkContent.match(/alt="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : null;

    // Extract image URL from the link content
    const imgMatch = linkContent.match(/https?:\/\/i\.pinimg\.com\/[^"'\s]+\.(jpg|jpeg|png|gif|webp)/i);
    if (imgMatch) {
      const originalUrl = imgMatch[0].replace(/\/\d+x\d*\//, '/originals/');
      if (!seenUrls.has(originalUrl)) {
        seenUrls.add(originalUrl);
        pins.push({
          imageUrl: originalUrl,
          title,
          sourceUrl: `https://pinterest.com/pin/${pinId}`,
          description: null,
        });
      }
    }
  }

  // Method 4: Extract from data-test-pin-id and other attributes
  const dataPinRegex = /data-test-pin-id="([^"]+)"/g;
  let dataPinMatch;
  while ((dataPinMatch = dataPinRegex.exec(html)) !== null) {
    const pinId = dataPinMatch[1];
    // Construct image URL from pin ID if not already found
    const possibleUrl = `https://i.pinimg.com/originals/${pinId.slice(0, 2)}/${pinId.slice(2, 4)}/${pinId.slice(4, 6)}/${pinId}.jpg`;
    // This is a guess, Pinterest doesn't have a predictable URL pattern from ID alone
  }

  console.log(`[Pinterest] Total pins extracted: ${pins.length}`);
  return pins;
}

// Extract pins from Pinterest's embedded JSON data
function extractPinsFromPwsData(data: any): ScrapedPin[] {
  const pins: ScrapedPin[] = [];
  const seenIds = new Set<string>();

  function traverse(obj: any, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 20) return;

    // Look for pin objects with images
    if (obj.id && (obj.images || obj.image_url || obj.image)) {
      if (seenIds.has(obj.id)) return;
      seenIds.add(obj.id);

      let imageUrl = null;

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
          title: obj.title || obj.grid_title || obj.name || null,
          sourceUrl: obj.link || (obj.id ? `https://pinterest.com/pin/${obj.id}` : null),
          description: obj.description || obj.grid_description || obj.text || null,
        });
      }
    }

    // Also look for thumbnail/url patterns
    if (obj.url && typeof obj.url === 'string' && obj.url.includes('pinimg.com')) {
      const imageUrl = obj.url.replace(/\/\d+x\d*\//, '/originals/');
      if (!pins.find(p => p.imageUrl === imageUrl)) {
        pins.push({
          imageUrl,
          title: obj.title || obj.name || null,
          sourceUrl: obj.source_url || null,
          description: obj.description || null,
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
    return ogTitleMatch[1].replace(' | Pinterest', '').trim();
  }

  // Try h1 tag
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // Try title tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    return titleMatch[1].split('|')[0].trim();
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
              title: img.alt || null,
              sourceUrl: null,
              description: null,
            });
          }
        });
      }

      return {
        success: true,
        boardName: data.data.title || null,
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
