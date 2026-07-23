import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SLUG = 'x7k2p9';
const COMPETITION_ID = 'competition-1';

const mockCompetition = {
  currentPhase: 'runoff' as 'submission' | 'voting' | 'results' | 'runoff' | 'ended',
  runoffRound: 2 as number | null,
};
const mockVotes = {
  round1Count: 1,
  roundCount: 0,
};
const mockLatestRound = {
  round: 2,
  logoIds: ['logo-1', 'logo-2'] as string[],
  resolution: null as 'joint_winner' | null,
};

function buildCompetition() {
  return {
    id: COMPETITION_ID,
    slug: SLUG,
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
      findBySlug: vi.fn().mockImplementation(async (slug: string) =>
        slug === SLUG ? buildCompetition() : null,
      ),
      findById: vi.fn().mockImplementation(async (id: string) =>
        id === COMPETITION_ID ? buildCompetition() : null,
      ),
    })),
  };
});

vi.mock('@/lib/repositories/VoteRepository', () => {
  return {
    VoteRepository: vi.fn().mockImplementation(() => ({
      countByAnonId: vi
        .fn()
        .mockImplementation(async (_competitionId: string, _anonId: string, round: number) =>
          round === 1 ? mockVotes.round1Count : mockVotes.roundCount,
        ),
      reserveVoteSlot: vi.fn().mockImplementation(async () => mockVotes.roundCount === 0),
      releaseVoteSlot: vi.fn(),
      createMany: vi.fn().mockResolvedValue([]),
      countByLogoId: vi.fn(),
    })),
  };
});

vi.mock('@/lib/repositories/RunoffRoundRepository', () => {
  return {
    RunoffRoundRepository: vi.fn().mockImplementation(() => ({
      findLatestRound: vi.fn().mockImplementation(async () => ({ ...mockLatestRound })),
      createRound: vi.fn(),
      findAllByCompetitionId: vi.fn().mockResolvedValue([]),
      resolveAsJointWinner: vi.fn(),
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
        {
          id: 'logo-3',
          competitionId: COMPETITION_ID,
          imageUrl: 'https://example.com/3.jpg',
          uploaderName: '鈴木一郎',
          memo: 'メモ3',
          createdAt: new Date('2026-07-18T00:00:00.000Z'),
        },
      ]),
    })),
  };
});

const { GET: getRunoffStatus } = await import('@/app/api/c/[slug]/runoff/route');
const { POST: postRunoffVote } = await import('@/app/api/c/[slug]/votes/runoff/route');

function slugParams(slug = SLUG) {
  return { params: Promise.resolve({ slug }) };
}

function statusRequest(cookie = 'anon_id=anon-1') {
  return new NextRequest(`http://localhost/api/c/${SLUG}/runoff`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

function voteRequest(body: unknown, cookie = 'anon_id=anon-1') {
  return new NextRequest(`http://localhost/api/c/${SLUG}/votes/runoff`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  });
}

describe('GET /api/c/[slug]/runoff', () => {
  beforeEach(() => {
    mockCompetition.currentPhase = 'runoff';
    mockCompetition.runoffRound = 2;
    mockVotes.round1Count = 1;
    mockVotes.roundCount = 0;
    mockLatestRound.round = 2;
    mockLatestRound.logoIds = ['logo-1', 'logo-2'];
    mockLatestRound.resolution = null;
  });

  it('ランオフ受付中でround1投票済み・当該ラウンド未投票の場合、対象Logoを返す', async () => {
    const response = await getRunoffStatus(statusRequest(), slugParams());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ round: 2, eligible: true, alreadyVoted: false });
    expect(body.logos.map((logo: { id: string }) => logo.id)).toEqual(['logo-1', 'logo-2']);
  });

  it('ランオフ受付中でない場合、roundはnullを返す', async () => {
    mockCompetition.runoffRound = null;

    const response = await getRunoffStatus(statusRequest(), slugParams());

    const body = await response.json();
    expect(body.round).toBeNull();
    expect(body.logos).toEqual([]);
  });

  it('round1未投票の場合、eligibleはfalseを返す', async () => {
    mockVotes.round1Count = 0;

    const response = await getRunoffStatus(statusRequest(), slugParams());

    const body = await response.json();
    expect(body.eligible).toBe(false);
  });

  it('当該ラウンドに投票済みの場合、alreadyVotedはtrueを返す', async () => {
    mockVotes.roundCount = 1;

    const response = await getRunoffStatus(statusRequest(), slugParams());

    const body = await response.json();
    expect(body.alreadyVoted).toBe(true);
  });

  it('存在しないslugの場合、404を返す', async () => {
    const response = await getRunoffStatus(statusRequest(), slugParams('unknown'));

    expect(response.status).toBe(404);
  });

  it('anon_id Cookieが存在しない場合、500を返す', async () => {
    const response = await getRunoffStatus(statusRequest(''), slugParams());

    expect(response.status).toBe(500);
  });
});

describe('POST /api/c/[slug]/votes/runoff', () => {
  beforeEach(() => {
    mockCompetition.currentPhase = 'runoff';
    mockCompetition.runoffRound = 2;
    mockVotes.round1Count = 1;
    mockVotes.roundCount = 0;
    mockLatestRound.round = 2;
    mockLatestRound.logoIds = ['logo-1', 'logo-2'];
    mockLatestRound.resolution = null;
  });

  it('round1投票済みかつ対象Logoの場合、投票が成功する', async () => {
    const response = await postRunoffVote(voteRequest({ logoId: 'logo-1' }), slugParams());

    expect(response.status).toBe(200);
  });

  it('runoffフェーズでない場合、403を返す', async () => {
    mockCompetition.currentPhase = 'results';

    const response = await postRunoffVote(voteRequest({ logoId: 'logo-1' }), slugParams());

    expect(response.status).toBe(403);
  });

  it('受付中のラウンドが無い場合、403を返す', async () => {
    mockCompetition.runoffRound = null;

    const response = await postRunoffVote(voteRequest({ logoId: 'logo-1' }), slugParams());

    expect(response.status).toBe(403);
  });

  it('round1未投票のanonIdの場合、403を返す', async () => {
    mockVotes.round1Count = 0;

    const response = await postRunoffVote(voteRequest({ logoId: 'logo-1' }), slugParams());

    expect(response.status).toBe(403);
  });

  it('対象外のlogoIdの場合、400を返す', async () => {
    const response = await postRunoffVote(voteRequest({ logoId: 'logo-3' }), slugParams());

    expect(response.status).toBe(400);
  });

  it('logoIdが空文字の場合、400を返す', async () => {
    const response = await postRunoffVote(voteRequest({ logoId: '' }), slugParams());

    expect(response.status).toBe(400);
  });

  it('既に当該ラウンドに投票済みの場合、409を返す', async () => {
    mockVotes.roundCount = 1;

    const response = await postRunoffVote(voteRequest({ logoId: 'logo-1' }), slugParams());

    expect(response.status).toBe(409);
  });

  it('anon_id Cookieが存在しない場合、500を返す', async () => {
    const response = await postRunoffVote(voteRequest({ logoId: 'logo-1' }, ''), slugParams());

    expect(response.status).toBe(500);
  });
});
