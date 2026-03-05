import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, imageBase64, duration = 10, fps = 30, quality = 'speed' } = body;

    const zai = await ZAI.create();

    const params: Record<string, unknown> = {
      prompt: prompt,
      quality: quality,
      duration: duration,
      fps: fps,
      size: '720x1440'
    };

    if (imageBase64) {
      params.image_url = imageBase64;
    }

    const task = await zai.video.generations.create(params);

    return NextResponse.json({
      success: true,
      taskId: task.id,
      status: task.task_status
    });
  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const zai = await ZAI.create();
    const result = await zai.async.result.query(taskId);

    const response: Record<string, unknown> = {
      taskId,
      status: result.task_status
    };

    if (result.task_status === 'SUCCESS') {
      const videoUrl = (result as Record<string, unknown>).video_result?.[0]?.url ||
                      (result as Record<string, unknown>).video_url ||
                      (result as Record<string, unknown>).url;
      response.videoUrl = videoUrl;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Video status error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
