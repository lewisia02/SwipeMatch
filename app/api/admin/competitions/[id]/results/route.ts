import { NextResponse, type NextRequest } from 'next/server';
import { NotFoundError, PhaseMismatchError, UnauthorizedError } from '@/lib/errors';
import { requireAdminSession } from '@/lib/api/requireAdminSession';
import { createAdminService, createCompetitionService } from '@/lib/services/container';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminService = createAdminService();
  const competitionService = createCompetitionService();

  try {
    await requireAdminSession(request, adminService);

    const { id } = await params;
    await competitionService.findById(id);

    const results = await adminService.getRankedResults(id);

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error instanceof PhaseMismatchError) {
      return NextResponse.json({ message: '結果発表はまだ準備中です' }, { status: 403 });
    }
    console.error(error);
    return NextResponse.json(
      { message: 'エラーが発生しました。時間をおいて再度お試しください' },
      { status: 500 },
    );
  }
}
