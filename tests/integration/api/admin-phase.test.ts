import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'test-admin-session-secret-value';
const COMPETITION_ID = 'competition-1';

const mockCompetition = { currentPhase: 'submission' as 'submission' | 'voting' | 'results' };

function buildCompetition() {
  return {
    id: COMPETITION_ID,
    slug: 'x7k2p9',
    title: 'テストコンペ',
    status: 'active' as const,
    currentPhase: mockCompetition.currentPhase,
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    closedAt: null,
  };
}

vi.mock('@/lib/repositories/CompetitionRepository', () => {
  return {
    CompetitionRepository: vi.fn().mockImplementation(() => ({
      findById: vi.fn().mockImplementation(async (id: string) =>
        id === COMPETITION_ID ? buildCompetition() : null,
      ),
      updatePhase: vi.fn().mockImplementation(async (_id: string, phase: string) => {
        mockCompetition.currentPhase = phase as never;
        return buildCompetition();
      }),
    })),
  };
});

const { POST: postPhase } = await import('@/app/api/admin/competitions/[id]/phase/route');

async function buildValidToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(new TextEncoder().encode(TEST_SECRET));
}

function phaseRequest(body: unknown, cookie?: string) {
  return new NextRequest(`http://localhost/api/admin/competitions/${COMPETITION_ID}/phase`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
}

function idParams(id = COMPETITION_ID) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/admin/competitions/[id]/phase', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SECRET);
    mockCompetition.currentPhase = 'submission';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Cookieが存在しない場合、401を返す', async () => {
    const response = await postPhase(phaseRequest({ phase: 'voting' }), idParams());

    expect(response.status).toBe(401);
  });

  it('存在しないコンペIDの場合、404を返す', async () => {
    const token = await buildValidToken();

    const response = await postPhase(
      phaseRequest({ phase: 'voting' }, `admin_token=${token}`),
      idParams('unknown'),
    );

    expect(response.status).toBe(404);
  });

  it('逆行遷移の場合、400を返す', async () => {
    mockCompetition.currentPhase = 'results';
    const token = await buildValidToken();

    const response = await postPhase(
      phaseRequest({ phase: 'submission' }, `admin_token=${token}`),
      idParams(),
    );

    expect(response.status).toBe(400);
  });

  it('前方への遷移の場合、200を返しフェーズが切り替わる', async () => {
    const token = await buildValidToken();

    const response = await postPhase(
      phaseRequest({ phase: 'voting' }, `admin_token=${token}`),
      idParams(),
    );

    expect(response.status).toBe(200);
    expect(mockCompetition.currentPhase).toBe('voting');
  });

  it('不正なフェーズ値の場合、400を返す', async () => {
    const token = await buildValidToken();

    const response = await postPhase(
      phaseRequest({ phase: 'unknown' }, `admin_token=${token}`),
      idParams(),
    );

    expect(response.status).toBe(400);
  });
});
