import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// Categories for Pinterest pins
const CATEGORIES = [
  { id: 'recipe', name: 'Рецепты', icon: 'ChefHat' },
  { id: 'fashion', name: 'Мода', icon: 'Shirt' },
  { id: 'diy', name: 'DIY & Крафт', icon: 'Wrench' },
  { id: 'travel', name: 'Путешествия', icon: 'Plane' },
  { id: 'fitness', name: 'Фитнес', icon: 'Dumbbell' },
  { id: 'beauty', name: 'Красота', icon: 'Sparkles' },
  { id: 'home', name: 'Дом & Интерьер', icon: 'Home' },
  { id: 'art', name: 'Искусство', icon: 'Palette' },
  { id: 'garden', name: 'Сад & Огород', icon: 'Flower2' },
  { id: 'wedding', name: 'Свадьба', icon: 'Heart' },
  { id: 'kids', name: 'Дети', icon: 'Baby' },
  { id: 'pets', name: 'Питомцы', icon: 'Cat' },
  { id: 'tech', name: 'Технологии', icon: 'Laptop' },
  { id: 'books', name: 'Книги', icon: 'BookOpen' },
  { id: 'other', name: 'Другое', icon: 'Sparkle' }
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, imageUrl } = body

    if (!title && !description && !imageUrl) {
      return NextResponse.json({ error: 'At least one of title, description, or imageUrl is required' }, { status: 400 })
    }

    const zai = await ZAI.create()

    // Create prompt for categorization
    const prompt = `Ты - помощник по категоризации Pinterest пинов. Проанализируй следующую информацию и определи наиболее подходящую категорию.

Доступные категории:
${CATEGORIES.map(c => `- ${c.id}: ${c.name}`).join('\n')}

Информация о пине:
${title ? `Название: ${title}` : ''}
${description ? `Описание: ${description}` : ''}

Ответь ТОЛЬКО в формате JSON без дополнительного текста:
{
  "category": "id_категории",
  "suggestedTitle": "улучшенное название на русском",
  "suggestedDescription": "краткое описание на русском",
  "tags": ["тег1", "тег2", "тег3"],
  "actionItems": ["действие1", "действие2"]
}`

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Ты - полезный ассистент, который категоризирует Pinterest пины и предлагает действия. Отвечай только валидным JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3
    })

    const content = completion.choices[0]?.message?.content
    
    if (!content) {
      return NextResponse.json({ error: 'Failed to generate categorization' }, { status: 500 })
    }

    try {
      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      
      const result = JSON.parse(jsonMatch[0])
      
      return NextResponse.json({
        ...result,
        categoryInfo: CATEGORIES.find(c => c.id === result.category) || CATEGORIES[CATEGORIES.length - 1]
      })
    } catch {
      // If parsing fails, return default
      return NextResponse.json({
        category: 'other',
        categoryInfo: CATEGORIES[CATEGORIES.length - 1],
        suggestedTitle: title || 'Без названия',
        suggestedDescription: description || '',
        tags: [],
        actionItems: []
      })
    }
  } catch (error) {
    console.error('Error categorizing:', error)
    return NextResponse.json({ error: 'Failed to categorize' }, { status: 500 })
  }
}

// GET - Get all available categories
export async function GET() {
  return NextResponse.json(CATEGORIES)
}
