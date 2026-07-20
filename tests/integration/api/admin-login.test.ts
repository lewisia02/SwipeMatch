import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_PASSWORD = 'test-admin-password';
const TEST_SECRET = 'test-admin-session-secret-value';

const { POST: postLogin } = await import('@/app/api/admin/login/route');

function loginRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_PASSWORD', TEST_PASSWORD);
    vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('正しいパスワードの場合、200を返しadmin_token Cookieをセットする', async () => {
    const response = await postLogin(loginRequest({ password: TEST_PASSWORD }));

    expect(response.status).toBe(200);
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('admin_token=');
    expect(setCookie).toContain('HttpOnly');
  });

  it('誤ったパスワードの場合、401を返す', async () => {
    const response = await postLogin(loginRequest({ password: 'wrong-password' }));

    expect(response.status).toBe(401);
  });

  it('パスワードが空の場合、400を返す', async () => {
    const response = await postLogin(loginRequest({ password: '' }));

    expect(response.status).toBe(400);
  });
});
