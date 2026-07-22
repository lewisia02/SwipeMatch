import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Competition } from '@/lib/types/Competition';

const TEST_SECRET = 'test-admin-session-secret-value';
const COMPETITION_ID = 'competition-1';

const mockState = {
  competition: null as Competition | null,
};

const mockCompetitionRepository = {
  findById: vi.fn().mockImplementation(async (id: string) =>
    id === COMPETITION_ID ? mockState.competition : null,
  ),
  delete: vi.fn().mockResolvedValue(undefined),
};

const mockLogoRepository = {
  findAllByCompetitionId: vi.fn().mockResolvedValue([
    { id: 'logo-1', imageUrl: 'https://example.com/storage/logos/abc.jpg' },
  ]),
  deleteAllByCompetitionId: vi.fn().mockResolvedValue(undefined),
  deleteStorageObject: vi.fn().mockResolvedValue(undefined),
};

const mockVoteRepository = {
  deleteLocksByCompetitionId: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/lib/repositories/CompetitionRepository', () => ({
  CompetitionRepository: vi.fn().mockImplementation(() => mockCompetitionRepository),
}));

vi.mock('@/lib/repositories/LogoRepository', () => ({
  LogoRepository: vi.fn().mockImplementation(() => mockLogoRepository),
}));

vi.mock('@/lib/repositories/VoteRepository', () => ({
  VoteRepository: vi.fn().mockImplementation(() => mockVoteRepository),
}));

const { DELETE: deleteCompetition } = await import('@/app/api/admin/competitions/[id]/route');

async function buildValidToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(new TextEncoder().encode(TEST_SECRET));
}

function deleteRequest(body: unknown, cookie?: string) {
  return new NextRequest(`http://localhost/api/admin/competitions/${COMPETITION_ID}`, {
    method: 'DELETE',
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

function buildCompetition(overrides: Partial<Competition> = {}): Competition {
  return {
    id: COMPETITION_ID,
    slug: 'x7k2p9',
    title: '第1回ロゴ作成大会',
    status: 'closed',
    currentPhase: 'results',
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    closedAt: new Date('2026-07-19T00:00:00.000Z'),
    ...overrides,
  };
}

describe('DELETE /api/admin/competitions/[id]', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SECRET);
    mockState.competition = buildCompetition();
    vi.clearAllMocks();
    mockCompetitionRepository.findById.mockImplementation(async (id: string) =>
      id === COMPETITION_ID ? mockState.competition : null,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('未認証の場合、401を返す', async () => {
    const response = await deleteCompetition(
      deleteRequest({ title: '第1回ロゴ作成大会' }),
      idParams(),
    );

    expect(response.status).toBe(401);
  });

  it('存在しないコンペIDの場合、404を返す', async () => {
    const token = await buildValidToken();

    const response = await deleteCompetition(
      deleteRequest({ title: '第1回ロゴ作成大会' }, `admin_token=${token}`),
      idParams('unknown'),
    );

    expect(response.status).toBe(404);
  });

  it('確認文字列（コンペ名）が一致しない場合、400を返し削除しない', async () => {
    const token = await buildValidToken();

    const response = await deleteCompetition(
      deleteRequest({ title: '違うコンペ名' }, `admin_token=${token}`),
      idParams(),
    );

    expect(response.status).toBe(400);
    expect(mockCompetitionRepository.delete).not.toHaveBeenCalled();
  });

  it('activeなコンペの場合、400を返し削除しない', async () => {
    mockState.competition = buildCompetition({ status: 'active' });
    const token = await buildValidToken();

    const response = await deleteCompetition(
      deleteRequest({ title: '第1回ロゴ作成大会' }, `admin_token=${token}`),
      idParams(),
    );

    expect(response.status).toBe(400);
    expect(mockCompetitionRepository.delete).not.toHaveBeenCalled();
  });

  it('closedなコンペで確認文字列が一致する場合、関連データをすべて削除する', async () => {
    const token = await buildValidToken();

    const response = await deleteCompetition(
      deleteRequest({ title: '第1回ロゴ作成大会' }, `admin_token=${token}`),
      idParams(),
    );

    expect(response.status).toBe(200);
    expect(mockLogoRepository.deleteStorageObject).toHaveBeenCalledWith('abc.jpg');
    expect(mockLogoRepository.deleteAllByCompetitionId).toHaveBeenCalledWith(COMPETITION_ID);
    expect(mockVoteRepository.deleteLocksByCompetitionId).toHaveBeenCalledWith(COMPETITION_ID);
    expect(mockCompetitionRepository.delete).toHaveBeenCalledWith(COMPETITION_ID);
  });
});
