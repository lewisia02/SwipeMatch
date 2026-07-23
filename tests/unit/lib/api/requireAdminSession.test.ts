import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasValidAdminSession } from '@/lib/api/requireAdminSession';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import type { LogoRepository } from '@/lib/repositories/LogoRepository';
import type { RunoffRoundRepository } from '@/lib/repositories/RunoffRoundRepository';
import type { VoteRepository } from '@/lib/repositories/VoteRepository';
import { AdminService } from '@/lib/services/AdminService';
import type { PhaseService } from '@/lib/services/PhaseService';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

const TEST_SECRET = 'test-admin-session-secret-value';

function createAdminService(): AdminService {
  return new AdminService(
    {} as LogoRepository,
    {} as VoteRepository,
    {} as PhaseService,
    {} as CompetitionRepository,
    {} as RunoffRoundRepository,
  );
}

function stubCookie(token: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => (name === 'admin_token' && token ? { name, value: token } : undefined),
  } as Awaited<ReturnType<typeof cookies>>);
}

describe('hasValidAdminSession', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('有効なJWTの場合、trueを返す', async () => {
    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('4h')
      .sign(new TextEncoder().encode(TEST_SECRET));
    stubCookie(token);

    await expect(hasValidAdminSession(createAdminService())).resolves.toBe(true);
  });

  it('Cookieが存在しない場合、falseを返す', async () => {
    stubCookie(undefined);

    await expect(hasValidAdminSession(createAdminService())).resolves.toBe(false);
  });

  it('期限切れのトークンの場合、falseを返す', async () => {
    const expiredToken = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 20)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(new TextEncoder().encode(TEST_SECRET));
    stubCookie(expiredToken);

    await expect(hasValidAdminSession(createAdminService())).resolves.toBe(false);
  });

  it('異なるシークレットで署名されたトークンの場合、falseを返す', async () => {
    const tamperedToken = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('4h')
      .sign(new TextEncoder().encode('different-secret-value'));
    stubCookie(tamperedToken);

    await expect(hasValidAdminSession(createAdminService())).resolves.toBe(false);
  });
});
