import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'test-admin-session-secret-value';
const COMPETITION_ID = 'competition-1';

const mockCompetition = { currentPhase: 'results' as 'submission' | 'voting' | 'results' | 'ended' };

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
        {
          id: 'logo-2',
          competitionId: COMPETITION_ID,
          imageUrl: 'https://example.com/logos/2.jpg',
          uploaderName: '佐藤花子',
          memo: 'メモ2',
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
      countByLogoId: vi.fn().mockResolvedValue({ 'logo-1': 3, 'logo-2': 8 }),
      reserveVoteSlot: vi.fn(),
      releaseVoteSlot: vi.fn(),
      createMany: vi.fn(),
      countByAnonId: vi.fn(),
    })),
  };
});

const { GET: getResults } = await import('@/app/api/admin/competitions/[id]/results/route');
const { GET: getResultsExport } = await import(
  '@/app/api/admin/competitions/[id]/results/export/route'
);

async function buildValidToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(new TextEncoder().encode(TEST_SECRET));
}

function resultsRequest(url: string, cookie?: string) {
  return new NextRequest(url, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

function idParams(id = COMPETITION_ID) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/admin/competitions/[id]/results', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SECRET);
    mockCompetition.currentPhase = 'results';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Cookieが存在しない場合、401を返す', async () => {
    const response = await getResults(
      resultsRequest(`http://localhost/api/admin/competitions/${COMPETITION_ID}/results`),
      idParams(),
    );

    expect(response.status).toBe(401);
  });

  it('存在しないコンペIDの場合、404を返す', async () => {
    const token = await buildValidToken();

    const response = await getResults(
      resultsRequest(
        `http://localhost/api/admin/competitions/unknown/results`,
        `admin_token=${token}`,
      ),
      idParams('unknown'),
    );

    expect(response.status).toBe(404);
  });

  it('resultsフェーズでない場合、403を返す', async () => {
    mockCompetition.currentPhase = 'voting';
    const token = await buildValidToken();

    const response = await getResults(
      resultsRequest(
        `http://localhost/api/admin/competitions/${COMPETITION_ID}/results`,
        `admin_token=${token}`,
      ),
      idParams(),
    );

    expect(response.status).toBe(403);
  });

  it('resultsフェーズの場合、得票数降順のランキングを返す', async () => {
    const token = await buildValidToken();

    const response = await getResults(
      resultsRequest(
        `http://localhost/api/admin/competitions/${COMPETITION_ID}/results`,
        `admin_token=${token}`,
      ),
      idParams(),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results[0]).toMatchObject({ id: 'logo-2', voteCount: 8, rank: 1 });
    expect(body.results[1]).toMatchObject({ id: 'logo-1', voteCount: 3, rank: 2 });
  });

  it('endedフェーズ(resultsより後方)の場合でも、ランキングを返す（回帰確認）', async () => {
    mockCompetition.currentPhase = 'ended';
    const token = await buildValidToken();

    const response = await getResults(
      resultsRequest(
        `http://localhost/api/admin/competitions/${COMPETITION_ID}/results`,
        `admin_token=${token}`,
      ),
      idParams(),
    );

    expect(response.status).toBe(200);
  });
});

describe('GET /api/admin/competitions/[id]/results/export', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SECRET);
    mockCompetition.currentPhase = 'results';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Cookieが存在しない場合、401を返す', async () => {
    const response = await getResultsExport(
      resultsRequest(`http://localhost/api/admin/competitions/${COMPETITION_ID}/results/export`),
      idParams(),
    );

    expect(response.status).toBe(401);
  });

  it('resultsフェーズでない場合、403を返す', async () => {
    mockCompetition.currentPhase = 'voting';
    const token = await buildValidToken();

    const response = await getResultsExport(
      resultsRequest(
        `http://localhost/api/admin/competitions/${COMPETITION_ID}/results/export`,
        `admin_token=${token}`,
      ),
      idParams(),
    );

    expect(response.status).toBe(403);
  });

  it('resultsフェーズの場合、CSV形式でランキングを返す', async () => {
    const token = await buildValidToken();

    const response = await getResultsExport(
      resultsRequest(
        `http://localhost/api/admin/competitions/${COMPETITION_ID}/results/export`,
        `admin_token=${token}`,
      ),
      idParams(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    const csv = await response.text();
    expect(csv).toContain('rank,imageUrl,uploaderName,memo,voteCount');
    expect(csv).toContain('1,https://example.com/logos/2.jpg,佐藤花子,メモ2,8');
  });
});
