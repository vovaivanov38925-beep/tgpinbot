import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Category keywords for auto-categorization
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Recipe': ['recipe', 'food', 'cook', 'bake', 'kitchen', 'meal', 'dinner', 'breakfast', 'lunch', 'dessert', 'cake', 'cookie', 'bread', 'soup', 'salad', 'pasta', 'pizza', 'smoothie', 'cocktail', 'drink', 'рецепт', 'еда', 'готовить', 'пирог', 'торт', 'салат', 'суп'],
  'Fashion': ['fashion', 'style', 'outfit', 'dress', 'shoes', 'bag', 'accessories', 'jewelry', 'clothing', 'wear', 'look', 'мода', 'стиль', 'наряд', 'платье', 'обувь'],
  'DIY & Craft': ['diy', 'craft', 'handmade', 'tutorial', 'how to', 'make', 'create', 'project', 'своими руками', 'поделка', 'мастер-класс'],
  'Travel': ['travel', 'trip', 'vacation', 'destination', 'hotel', 'flight', 'beach', 'mountain', 'city', 'country', 'tourism', 'путешествие', 'отпуск', 'страна', 'город'],
  'Fitness': ['fitness', 'workout', 'exercise', 'gym', 'yoga', 'health', 'training', 'muscle', 'weight', 'diet', 'фитнес', 'тренировка', 'йога', 'здоровье'],
  'Beauty': ['beauty', 'makeup', 'skincare', 'hair', 'nails', 'cosmetic', 'spa', 'красота', 'макияж', 'кожа', 'волосы'],
  'Home & Interior': ['home', 'interior', 'design', 'decor', 'furniture', 'room', 'bedroom', 'bathroom', 'kitchen', 'living', 'дом', 'интерьер', 'дизайн', 'декор', 'мебель'],
  'Art': ['art', 'painting', 'drawing', 'illustration', 'artist', 'gallery', 'creative', 'искусство', 'живопись', 'рисунок'],
  'Garden': ['garden', 'plant', 'flower', 'outdoor', 'landscape', 'nature', 'green', 'сад', 'растение', 'цветок'],
  'Wedding': ['wedding', 'bride', 'groom', 'marriage', 'ceremony', 'ring', 'свадьба', 'невеста', 'жених'],
  'Kids': ['kids', 'children', 'baby', 'toy', 'play', 'school', 'дети', 'ребенок', 'игрушка'],
  'Pets': ['pet', 'dog', 'cat', 'animal', 'puppy', 'kitten', 'питомец', 'собака', 'кошка', 'животное'],
  'Technology': ['tech', 'technology', 'gadget', 'phone', 'computer', 'app', 'software', 'digital', 'технологии', 'гаджет', 'приложение'],
  'Books': ['book', 'read', 'library', 'author', 'novel', 'story', 'книга', 'читать', 'библиотека'],
};

function categorizePin(title: string | null, description: string | null): string | null {
  const text = `${title || ''} ${description || ''}`.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  return 'Other';
}

// Sync pins from a board to user's collection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, boardUrl, pins, boardName, boardUsername } = body;

    if (!userId || !boardUrl || !pins || !Array.isArray(pins)) {
      return NextResponse.json(
        { error: 'userId, boardUrl, and pins array are required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Clean board URL
    const cleanBoardUrl = boardUrl.split('?')[0].replace(/\/$/, '');

    // Get existing pins for this user (by image URL)
    const existingPins = await prisma.pin.findMany({
      where: { userId },
      select: { imageUrl: true },
    });
    const existingUrls = new Set(existingPins.map(p => p.imageUrl));

    // Get or create PinterestBoard record
    let pinterestBoard = await prisma.pinterestBoard.findUnique({
      where: {
        userId_boardUrl: {
          userId,
          boardUrl: cleanBoardUrl,
        },
      },
    });

    if (!pinterestBoard) {
      pinterestBoard = await prisma.pinterestBoard.create({
        data: {
          userId,
          boardUrl: cleanBoardUrl,
          boardName,
          boardUsername,
        },
      });
    }

    // Filter out already existing pins
    const newPins = pins.filter((pin: any) => !existingUrls.has(pin.imageUrl));

    // Create new pins
    const createdPins: Array<{ points: number }> = [];
    for (const pin of newPins) {
      try {
        const category = categorizePin(pin.title, pin.description);

        const newPin = await prisma.pin.create({
          data: {
            userId,
            imageUrl: pin.imageUrl,
            title: pin.title,
            description: pin.description,
            sourceUrl: pin.sourceUrl || cleanBoardUrl,
            category,
            points: user.isPremium ? 20 : 10, // Premium gets 2x points
          },
        });

        createdPins.push(newPin);
      } catch (e) {
        console.error('Failed to create pin:', e);
      }
    }

    // Calculate points earned
    const pointsEarned = createdPins.reduce((sum, pin) => sum + pin.points, 0);

    // Update user points if any pins were added
    if (pointsEarned > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          points: { increment: pointsEarned },
        },
      });
    }

    // Update PinterestBoard record
    await prisma.pinterestBoard.update({
      where: { id: pinterestBoard.id },
      data: {
        boardName,
        boardUsername,
        lastSyncAt: new Date(),
        totalPins: pins.length,
        newPins: createdPins.length,
      },
    });

    return NextResponse.json({
      success: true,
      totalPins: pins.length,
      existingPins: pins.length - newPins.length,
      newPinsAdded: createdPins.length,
      pointsEarned,
      board: {
        id: pinterestBoard.id,
        name: boardName,
        url: cleanBoardUrl,
      },
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Get user's synced boards
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const boards = await prisma.pinterestBoard.findMany({
      where: { userId },
      orderBy: { lastSyncAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      boards,
    });
  } catch (error) {
    console.error('Get boards error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Delete a synced board
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { boardId, userId } = body;

    if (!boardId || !userId) {
      return NextResponse.json(
        { error: 'boardId and userId are required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const board = await prisma.pinterestBoard.findFirst({
      where: { id: boardId, userId },
    });

    if (!board) {
      return NextResponse.json(
        { error: 'Board not found or not owned by user' },
        { status: 404 }
      );
    }

    await prisma.pinterestBoard.delete({
      where: { id: boardId },
    });

    return NextResponse.json({
      success: true,
      message: 'Board removed from sync',
    });
  } catch (error) {
    console.error('Delete board error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
