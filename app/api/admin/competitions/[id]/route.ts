import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { requireAdminSession } from '@/lib/api/requireAdminSession';
import { createAdminService, createCompetitionService } from '@/lib/services/container';
import { deleteCompetitionSchema } from '@/lib/validators/competitionSchema';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminService = createAdminService();
  const competitionService = createCompetitionService();

  try {
    await requireAdminSession(request, adminService);

    const { id } = await params;
    const competition = await competitionService.findById(id);

    const body = await request.json();
    const { title } = deleteCompetitionSchema.parse(body);

    if (title !== competition.title) {
      return NextResponse.json({ message: '確認文字列が一致しません' }, { status: 400 });
    }

    await competitionService.remove(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { message: 'エラーが発生しました。時間をおいて再度お試しください' },
      { status: 500 },
    );
  }
}
