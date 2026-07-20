import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { UnauthorizedError, ValidationError } from '@/lib/errors';
import { requireAdminSession } from '@/lib/api/requireAdminSession';
import { createAdminService } from '@/lib/services/container';
import { adminPhaseSchema } from '@/lib/validators/adminSchema';

export async function POST(request: NextRequest) {
  const adminService = createAdminService();

  try {
    await requireAdminSession(request, adminService);

    const body = await request.json();
    const { phase } = adminPhaseSchema.parse(body);

    await adminService.setPhase(phase);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
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
