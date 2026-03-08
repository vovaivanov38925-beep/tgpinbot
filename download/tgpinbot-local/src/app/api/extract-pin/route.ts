import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json({ error: 'URL обязателен' }, { status: 400 })
    }

    // Direct image URL check
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    const lowerUrl = url.toLowerCase()
    const isDirectImage = imageExtensions.some(ext => lowerUrl.endsWith(ext)) ||
                          url.includes('pinimg.com') ||
                          url.includes('/originals/')

    if (isDirectImage) {
      return NextResponse.json({
        imageUrl: url,
        title: null,
        description: null,
        sourceUrl: url
      })
    }

    // Not Pinterest URL - just return as-is
    if (!url.includes('pinterest') && !url.includes('pin.')) {
      return NextResponse.json({ 
        imageUrl: url,
        title: null,
        description: null,
        sourceUrl: url
      })
    }

    let imageUrl: string | null = null
    let title: string | null = null
    let description: string | null = null

    // Method 0: Direct HTML parsing with proper headers (most reliable)
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
        }
      })
      
      if (response.ok) {
        const html = await response.text()
        
        // Extract Pinterest image URLs from HTML
        const pinimgMatches = html.match(/https:\/\/i\.pinimg\.com\/[^"'\s)]+/g)
        if (pinimgMatches && pinimgMatches.length > 0) {
          // Count occurrences of each URL
          const urlCounts = new Map<string, number>()
          pinimgMatches.forEach(u => {
            // Normalize URL (remove size prefix to get base)
            const normalized = u.replace(/\/\d+x\//, '/originals/')
            urlCounts.set(normalized, (urlCounts.get(normalized) || 0) + 1)
          })
          
          // Find the most repeated image (likely the main pin image)
          let bestUrl: string | null = null
          let maxCount = 0
          urlCounts.forEach((count, u) => {
            // Skip small icons and UI elements (usually .png UI graphics)
            if (u.endsWith('.png') && count < 3) return
            if (count > maxCount) {
              maxCount = count
              bestUrl = u
            }
          })
          
          // Fallback: prefer .jpg over .png for actual photos
          if (!bestUrl) {
            const jpgs = pinimgMatches.filter(u => u.includes('.jpg'))
            if (jpgs.length > 0) {
              bestUrl = jpgs[0].replace(/\/\d+x\//, '/originals/')
            }
          }
          
          // Last resort: use first non-png or first found
          if (!bestUrl) {
            bestUrl = pinimgMatches.find(u => !u.endsWith('.png')) || pinimgMatches[0]
            bestUrl = bestUrl.replace(/\/\d+x\//, '/originals/')
          }
          
          imageUrl = bestUrl
        }
        
        // Extract og:image as fallback
        if (!imageUrl) {
          const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                              html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
          if (ogImageMatch) {
            imageUrl = ogImageMatch[1]
              .replace('/236x/', '/originals/')
              .replace('/474x/', '/originals/')
              .replace('/564x/', '/originals/')
          }
        }
        
        // Extract title
        const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                            html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
        if (ogTitleMatch) {
          title = ogTitleMatch[1]
        }
        
        // Extract description
        const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)
        if (ogDescMatch) {
          description = ogDescMatch[1]
        }
      }
    } catch (e) {
      console.log('Direct HTML parsing failed:', e)
    }

    // Method 1: Use Microlink API (free tier, no API key needed)
    if (!imageUrl) {
      try {
        const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&data=image,title,description`
        const response = await fetch(microlinkUrl, {
          headers: { 'Accept': 'application/json' }
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.status === 'success' && data.data) {
            if (data.data.image) {
              imageUrl = data.data.image.url || data.data.image
              // Convert to highest quality Pinterest image
              if (imageUrl && imageUrl.includes('pinimg.com')) {
                imageUrl = imageUrl
                  .replace('/236x/', '/originals/')
                  .replace('/474x/', '/originals/')
                  .replace('/564x/', '/originals/')
                  .replace('/345x/', '/originals/')
              }
            }
            if (data.data.title && !data.data.title.includes('Pinterest')) {
              title = data.data.title
            }
            if (data.data.description) {
              description = data.data.description
            }
          }
        }
      } catch (e) {
        console.log('Microlink failed:', e)
      }
    }

    // Method 2: Pinterest oEmbed API
    if (!imageUrl) {
      const pinIdMatch = url.match(/pin\/(\d+)/)
      if (pinIdMatch) {
        try {
          const oembedUrl = `https://api.pinterest.com/v3_oembed?url=https://www.pinterest.com/pin/${pinIdMatch[1]}/`
          const response = await fetch(oembedUrl, {
            headers: { 'Accept': 'application/json' }
          })
          if (response.ok) {
            const data = await response.json()
            if (data.thumbnail_url) {
              imageUrl = data.thumbnail_url
                .replace('/236x/', '/originals/')
                .replace('/474x/', '/originals/')
                .replace('/564x/', '/originals/')
            }
            if (data.title && !title) {
              title = data.title
            }
          }
        } catch (e) {
          console.log('oEmbed failed')
        }
      }
    }

    // Method 3: Pinterest Widget API
    if (!imageUrl) {
      const pinIdMatch = url.match(/pin\/(\d+)/)
      if (pinIdMatch) {
        try {
          const widgetUrl = `https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinIdMatch[1]}`
          const response = await fetch(widgetUrl, {
            headers: { 'Accept': 'application/json' }
          })
          if (response.ok) {
            const data = await response.json()
            const pin = data.data?.[0]
            if (pin?.images) {
              imageUrl = pin.images.orig?.url || 
                        pin.images['564x']?.url ||
                        Object.values(pin.images)[0]?.url
            }
            if (pin?.title && !title) {
              title = pin.title
            }
            if (pin?.description && !description) {
              description = pin.description
            }
          }
        } catch (e) {
          console.log('Widget API failed')
        }
      }
    }

    // Method 4: Try opengraph.io (free tier)
    if (!imageUrl) {
      try {
        const ogUrl = `https://opengraph.io/api/1.1/site/${encodeURIComponent(url)}?app_id=pinterest-bot`
        const response = await fetch(ogUrl)
        if (response.ok) {
          const data = await response.json()
          if (data.openGraph?.image) {
            imageUrl = data.openGraph.image
              .replace('/236x/', '/originals/')
              .replace('/474x/', '/originals/')
          }
          if (data.openGraph?.title && !title) {
            title = data.openGraph.title
          }
          if (data.openGraph?.description && !description) {
            description = data.openGraph.description
          }
        }
      } catch (e) {
        console.log('Opengraph failed')
      }
    }

    if (!imageUrl) {
      return NextResponse.json({ 
        error: 'Не удалось извлечь изображение. Попробуйте другую ссылку.',
        imageUrl: null,
        title,
        description: null,
        sourceUrl: url
      }, { status: 400 })
    }

    // Filter out Pinterest template descriptions
    const filteredDescription = description ? 
      description.replace(/\s*\|\s*Pinterest\s*$/i, '')
                 .replace(/\s*\|\s*Discover.*Pinterest\s*$/i, '')
                 .replace(/^This Pin was discovered by.*Discover \(and save!\) your own Pins on Pinterest\.?$/i, '')
                 .replace(/^Discover \(and save!\) your own Pins on Pinterest\.?$/i, '')
                 .trim() : null

    // If description became empty after filtering, set to null
    const finalDescription = filteredDescription && filteredDescription.length > 5 ? filteredDescription : null

    // Clean up title - remove "Pin on" prefix and Pinterest suffixes
    let finalTitle = title ? 
      title.replace(/^Pin on\s+/i, '')
           .replace(/\s*\|\s*Pinterest\s*$/i, '')
           .replace(/\s*-\s*Pinterest\s*$/i, '')
           .trim() : null

    // If title became empty, set to null
    if (finalTitle && finalTitle.length < 3) {
      finalTitle = null
    }

    return NextResponse.json({ 
      imageUrl, 
      title: finalTitle, 
      description: finalDescription, 
      sourceUrl: url 
    })

  } catch (error) {
    console.error('Extract error:', error)
    return NextResponse.json({ 
      error: 'Ошибка извлечения',
      imageUrl: null,
      title: null,
      description: null,
      sourceUrl: null
    }, { status: 500 })
  }
}
