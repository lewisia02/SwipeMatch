import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAppSettings = { currentPhase: 'voting' as 'submission' | 'voting' | 'results' };
const mockVotes = { alreadyVoted: false };

vi.mock('@/lib/repositories/AppSettingsRepository', () => {
  return {
    AppSettingsRepository: vi.fn().mockImplementation(() => ({
      get: vi.fn().mockImplementation(async () => ({
        id: 'singleton',
        currentPhase: mockAppSettings.currentPhase,
        updatedAt: new Date(),
      })),
      updatePhase: vi.fn(),
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

const { POST: postVotes } = await import('@/app/api/votes/route');

function votesRequest(body: unknown, cookie = 'anon_id=anon-1') {
  return new NextRequest('http://localhost/api/votes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
  });
}

describe('POST /api/votes', () => {
  beforeEach(() => {
    mockAppSettings.currentPhase = 'voting';
    mockVotes.alreadyVoted = false;
  });

  it('未投票のanonIdから1〜3件投票すると成功する', async () => {
    const response = await postVotes(votesRequest({ logoIds: ['logo-1', 'logo-2'] }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, votedCount: 2 });
  });

  it('logoIdsが0件の場合、400を返す', async () => {
    const response = await postVotes(votesRequest({ logoIds: [] }));

    expect(response.status).toBe(400);
  });

  it('logoIdsが4件以上の場合、400を返す', async () => {
    const response = await postVotes(
      votesRequest({ logoIds: ['logo-1', 'logo-2', 'logo-3', 'logo-4'] }),
    );

    expect(response.status).toBe(400);
  });

  it('logoIdsに重複がある場合、400を返す', async () => {
    const response = await postVotes(votesRequest({ logoIds: ['logo-1', 'logo-1'] }));

    expect(response.status).toBe(400);
  });

  it('votingフェーズでない場合、403を返す', async () => {
    mockAppSettings.currentPhase = 'submission';

    const response = await postVotes(votesRequest({ logoIds: ['logo-1'] }));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.message).toBe('投票は開始していません');
  });

  it('既に投票済みのanonIdの場合、409を返す', async () => {
    mockVotes.alreadyVoted = true;

    const response = await postVotes(votesRequest({ logoIds: ['logo-1'] }));

    expect(response.status).toBe(409);
  });

  it('anon_id Cookieが存在しない場合、500を返す', async () => {
    const response = await postVotes(votesRequest({ logoIds: ['logo-1'] }, ''));

    expect(response.status).toBe(500);
  });
});
