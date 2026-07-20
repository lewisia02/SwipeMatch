import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { ADMIN_TOKEN_COOKIE } from '@/lib/api/requireAdminSession';
import { UnauthorizedError } from '@/lib/errors';
import { createAdminService } from '@/lib/services/container';
import { adminLoginSchema } from '@/lib/validators/adminSchema';

const ADMIN_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 4;

export async function POST(request: NextRequest) {
  const adminService = createAdminService();

  try {
    const body = await request.json();
    const { password } = adminLoginSchema.parse(body);

    const { token } = await adminService.login(password);

    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_TOKEN_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: 'パスワードが正しくありません' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json(
      { message: 'エラーが発生しました。時間をおいて再度お試しください' },
      { status: 500 },
    );
  }
}
