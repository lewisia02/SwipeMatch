import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { DuplicateVoteError, PhaseMismatchError } from '@/lib/errors';
import { createVoteService } from '@/lib/services/container';
import { submitVotesSchema } from '@/lib/validators/voteSchema';

export async function POST(request: NextRequest) {
  const voteService = createVoteService();

  try {
    const anonId = request.cookies.get('anon_id')?.value;
    if (!anonId) {
      console.error('anon_id Cookieが存在しません');
      return NextResponse.json(
        { message: 'エラーが発生しました。時間をおいて再度お試しください' },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { logoIds } = submitVotesSchema.parse(body);

    await voteService.submitVotes(anonId, logoIds);

    return NextResponse.json({ success: true, votedCount: logoIds.length });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message }, { status: 400 });
    }
    if (error instanceof PhaseMismatchError) {
      const message = error.actualPhase === 'results' ? '投票は終了しました' : '投票は開始していません';
      return NextResponse.json({ message }, { status: 403 });
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
