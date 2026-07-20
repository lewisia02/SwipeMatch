import { NextResponse, type NextRequest } from 'next/server';
import { PhaseMismatchError, UnauthorizedError } from '@/lib/errors';
import { requireAdminSession } from '@/lib/api/requireAdminSession';
import { createAdminService } from '@/lib/services/container';

export async function GET(request: NextRequest) {
  const adminService = createAdminService();

  try {
    await requireAdminSession(request, adminService);

    const csv = await adminService.exportResultsCsv();

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="results.csv"',
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
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
