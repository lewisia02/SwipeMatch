import { NextResponse, type NextRequest } from 'next/server';
import { NotFoundError } from '@/lib/errors';
import { createCompetitionService, createVoteService } from '@/lib/services/container';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const competitionService = createCompetitionService();
  const voteService = createVoteService();

  try {
    const { slug } = await params;
    const competition = await competitionService.findBySlug(slug);

    const anonId = request.cookies.get('anon_id')?.value;
    if (!anonId) {
      console.error('anon_id Cookieが存在しません');
      return NextResponse.json(
        { message: 'エラーが発生しました。時間をおいて再度お試しください' },
        { status: 500 },
      );
    }

    const status = await voteService.getRunoffStatus(competition.id, anonId);

    return NextResponse.json({
      round: status.round,
      logos: status.logos.map((logo) => ({ id: logo.id, imageUrl: logo.imageUrl, memo: logo.memo })),
      eligible: status.eligible,
      alreadyVoted: status.alreadyVoted,
    });
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
