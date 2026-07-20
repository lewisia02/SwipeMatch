import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'test-admin-session-secret-value';

const mockAppSettings = { currentPhase: 'submission' as 'submission' | 'voting' | 'results' };

vi.mock('@/lib/repositories/AppSettingsRepository', () => {
  return {
    AppSettingsRepository: vi.fn().mockImplementation(() => ({
      get: vi.fn().mockImplementation(async () => ({
        id: 'singleton',
        currentPhase: mockAppSettings.currentPhase,
        updatedAt: new Date(),
      })),
      updatePhase: vi.fn().mockImplementation(async (phase: string) => {
        mockAppSettings.currentPhase = phase as never;
      }),
    })),
  };
});

const { POST: postPhase } = await import('@/app/api/admin/phase/route');

async function buildValidToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(new TextEncoder().encode(TEST_SECRET));
}

function phaseRequest(body: unknown, cookie?: string) {
  return new NextRequest('http://localhost/api/admin/phase', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
}

describe('POST /api/admin/phase', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SECRET);
    mockAppSettings.currentPhase = 'submission';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Cookieが存在しない場合、401を返す', async () => {
    const response = await postPhase(phaseRequest({ phase: 'voting' }));

    expect(response.status).toBe(401);
  });

  it('逆行遷移の場合、400を返す', async () => {
    mockAppSettings.currentPhase = 'results';
    const token = await buildValidToken();

    const response = await postPhase(
      phaseRequest({ phase: 'submission' }, `admin_token=${token}`),
    );

    expect(response.status).toBe(400);
  });

  it('前方への遷移の場合、200を返しフェーズが切り替わる', async () => {
    const token = await buildValidToken();

    const response = await postPhase(phaseRequest({ phase: 'voting' }, `admin_token=${token}`));

    expect(response.status).toBe(200);
    expect(mockAppSettings.currentPhase).toBe('voting');
  });

  it('不正なフェーズ値の場合、400を返す', async () => {
    const token = await buildValidToken();

    const response = await postPhase(phaseRequest({ phase: 'unknown' }, `admin_token=${token}`));

    expect(response.status).toBe(400);
  });
});
