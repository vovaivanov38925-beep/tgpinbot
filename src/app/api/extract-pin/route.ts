import { NextRequest, NextResponse } from 'next/server'

// Extract image and metadata from Pinterest URL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Check if it's a direct image URL
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    const isDirectImage = imageExtensions.some(ext => url.toLowerCase().endsWith(ext)) ||
                          url.includes('/originals/') ||
                          url.includes('pinimg.com')

    if (isDirectImage) {
      return NextResponse.json({
        imageUrl: url,
        title: null,
        description: null,
        sourceUrl: url
      })
    }

    // Check if it's a Pinterest URL
    const isPinterestUrl = url.includes('pinterest.') || url.includes('pin.')
    
    if (!isPinterestUrl) {
      return NextResponse.json({ 
        error: 'Please enter a Pinterest URL or direct image URL',
        imageUrl: url,
        title: null,
        description: null,
        sourceUrl: url
      })
    }

    // Fetch the Pinterest page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch Pinterest page' }, { status: 500 })
    }

    const html = await response.text()

    // Extract Open Graph image
    let imageUrl = null
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
    if (ogImageMatch) {
      imageUrl = ogImageMatch[1]
    }

    // Try another pattern for og:image
    if (!imageUrl) {
      const ogImageMatch2 = html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i)
      if (ogImageMatch2) {
        imageUrl = ogImageMatch2[1]
      }
    }

    // Extract title
    let title = null
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
    if (ogTitleMatch) {
      title = ogTitleMatch[1]
    }
    if (!title) {
      const ogTitleMatch2 = html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/i)
      if (ogTitleMatch2) {
        title = ogTitleMatch2[1]
      }
    }

    // Extract description
    let description = null
    const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)
    if (ogDescMatch) {
      description = ogDescMatch[1]
    }
    if (!description) {
      const ogDescMatch2 = html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:description"/i)
      if (ogDescMatch2) {
        description = ogDescMatch2[1]
      }
    }

    // Try to find the main pin image from various patterns
    if (!imageUrl) {
      const pinMediaMatch = html.match(/data-pin-media="([^"]+)"/i)
      if (pinMediaMatch) {
        imageUrl = pinMediaMatch[1]
      }
    }

    if (!imageUrl) {
      const pinFullImgMatch = html.match(/class="[^"]*pinImage[^"]*"[^>]*src="([^"]+)"/i)
      if (pinFullImgMatch) {
        imageUrl = pinFullImgMatch[1]
      }
    }

    if (!imageUrl) {
      const imgMatches = html.matchAll(/<img[^>]*src="(https:\/\/i\.pinimg\.com\/[^"]+)"[^>]*>/gi)
      for (const match of imgMatches) {
        if (match[1] && !match[1].includes('/150x150/') && !match[1].includes('/60x60/') && !match[1].includes('/56x56/')) {
          imageUrl = match[1]
          break
        }
      }
    }

    if (!imageUrl) {
      return NextResponse.json({ 
        error: 'Could not extract image from Pinterest URL. Try pasting the direct image URL.',
        imageUrl: null,
        title,
        description,
        sourceUrl: url
      }, { status: 400 })
    }

    return NextResponse.json({
      imageUrl,
      title,
      description,
      sourceUrl: url
    })

  } catch (error) {
    console.error('Error extracting pin:', error)
    return NextResponse.json({ error: 'Failed to extract pin data' }, { status: 500 })
  }
}