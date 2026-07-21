import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SLUG = 'x7k2p9';
const COMPETITION_ID = 'competition-1';

const mockCompetition = { currentPhase: 'voting' as 'submission' | 'voting' | 'results' };
const mockVotes = { alreadyVoted: false };

function buildCompetition() {
  return {
    id: COMPETITION_ID,
    slug: SLUG,
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
      reserveVoteSlot: vi.fn().mockImplementation(async () => !mockVotes.alreadyVoted),
      releaseVoteSlot: vi.fn(),
      createMany: vi.fn().mockResolvedValue([]),
      countByAnonId: vi.fn(),
      countByLogoId: vi.fn(),
    })),
  };
});

const { POST: postVotes } = await import('@/app/api/c/[slug]/votes/route');

function votesRequest(body: unknown, cookie = 'anon_id=anon-1') {
  return new NextRequest(`http://localhost/api/c/${SLUG}/votes`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
  });
}

function slugParams(slug = SLUG) {
  return { params: Promise.resolve({ slug }) };
}

describe('POST /api/c/[slug]/votes', () => {
  beforeEach(() => {
    mockCompetition.currentPhase = 'voting';
    mockVotes.alreadyVoted = false;
  });

  it('未投票のanonIdから1〜3件投票すると成功する', async () => {
    const response = await postVotes(votesRequest({ logoIds: ['logo-1', 'logo-2'] }), slugParams());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, votedCount: 2 });
  });

  it('存在しないslugの場合、404を返す', async () => {
    const response = await postVotes(
      votesRequest({ logoIds: ['logo-1'] }),
      slugParams('unknown'),
    );

    expect(response.status).toBe(404);
  });

  it('logoIdsが0件の場合、400を返す', async () => {
    const response = await postVotes(votesRequest({ logoIds: [] }), slugParams());

    expect(response.status).toBe(400);
  });

  it('logoIdsが4件以上の場合、400を返す', async () => {
    const response = await postVotes(
      votesRequest({ logoIds: ['logo-1', 'logo-2', 'logo-3', 'logo-4'] }),
      slugParams(),
    );

    expect(response.status).toBe(400);
  });

  it('logoIdsに重複がある場合、400を返す', async () => {
    const response = await postVotes(votesRequest({ logoIds: ['logo-1', 'logo-1'] }), slugParams());

    expect(response.status).toBe(400);
  });

  it('votingフェーズでない場合、403を返す', async () => {
    mockCompetition.currentPhase = 'submission';

    const response = await postVotes(votesRequest({ logoIds: ['logo-1'] }), slugParams());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.message).toBe('投票は開始していません');
  });

  it('既に投票済みのanonIdの場合、409を返す', async () => {
    mockVotes.alreadyVoted = true;

    const response = await postVotes(votesRequest({ logoIds: ['logo-1'] }), slugParams());

    expect(response.status).toBe(409);
  });

  it('anon_id Cookieが存在しない場合、500を返す', async () => {
    const response = await postVotes(votesRequest({ logoIds: ['logo-1'] }, ''), slugParams());

    expect(response.status).toBe(500);
  });
});
