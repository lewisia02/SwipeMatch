import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SLUG = 'x7k2p9';
const COMPETITION_ID = 'competition-1';

const mockCompetition = {
  status: 'active' as 'active' | 'closed',
  currentPhase: 'submission' as 'submission' | 'voting' | 'results',
};

function buildCompetition() {
  return {
    id: COMPETITION_ID,
    slug: SLUG,
    title: 'テストコンペ',
    status: mockCompetition.status,
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

vi.mock('@/lib/repositories/LogoRepository', () => {
  return {
    LogoRepository: vi.fn().mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({
        id: 'logo-1',
        competitionId: COMPETITION_ID,
        imageUrl: 'https://example.com/logos/abc.jpg',
        uploaderName: '山田太郎',
        memo: 'テストメモ',
        createdAt: new Date('2026-07-18T00:00:00.000Z'),
      }),
      findAllByCompetitionId: vi.fn().mockResolvedValue([
        {
          id: 'logo-1',
          competitionId: COMPETITION_ID,
          imageUrl: 'https://example.com/logos/abc.jpg',
          uploaderName: '山田太郎',
          memo: 'テストメモ',
          createdAt: new Date('2026-07-18T00:00:00.000Z'),
        },
      ]),
      delete: vi.fn(),
      createSignedUploadUrl: vi.fn().mockResolvedValue({
        uploadUrl: 'https://example.com/upload',
        storagePath: 'abc.jpg',
      }),
      deleteStorageObject: vi.fn(),
      getPublicUrl: vi.fn().mockReturnValue('https://example.com/logos/abc.jpg'),
    })),
  };
});

const { POST: postUploadUrl } = await import('@/app/api/c/[slug]/logos/upload-url/route');
const { GET: getLogos, POST: postLogo } = await import('@/app/api/c/[slug]/logos/route');

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function slugParams(slug = SLUG) {
  return { params: Promise.resolve({ slug }) };
}

describe('POST /api/c/[slug]/logos/upload-url', () => {
  beforeEach(() => {
    mockCompetition.status = 'active';
    mockCompetition.currentPhase = 'submission';
  });

  it('submissionフェーズの場合、署名付きURLを返す', async () => {
    const response = await postUploadUrl(
      jsonRequest(`http://localhost/api/c/${SLUG}/logos/upload-url`, {
        contentType: 'image/jpeg',
      }),
      slugParams(),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.storagePath).toBe('abc.jpg');
  });

  it('存在しないslugの場合、404を返す', async () => {
    const response = await postUploadUrl(
      jsonRequest('http://localhost/api/c/unknown/logos/upload-url', {
        contentType: 'image/jpeg',
      }),
      slugParams('unknown'),
    );

    expect(response.status).toBe(404);
  });

  it('不正なcontentTypeの場合、400を返す', async () => {
    const response = await postUploadUrl(
      jsonRequest(`http://localhost/api/c/${SLUG}/logos/upload-url`, {
        contentType: 'image/heic',
      }),
      slugParams(),
    );

    expect(response.status).toBe(400);
  });

  it('submissionフェーズでない場合、403を返す', async () => {
    mockCompetition.currentPhase = 'voting';

    const response = await postUploadUrl(
      jsonRequest(`http://localhost/api/c/${SLUG}/logos/upload-url`, {
        contentType: 'image/jpeg',
      }),
      slugParams(),
    );

    expect(response.status).toBe(403);
  });

  it('コンペがclosedの場合、403を返す', async () => {
    mockCompetition.status = 'closed';

    const response = await postUploadUrl(
      jsonRequest(`http://localhost/api/c/${SLUG}/logos/upload-url`, {
        contentType: 'image/jpeg',
      }),
      slugParams(),
    );

    expect(response.status).toBe(403);
  });
});

describe('GET /api/c/[slug]/logos', () => {
  beforeEach(() => {
    mockCompetition.status = 'active';
    mockCompetition.currentPhase = 'voting';
  });

  it('votingフェーズの場合、投稿者名を含まないLogo一覧を返す', async () => {
    const response = await getLogos(
      new NextRequest(`http://localhost/api/c/${SLUG}/logos`),
      slugParams(),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.logos).toHaveLength(1);
    expect(body.logos[0]).not.toHaveProperty('uploaderName');
    expect(body.logos[0]).toMatchObject({ id: 'logo-1', memo: 'テストメモ' });
  });

  it('votingフェーズでない場合、403を返す', async () => {
    mockCompetition.currentPhase = 'submission';

    const response = await getLogos(
      new NextRequest(`http://localhost/api/c/${SLUG}/logos`),
      slugParams(),
    );

    expect(response.status).toBe(403);
  });

  it('存在しないslugの場合、404を返す', async () => {
    const response = await getLogos(
      new NextRequest('http://localhost/api/c/unknown/logos'),
      slugParams('unknown'),
    );

    expect(response.status).toBe(404);
  });
});

describe('POST /api/c/[slug]/logos', () => {
  beforeEach(() => {
    mockCompetition.status = 'active';
    mockCompetition.currentPhase = 'submission';
  });

  it('正常なデータでLogoレコードを作成し、投稿者名を含まないレスポンスを返す', async () => {
    const response = await postLogo(
      jsonRequest(`http://localhost/api/c/${SLUG}/logos`, {
        storagePath: 'abc.jpg',
        uploaderName: '山田太郎',
        memo: 'テストメモ',
      }),
      slugParams(),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('logo-1');
    expect(body).not.toHaveProperty('uploaderName');
  });

  it('投稿者名が51文字以上の場合、400を返す', async () => {
    const response = await postLogo(
      jsonRequest(`http://localhost/api/c/${SLUG}/logos`, {
        storagePath: 'abc.jpg',
        uploaderName: 'a'.repeat(51),
        memo: 'テストメモ',
      }),
      slugParams(),
    );

    expect(response.status).toBe(400);
  });

  it('submissionフェーズでない場合、403を返す', async () => {
    mockCompetition.currentPhase = 'voting';

    const response = await postLogo(
      jsonRequest(`http://localhost/api/c/${SLUG}/logos`, {
        storagePath: 'abc.jpg',
        uploaderName: '山田太郎',
        memo: 'テストメモ',
      }),
      slugParams(),
    );

    expect(response.status).toBe(403);
  });

  it('コンペがclosedの場合、403を返す', async () => {
    mockCompetition.status = 'closed';

    const response = await postLogo(
      jsonRequest(`http://localhost/api/c/${SLUG}/logos`, {
        storagePath: 'abc.jpg',
        uploaderName: '山田太郎',
        memo: 'テストメモ',
      }),
      slugParams(),
    );

    expect(response.status).toBe(403);
  });
});
