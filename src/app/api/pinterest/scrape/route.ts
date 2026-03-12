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
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
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
    // Fetch the board page
    const response = await fetch(boardUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
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
      success: true,
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

  // Method 3: Extract from data-pin-id attributes
  const pinIdRegex = /data-pin-id="([^"]+)"/g;
  let pinIdMatch;
  const pinIds: string[] = [];
  while ((pinIdMatch = pinIdRegex.exec(html)) !== null) {
    pinIds.push(pinIdMatch[1]);
  }

  // Method 4: Extract pin URLs and titles from anchor tags
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

  return pins;
}

// Extract pins from Pinterest's embedded JSON data
function extractPinsFromPwsData(data: any): ScrapedPin[] {
  const pins: ScrapedPin[] = [];

  function traverse(obj: any) {
    if (!obj || typeof obj !== 'object') return;

    // Look for pin objects
    if (obj.id && obj.images) {
      const images = obj.images;
      let imageUrl = null;

      // Try different image sizes
      if (images.orig?.url) {
        imageUrl = images.orig.url;
      } else if (images['564x']?.url) {
        imageUrl = images['564x'].url.replace('/564x/', '/originals/');
      } else if (images['474x']?.url) {
        imageUrl = images['474x'].url.replace('/474x/', '/originals/');
      }

      if (imageUrl) {
        pins.push({
          imageUrl,
          title: obj.title || obj.grid_title || null,
          sourceUrl: obj.link || (obj.id ? `https://pinterest.com/pin/${obj.id}` : null),
          description: obj.description || obj.grid_description || null,
        });
      }
    }

    // Traverse nested objects
    if (Array.isArray(obj)) {
      obj.forEach(traverse);
    } else {
      Object.values(obj).forEach(traverse);
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
