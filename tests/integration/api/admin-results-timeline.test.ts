import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'test-admin-session-secret-value';
const COMPETITION_ID = 'competition-1';

const mockState = {
  currentPhase: 'results' as 'submission' | 'voting' | 'results' | 'ended',
};

function buildCompetition() {
  return {
    id: COMPETITION_ID,
    slug: 'x7k2p9',
    title: 'テストコンペ',
    status: 'active' as const,
    currentPhase: mockState.currentPhase,
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
      findAllByCompetitionId: vi.fn().mockResolvedValue([]),
    })),
  };
});

vi.mock('@/lib/repositories/VoteRepository', () => {
  return {
    VoteRepository: vi.fn().mockImplementation(() => ({
      findAllByCompetitionId: vi.fn().mockResolvedValue([
        {
          id: 'vote-1',
          competitionId: COMPETITION_ID,
          logoId: 'logo-1',
          voterAnonId: 'anon-1',
          createdAt: new Date('2026-07-22T00:00:00.000Z'),
        },
        {
          id: 'vote-2',
          competitionId: COMPETITION_ID,
          logoId: 'logo-2',
          voterAnonId: 'anon-2',
          createdAt: new Date('2026-07-22T00:01:00.000Z'),
        },
      ]),
    })),
  };
});

const { GET: getTimeline } = await import(
  '@/app/api/admin/competitions/[id]/results/timeline/route'
);

async function buildValidToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(new TextEncoder().encode(TEST_SECRET));
}

function timelineRequest(url: string, cookie?: string) {
  return new NextRequest(url, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

function idParams(id = COMPETITION_ID) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/admin/competitions/[id]/results/timeline', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SECRET);
    mockState.currentPhase = 'results';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Cookieが存在しない場合、401を返す', async () => {
    const response = await getTimeline(
      timelineRequest(`http://localhost/api/admin/competitions/${COMPETITION_ID}/results/timeline`),
      idParams(),
    );

    expect(response.status).toBe(401);
  });

  it('存在しないコンペIDの場合、404を返す', async () => {
    const token = await buildValidToken();

    const response = await getTimeline(
      timelineRequest(
        `http://localhost/api/admin/competitions/unknown/results/timeline`,
        `admin_token=${token}`,
      ),
      idParams('unknown'),
    );

    expect(response.status).toBe(404);
  });

  it('resultsフェーズ未満の場合、403を返す', async () => {
    mockState.currentPhase = 'voting';
    const token = await buildValidToken();

    const response = await getTimeline(
      timelineRequest(
        `http://localhost/api/admin/competitions/${COMPETITION_ID}/results/timeline`,
        `admin_token=${token}`,
      ),
      idParams(),
    );

    expect(response.status).toBe(403);
  });

  it('resultsフェーズの場合、時系列順の投票タイムラインを返す', async () => {
    const token = await buildValidToken();

    const response = await getTimeline(
      timelineRequest(
        `http://localhost/api/admin/competitions/${COMPETITION_ID}/results/timeline`,
        `admin_token=${token}`,
      ),
      idParams(),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.timeline).toEqual([
      { logoId: 'logo-1', votedAt: '2026-07-22T00:00:00.000Z' },
      { logoId: 'logo-2', votedAt: '2026-07-22T00:01:00.000Z' },
    ]);
  });

  it('endedフェーズの場合でも、200を返す（回帰確認）', async () => {
    mockState.currentPhase = 'ended';
    const token = await buildValidToken();

    const response = await getTimeline(
      timelineRequest(
        `http://localhost/api/admin/competitions/${COMPETITION_ID}/results/timeline`,
        `admin_token=${token}`,
      ),
      idParams(),
    );

    expect(response.status).toBe(200);
  });
});
