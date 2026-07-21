import { NextResponse } from 'next/server';
import { createCompetitionService } from '@/lib/services/container';

export async function GET() {
  const competitionService = createCompetitionService();

  try {
    const competition = await competitionService.findActive();
    if (!competition) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json({ slug: competition.slug });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'エラーが発生しました。時間をおいて再度お試しください' },
      { status: 500 },
    );
  }
}
