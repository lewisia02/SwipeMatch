import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Competition } from '@/lib/types/Competition';

const TEST_SECRET = 'test-admin-session-secret-value';

const ACTIVE_COMPETITION: Competition = {
  id: 'competition-1',
  slug: 'x7k2p9',
  title: '第2回ロゴ作成大会',
  status: 'active',
  currentPhase: 'submission',
  runoffRound: null,
  createdAt: new Date('2026-07-20T00:00:00.000Z'),
  closedAt: null,
};

const mockState = {
  active: null as Competition | null,
  all: [] as Competition[],
};

vi.mock('@/lib/repositories/CompetitionRepository', () => {
  return {
    CompetitionRepository: vi.fn().mockImplementation(() => ({
      findActive: vi.fn().mockImplementation(async () => mockState.active),
      findAll: vi.fn().mockImplementation(async () => mockState.all),
      findBySlug: vi.fn().mockImplementation(
        async (slug: string) => mockState.all.find((c) => c.slug === slug) ?? null,
      ),
      closeActive: vi.fn().mockImplementation(async () => {
        if (mockState.active) {
          const closed = { ...mockState.active, status: 'closed' as const };
          mockState.all = mockState.all.map((c) => (c.id === closed.id ? closed : c));
          mockState.active = null;
        }
      }),
      create: vi.fn().mockImplementation(async (data: { slug: string; title: string }) => {
        const created = {
          id: 'competition-2',
          slug: data.slug,
          title: data.title,
          status: 'active' as const,
          currentPhase: 'submission' as const,
          runoffRound: null,
          createdAt: new Date('2026-07-20T09:00:00.000Z'),
          closedAt: null,
        };
        mockState.active = created;
        mockState.all = [created, ...mockState.all];
        return created;
      }),
    })),
  };
});

const { GET: getActiveCompetition } = await import('@/app/api/competitions/active/route');
const { GET: getAdminCompetitions, POST: postAdminCompetitions } = await import(
  '@/app/api/admin/competitions/route'
);
const { GET: getPhase } = await import('@/app/api/c/[slug]/phase/route');

async function buildValidToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(new TextEncoder().encode(TEST_SECRET));
}

describe('GET /api/competitions/active', () => {
  beforeEach(() => {
    mockState.active = null;
    mockState.all = [];
  });

  it('開催中コンペがある場合、slugを返す', async () => {
    mockState.active = ACTIVE_COMPETITION;

    const response = await getActiveCompetition();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ slug: 'x7k2p9' });
  });

  it('開催中コンペが無い場合、204を返す', async () => {
    const response = await getActiveCompetition();

    expect(response.status).toBe(204);
  });
});

describe('GET /api/c/[slug]/phase', () => {
  beforeEach(() => {
    mockState.active = null;
    mockState.all = [ACTIVE_COMPETITION];
  });

  it('存在するslugの場合、現在のフェーズを返す', async () => {
    const response = await getPhase(new NextRequest('http://localhost/api/c/x7k2p9/phase'), {
      params: Promise.resolve({ slug: 'x7k2p9' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ phase: 'submission', runoffRound: null });
  });

  it('存在しないslugの場合、404を返す', async () => {
    const response = await getPhase(new NextRequest('http://localhost/api/c/unknown/phase'), {
      params: Promise.resolve({ slug: 'unknown' }),
    });

    expect(response.status).toBe(404);
  });
});

describe('GET/POST /api/admin/competitions', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SECRET);
    mockState.active = null;
    mockState.all = [];
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('未認証の場合、GETは401を返す', async () => {
    const response = await getAdminCompetitions(
      new NextRequest('http://localhost/api/admin/competitions'),
    );

    expect(response.status).toBe(401);
  });

  it('認証済みの場合、コンペ一覧を返す', async () => {
    mockState.all = [ACTIVE_COMPETITION];
    const token = await buildValidToken();

    const response = await getAdminCompetitions(
      new NextRequest('http://localhost/api/admin/competitions', {
        headers: { Cookie: `admin_token=${token}` },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.competitions).toHaveLength(1);
    expect(body.competitions[0]).toMatchObject({ slug: 'x7k2p9' });
  });

  it('新規開催すると既存activeが自動クローズされ、新規コンペを返す', async () => {
    mockState.active = ACTIVE_COMPETITION;
    mockState.all = [ACTIVE_COMPETITION];
    const token = await buildValidToken();

    const response = await postAdminCompetitions(
      new NextRequest('http://localhost/api/admin/competitions', {
        method: 'POST',
        body: JSON.stringify({ title: '第3回ロゴ作成大会' }),
        headers: { 'Content-Type': 'application/json', Cookie: `admin_token=${token}` },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ title: '第3回ロゴ作成大会', status: 'active' });
    expect(mockState.all[1]).toMatchObject({ id: 'competition-1', status: 'closed' });
  });

  it('題名が未入力の場合、400を返す', async () => {
    const token = await buildValidToken();

    const response = await postAdminCompetitions(
      new NextRequest('http://localhost/api/admin/competitions', {
        method: 'POST',
        body: JSON.stringify({ title: '' }),
        headers: { 'Content-Type': 'application/json', Cookie: `admin_token=${token}` },
      }),
    );

    expect(response.status).toBe(400);
  });
});
