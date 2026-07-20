import { NextResponse, type NextRequest } from 'next/server';

const ANON_ID_COOKIE = 'anon_id';
// イベント想定期間（投稿〜結果発表まで）を通じて維持されれば十分なため24時間とする
const ANON_ID_MAX_AGE_SECONDS = 60 * 60 * 24;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.get(ANON_ID_COOKIE)) {
    response.cookies.set(ANON_ID_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: ANON_ID_MAX_AGE_SECONDS,
    });
  }

  return response;
}
