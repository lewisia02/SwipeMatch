import { NextResponse, type NextRequest } from 'next/server';
import { NotFoundError } from '@/lib/errors';
import { createCompetitionService } from '@/lib/services/container';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const competitionService = createCompetitionService();

  try {
    const { slug } = await params;
    const competition = await competitionService.findBySlug(slug);

    return NextResponse.json({ phase: competition.currentPhase });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json(
      { message: 'エラーが発生しました。時間をおいて再度お試しください' },
      { status: 500 },
    );
  }
}
