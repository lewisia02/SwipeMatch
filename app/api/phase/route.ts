import { NextResponse } from 'next/server';
import { AppSettingsRepository } from '@/lib/repositories/AppSettingsRepository';
import { PhaseService } from '@/lib/services/PhaseService';

export async function GET() {
  const phaseService = new PhaseService(new AppSettingsRepository());

  try {
    const phase = await phaseService.getCurrentPhase();
    return NextResponse.json({ phase });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'エラーが発生しました。時間をおいて再度お試しください' },
      { status: 500 },
    );
  }
}
