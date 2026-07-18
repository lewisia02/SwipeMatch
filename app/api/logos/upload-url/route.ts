import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { PhaseMismatchError } from '@/lib/errors';
import { createUploadService } from '@/lib/services/container';
import { createUploadUrlSchema } from '@/lib/validators/uploadSchema';

export async function POST(request: NextRequest) {
  const uploadService = createUploadService();

  try {
    const body = await request.json();
    const { contentType } = createUploadUrlSchema.parse(body);

    const result = await uploadService.createUploadUrl(contentType);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message }, { status: 400 });
    }
    if (error instanceof PhaseMismatchError) {
      return NextResponse.json({ message: '現在は投稿を受け付けていません' }, { status: 403 });
    }
    console.error(error);
    return NextResponse.json(
      { message: 'エラーが発生しました。時間をおいて再度お試しください' },
      { status: 500 },
    );
  }
}
