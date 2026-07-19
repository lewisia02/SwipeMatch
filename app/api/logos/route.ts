import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { PhaseMismatchError } from '@/lib/errors';
import { AppSettingsRepository } from '@/lib/repositories/AppSettingsRepository';
import { LogoRepository } from '@/lib/repositories/LogoRepository';
import { createUploadService } from '@/lib/services/container';
import { PhaseService } from '@/lib/services/PhaseService';
import { createLogoSchema } from '@/lib/validators/uploadSchema';

export async function GET() {
  const phaseService = new PhaseService(new AppSettingsRepository());
  const logoRepository = new LogoRepository();

  try {
    await phaseService.assertPhase('voting');
    const logos = await logoRepository.findAll();
    // 投票画面では投稿者名を匿名化するため含めない
    return NextResponse.json({
      logos: logos.map((logo) => ({
        id: logo.id,
        imageUrl: logo.imageUrl,
        memo: logo.memo,
      })),
    });
  } catch (error) {
    if (error instanceof PhaseMismatchError) {
      return NextResponse.json({ message: '投票は開始していません' }, { status: 403 });
    }
    console.error(error);
    return NextResponse.json(
      { message: 'エラーが発生しました。時間をおいて再度お試しください' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const uploadService = createUploadService();

  try {
    const body = await request.json();
    const input = createLogoSchema.parse(body);

    const logo = await uploadService.createLogo(input);
    // 投票画面向けAPIと同様、レスポンスにも投稿者名は含めない
    return NextResponse.json({
      id: logo.id,
      imageUrl: logo.imageUrl,
      memo: logo.memo,
      createdAt: logo.createdAt,
    });
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
