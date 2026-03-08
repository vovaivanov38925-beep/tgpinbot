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

    // Method 1: Use Microlink API (free tier, no API key needed)
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
