import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'test-admin-session-secret-value';
const COMPETITION_ID = 'competition-1';

const mockCompetition = {
  currentPhase: 'results' as 'submission' | 'voting' | 'results' | 'runoff' | 'ended',
  runoffRound: null as number | null,
};
const mockVoteCounts: Record<number, Record<string, number>> = {
  1: { 'logo-1': 5, 'logo-2': 5 },
};
let latestRound: { round: number; logoIds: string[]; resolution: 'joint_winner' | null } | null = {
  round: 2,
  logoIds: ['logo-1', 'logo-2'],
  resolution: null,
};

function buildCompetition() {
  return {
    id: COMPETITION_ID,
    slug: 'x7k2p9',
    title: 'テストコンペ',
    status: 'active' as const,
    currentPhase: mockCompetition.currentPhase,
    runoffRound: mockCompetition.runoffRound,
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
      updateRunoffRound: vi.fn().mockImplementation(async (_id: string, round: number | null) => {
        mockCompetition.runoffRound = round;
        return buildCompetition();
      }),
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
          imageUrl: 'https://example.com/1.jpg',
          uploaderName: '山田太郎',
          memo: 'メモ1',
          createdAt: new Date('2026-07-18T00:00:00.000Z'),
        },
        {
          id: 'logo-2',
          competitionId: COMPETITION_ID,
          imageUrl: 'https://example.com/2.jpg',
          uploaderName: '佐藤花子',
          memo: 'メモ2',
          createdAt: new Date('2026-07-18T00:00:00.000Z'),
        },
      ]),
    })),
  };
});

vi.mock('@/lib/repositories/VoteRepository', () => {
  return {
    VoteRepository: vi.fn().mockImplementation(() => ({
      countByLogoId: vi
        .fn()
        .mockImplementation(async (_competitionId: string, round: number) => mockVoteCounts[round] ?? {}),
    })),
  };
});

vi.mock('@/lib/repositories/RunoffRoundRepository', () => {
  return {
    RunoffRoundRepository: vi.fn().mockImplementation(() => ({
      createRound: vi.fn(),
      findLatestRound: vi.fn().mockImplementation(async () => latestRound),
      findAllByCompetitionId: vi.fn().mockResolvedValue([]),
      resolveAsJointWinner: vi.fn(),
    })),
  };
});

const { POST: postStart } = await import('@/app/api/admin/competitions/[id]/runoff/start/route');
const { POST: postClose } = await import('@/app/api/admin/competitions/[id]/runoff/close/route');
const { POST: postResolve } = await import('@/app/api/admin/competitions/[id]/runoff/resolve/route');

async function buildValidToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(new TextEncoder().encode(TEST_SECRET));
}

function adminRequest(path: string, cookie?: string) {
  return new NextRequest(`http://localhost/api/admin/competitions/${COMPETITION_ID}/runoff/${path}`, {
    method: 'POST',
    headers: cookie ? { Cookie: cookie } : {},
  });
}

function idParams(id = COMPETITION_ID) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/admin/competitions/[id]/runoff/start', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SECRET);
    mockCompetition.currentPhase = 'results';
    mockCompetition.runoffRound = null;
    mockVoteCounts[1] = { 'logo-1': 5, 'logo-2': 5 };
    latestRound = { round: 2, logoIds: ['logo-1', 'logo-2'], resolution: null };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Cookieが存在しない場合、401を返す', async () => {
    const response = await postStart(adminRequest('start'), idParams());

    expect(response.status).toBe(401);
  });

  it('resultsフェーズで同着がある場合、200を返しrunoffフェーズへ遷移する', async () => {
    const token = await buildValidToken();

    const response = await postStart(adminRequest('start', `admin_token=${token}`), idParams());

    expect(response.status).toBe(200);
    expect(mockCompetition.currentPhase).toBe('runoff');
    expect(mockCompetition.runoffRound).toBe(2);
  });

  it('resultsフェーズで同着が無い場合、400を返す', async () => {
    mockVoteCounts[1] = { 'logo-1': 5, 'logo-2': 3 };
    const token = await buildValidToken();

    const response = await postStart(adminRequest('start', `admin_token=${token}`), idParams());

    expect(response.status).toBe(400);
  });

  it('runoffフェーズで受付が閉じておりまだ同着の場合、次のラウンドを作成する', async () => {
    mockCompetition.currentPhase = 'runoff';
    mockCompetition.runoffRound = null;
    mockVoteCounts[2] = { 'logo-1': 3, 'logo-2': 3 };
    const token = await buildValidToken();

    const response = await postStart(adminRequest('start', `admin_token=${token}`), idParams());

    expect(response.status).toBe(200);
    expect(mockCompetition.runoffRound).toBe(3);
  });

  it('存在しないコンペIDの場合、404を返す', async () => {
    const token = await buildValidToken();

    const response = await postStart(
      adminRequest('start', `admin_token=${token}`),
      idParams('unknown'),
    );

    expect(response.status).toBe(404);
  });
});

describe('POST /api/admin/competitions/[id]/runoff/close', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SECRET);
    mockCompetition.currentPhase = 'runoff';
    mockCompetition.runoffRound = 2;
    latestRound = { round: 2, logoIds: ['logo-1', 'logo-2'], resolution: null };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('同着が解消した場合、200かつresolved:trueを返し受付を止める', async () => {
    mockVoteCounts[2] = { 'logo-1': 3, 'logo-2': 7 };
    const token = await buildValidToken();

    const response = await postClose(adminRequest('close', `admin_token=${token}`), idParams());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.resolved).toBe(true);
    expect(mockCompetition.runoffRound).toBeNull();
  });

  it('まだ同着の場合、resolved:falseを返す', async () => {
    mockVoteCounts[2] = { 'logo-1': 3, 'logo-2': 3 };
    const token = await buildValidToken();

    const response = await postClose(adminRequest('close', `admin_token=${token}`), idParams());

    const body = await response.json();
    expect(body.resolved).toBe(false);
  });

  it('runoffフェーズでない場合、400を返す', async () => {
    mockCompetition.currentPhase = 'results';
    const token = await buildValidToken();

    const response = await postClose(adminRequest('close', `admin_token=${token}`), idParams());

    expect(response.status).toBe(400);
  });
});

describe('POST /api/admin/competitions/[id]/runoff/resolve', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SECRET);
    mockCompetition.currentPhase = 'runoff';
    mockCompetition.runoffRound = null;
    latestRound = { round: 2, logoIds: ['logo-1', 'logo-2'], resolution: null };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('締切済みで直近ラウンドがある場合、200を返す', async () => {
    const token = await buildValidToken();

    const response = await postResolve(adminRequest('resolve', `admin_token=${token}`), idParams());

    expect(response.status).toBe(200);
  });

  it('投票受付中（締切前）の場合、400を返す', async () => {
    mockCompetition.runoffRound = 2;
    const token = await buildValidToken();

    const response = await postResolve(adminRequest('resolve', `admin_token=${token}`), idParams());

    expect(response.status).toBe(400);
  });
});
