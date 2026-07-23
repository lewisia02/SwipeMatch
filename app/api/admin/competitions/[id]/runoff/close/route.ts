import { NextResponse, type NextRequest } from 'next/server';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { requireAdminSession } from '@/lib/api/requireAdminSession';
import { createAdminService, createCompetitionService } from '@/lib/services/container';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminService = createAdminService();
  const competitionService = createCompetitionService();

  try {
    await requireAdminSession(request, adminService);

    const { id } = await params;
    await competitionService.findById(id);

    const result = await adminService.closeRunoff(id);

    return NextResponse.json({ success: true, resolved: result.resolved });
  } catch (error) {
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
