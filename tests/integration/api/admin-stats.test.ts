import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'test-admin-session-secret-value';
const COMPETITION_ID = 'competition-1';

function buildCompetition() {
  return {
    id: COMPETITION_ID,
    slug: 'x7k2p9',
    title: 'テストコンペ',
    status: 'active' as const,
    currentPhase: 'voting' as const,
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
      updatePhase: vi.fn(),
    })),
  };
});

vi.mock('@/lib/repositories/LogoRepository', () => {
  return {
    LogoRepository: vi.fn().mockImplementation(() => ({
      findAllByCompetitionId: vi.fn().mockResolvedValue([
        {
          id: 'logo-1',
          competitionId: COMPETITION_ID,
          imageUrl: 'https://example.com/logos/1.jpg',
          uploaderName: '山田太郎',
          memo: 'メモ1',
          createdAt: new Date('2026-07-18T00:00:00.000Z'),
        },
      ]),
      create: vi.fn(),
      delete: vi.fn(),
      createSignedUploadUrl: vi.fn(),
      deleteStorageObject: vi.fn(),
      getPublicUrl: vi.fn(),
    })),
  };
});

vi.mock('@/lib/repositories/VoteRepository', () => {
  return {
    VoteRepository: vi.fn().mockImplementation(() => ({
      countByLogoId: vi.fn(),
      countVoters: vi.fn().mockResolvedValue(4),
      countTotal: vi.fn().mockResolvedValue(9),
      reserveVoteSlot: vi.fn(),
      releaseVoteSlot: vi.fn(),
      createMany: vi.fn(),
      countByAnonId: vi.fn(),
    })),
  };
});

const { GET: getStats } = await import('@/app/api/admin/competitions/[id]/stats/route');

async function buildValidToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(new TextEncoder().encode(TEST_SECRET));
}

function statsRequest(url: string, cookie?: string) {
  return new NextRequest(url, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

function idParams(id = COMPETITION_ID) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/admin/competitions/[id]/stats', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Cookieが存在しない場合、401を返す', async () => {
    const response = await getStats(
      statsRequest(`http://localhost/api/admin/competitions/${COMPETITION_ID}/stats`),
      idParams(),
    );

    expect(response.status).toBe(401);
  });

  it('存在しないコンペIDの場合、404を返す', async () => {
    const token = await buildValidToken();

    const response = await getStats(
      statsRequest(
        `http://localhost/api/admin/competitions/unknown/stats`,
        `admin_token=${token}`,
      ),
      idParams('unknown'),
    );

    expect(response.status).toBe(404);
  });

  it('管理者セッションが有効な場合、投稿・投票の集計を返す', async () => {
    const token = await buildValidToken();

    const response = await getStats(
      statsRequest(
        `http://localhost/api/admin/competitions/${COMPETITION_ID}/stats`,
        `admin_token=${token}`,
      ),
      idParams(),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.submissionCount).toBe(1);
    expect(body.submissions[0]).toMatchObject({ id: 'logo-1', uploaderName: '山田太郎' });
    expect(body.voterCount).toBe(4);
    expect(body.totalVotes).toBe(9);
  });
});
