import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import {
  DuplicateVoteError,
  NotFoundError,
  PhaseMismatchError,
  RunoffNotEligibleError,
  RunoffNotOpenError,
  ValidationError,
} from '@/lib/errors';
import { createCompetitionService, createVoteService } from '@/lib/services/container';
import { submitRunoffVoteSchema } from '@/lib/validators/voteSchema';

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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

    const body = await request.json();
    const { logoId } = submitRunoffVoteSchema.parse(body);

    await voteService.submitRunoffVote(competition.id, anonId, logoId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error instanceof PhaseMismatchError) {
      return NextResponse.json({ message: 'ランオフ投票の受付期間ではありません' }, { status: 403 });
    }
    if (error instanceof RunoffNotOpenError || error instanceof RunoffNotEligibleError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof DuplicateVoteError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json(
      { message: 'エラーが発生しました。時間をおいて再度お試しください' },
      { status: 500 },
    );
  }
}
