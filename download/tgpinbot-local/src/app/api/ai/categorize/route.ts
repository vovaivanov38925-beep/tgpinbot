import { NextRequest, NextResponse } from 'next/server'

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

// Keywords for auto-categorization
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  recipe: ['рецепт', 'recipe', 'готовить', 'cook', 'еда', 'food', 'блюдо', 'кухня', 'kitchen', 'вкусно', 'delicious', 'завтрак', 'обед', 'ужин', 'dessert', 'десерт', 'cake', 'торт', 'салат'],
  fashion: ['мода', 'fashion', 'стиль', 'style', 'одежда', 'clothes', 'наряд', 'outfit', 'платье', 'dress', 'обувь', 'shoes', 'аксессуар', 'accessory'],
  diy: ['diy', 'своими руками', 'craft', 'мастерить', 'handmade', 'хобби', 'творчество', 'поделка', 'ремонт', 'fix'],
  travel: ['путешествие', 'travel', 'отпуск', 'vacation', 'страна', 'country', 'город', 'city', 'поездка', 'trip', 'туризм', 'tourism', 'отель', 'hotel'],
  fitness: ['фитнес', 'fitness', 'спорт', 'sport', 'тренировка', 'workout', 'гимнастика', 'gym', 'йога', 'yoga', 'бег', 'running', 'здоровье', 'health'],
  beauty: ['красота', 'beauty', 'макияж', 'makeup', 'косметика', 'кожа', 'skin', 'уход', 'care', 'волосы', 'hair', 'ногти', 'nails'],
  home: ['дом', 'home', 'интерьер', 'interior', 'дизайн', 'design', 'декор', 'decor', 'мебель', 'furniture', 'ремонт', 'renovation'],
  art: ['искусство', 'art', 'рисунок', 'drawing', 'живопись', 'painting', 'художник', 'artist', 'картина', 'picture', 'галерея', 'gallery'],
  garden: ['сад', 'garden', 'огород', 'растение', 'plant', 'цветы', 'flowers', 'дача', 'ландшафт', 'landscape'],
  wedding: ['свадьба', 'wedding', 'невеста', 'bride', 'жених', 'groom', 'торжество', 'кольцо', 'ring', 'венчание'],
  kids: ['дети', 'kids', 'ребенок', 'child', 'детский', 'baby', 'малыш', 'игрушки', 'toys', 'школа', 'school'],
  pets: ['питомец', 'pet', 'кот', 'cat', 'собака', 'dog', 'животное', 'animal', 'щенок', 'kitten'],
  tech: ['технологии', 'tech', 'гаджет', 'gadget', 'телефон', 'phone', 'компьютер', 'computer', 'приложение', 'app', 'программа'],
  books: ['книга', 'book', 'читать', 'read', 'библиотека', 'library', 'литература', 'literature', 'автор', 'author']
}

function categorizeByKeywords(title: string | null, description: string | null): string {
  const text = `${title || ''} ${description || ''}`.toLowerCase()
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return category
      }
    }
  }
  
  return 'other'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, imageUrl } = body

    // Categorize using keywords
    const category = categorizeByKeywords(title, description)
    
    return NextResponse.json({
      category,
      categoryInfo: CATEGORIES.find(c => c.id === category) || CATEGORIES[CATEGORIES.length - 1],
      suggestedTitle: title || 'Новый пин',
      suggestedDescription: description || '',
      tags: [],
      actionItems: []
    })

  } catch (error) {
    console.error('Error categorizing:', error)
    return NextResponse.json({ 
      category: 'other',
      categoryInfo: CATEGORIES[CATEGORIES.length - 1],
      suggestedTitle: 'Новый пин',
      suggestedDescription: '',
      tags: [],
      actionItems: []
    })
  }
}

// GET - Get all available categories
export async function GET() {
  return NextResponse.json(CATEGORIES)
}
