import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface ImportPin {
  imageUrl: string;
  title: string | null;
  description: string | null;
  sourceUrl: string | null;
}

interface ImportRequest {
  telegramId: string;
  boardName: string | null;
  boardUsername: string | null;
  boardUrl: string | null;
  pins: ImportPin[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportRequest = await request.json();
    const { telegramId, boardName, boardUsername, boardUrl, pins } = body;

    console.log('[Import] Received:', { telegramId, boardName, boardUrl, pinsCount: pins?.length || 0 });

    if (!telegramId || !pins || pins.length === 0) {
      return NextResponse.json(
        { error: 'telegramId and pins are required' },
        { status: 400 }
      );
    }

    // Find user by telegramId
    const user = await db.user.findUnique({
      where: { telegramId: String(telegramId) },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('[Import] User found:', user.id);

    // Get existing pins to avoid duplicates
    const existingPins = await db.pin.findMany({
      where: { userId: user.id },
      select: { imageUrl: true },
    });
    const existingUrls = new Set(existingPins.map(p => p.imageUrl));

    // Filter out duplicates
    const newPins = pins.filter(pin => !existingUrls.has(pin.imageUrl));

    console.log('[Import] New pins to add:', newPins.length, 'Duplicates skipped:', pins.length - newPins.length);

    if (newPins.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All pins already exist',
        imported: 0,
        skipped: pins.length,
      });
    }

    // Create pins one by one (safer than batch for schema changes)
    let imported = 0;

    for (const pin of newPins) {
      try {
        await db.pin.create({
          data: {
            userId: user.id,
            imageUrl: pin.imageUrl,
            title: pin.title,
            description: pin.description,
            sourceUrl: pin.sourceUrl,
            // Try to save boardUrl if field exists
            ...(boardUrl ? { boardUrl } : {}),
            category: boardName || boardUsername || null,
          },
        });
        imported++;
      } catch (e: any) {
        // Skip if field doesn't exist or duplicate
        if (!e.message?.includes('Unique constraint') && !e.message?.includes('already exists')) {
          console.log('[Import] Skipped pin:', e.message?.substring(0, 50));
        }
      }
    }

    console.log('[Import] Complete. Imported:', imported);

    return NextResponse.json({
      success: true,
      message: `Imported ${imported} pins`,
      imported,
      skipped: pins.length - newPins.length,
      boardName,
      boardUrl,
    });

  } catch (error) {
    console.error('[Import] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
