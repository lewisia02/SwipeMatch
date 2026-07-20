import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhaseMismatchError, UnauthorizedError, ValidationError } from '@/lib/errors';
import type { LogoRepository } from '@/lib/repositories/LogoRepository';
import type { VoteRepository } from '@/lib/repositories/VoteRepository';
import { AdminService } from '@/lib/services/AdminService';
import { PhaseService } from '@/lib/services/PhaseService';
import type { Logo } from '@/lib/types/Logo';

const TEST_PASSWORD = 'test-admin-password';
const TEST_SECRET = 'test-admin-session-secret-value';
const COMPETITION_ID = 'competition-1';

function createMockLogoRepository(logos: Logo[] = []) {
  return {
    findAllByCompetitionId: vi.fn().mockResolvedValue(logos),
  } as unknown as LogoRepository;
}

function createMockVoteRepository(voteCounts: Record<string, number> = {}) {
  return {
    countByLogoId: vi.fn().mockResolvedValue(voteCounts),
  } as unknown as VoteRepository;
}

function createMockPhaseService(currentPhase: 'submission' | 'voting' | 'results' = 'results') {
  return {
    assertPhase: vi.fn().mockImplementation(async (_competitionId: string, expected: string) => {
      if (expected !== currentPhase) {
        throw new PhaseMismatchError(expected as never, currentPhase);
      }
    }),
    transitionTo: vi.fn().mockImplementation(async (_competitionId: string, next: string) => {
      const order = ['submission', 'voting', 'results'];
      if (order.indexOf(next) <= order.indexOf(currentPhase)) {
        throw new ValidationError('逆行遷移はできません', 'phase');
      }
    }),
  } as unknown as PhaseService;
}

function buildLogo(overrides: Partial<Logo> = {}): Logo {
  return {
    id: 'logo-1',
    competitionId: COMPETITION_ID,
    imageUrl: 'https://example.com/logo-1.png',
    uploaderName: '山田太郎',
    memo: '一口メモ',
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    ...overrides,
  };
}

describe('AdminService', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_PASSWORD', TEST_PASSWORD);
    vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('login', () => {
    it('正しいパスワードの場合、JWTトークンを発行する', async () => {
      const service = new AdminService(
        createMockLogoRepository(),
        createMockVoteRepository(),
        createMockPhaseService(),
      );

      const result = await service.login(TEST_PASSWORD);

      expect(typeof result.token).toBe('string');
      expect(result.token.split('.')).toHaveLength(3);
    });

    it('誤ったパスワードの場合、UnauthorizedErrorをスローする', async () => {
      const service = new AdminService(
        createMockLogoRepository(),
        createMockVoteRepository(),
        createMockPhaseService(),
      );

      await expect(service.login('wrong-password')).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('verifySession', () => {
    it('有効なトークンの場合、何もスローしない', async () => {
      const service = new AdminService(
        createMockLogoRepository(),
        createMockVoteRepository(),
        createMockPhaseService(),
      );
      const { token } = await service.login(TEST_PASSWORD);

      await expect(service.verifySession(token)).resolves.toBeUndefined();
    });

    it('トークンが存在しない場合、UnauthorizedErrorをスローする', async () => {
      const service = new AdminService(
        createMockLogoRepository(),
        createMockVoteRepository(),
        createMockPhaseService(),
      );

      await expect(service.verifySession(undefined)).rejects.toThrow(UnauthorizedError);
    });

    it('期限切れのトークンの場合、UnauthorizedErrorをスローする', async () => {
      const service = new AdminService(
        createMockLogoRepository(),
        createMockVoteRepository(),
        createMockPhaseService(),
      );
      const expiredToken = await new SignJWT({ role: 'admin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 20)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
        .sign(new TextEncoder().encode(TEST_SECRET));

      await expect(service.verifySession(expiredToken)).rejects.toThrow(UnauthorizedError);
    });

    it('異なるシークレットで署名されたトークンの場合、UnauthorizedErrorをスローする', async () => {
      const service = new AdminService(
        createMockLogoRepository(),
        createMockVoteRepository(),
        createMockPhaseService(),
      );
      const tamperedToken = await new SignJWT({ role: 'admin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('4h')
        .sign(new TextEncoder().encode('different-secret-value'));

      await expect(service.verifySession(tamperedToken)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('setPhase', () => {
    it('前方への遷移の場合、PhaseService.transitionToを呼び出す', async () => {
      const phaseService = createMockPhaseService('submission');
      const service = new AdminService(
        createMockLogoRepository(),
        createMockVoteRepository(),
        phaseService,
      );

      await service.setPhase(COMPETITION_ID, 'voting');

      expect(phaseService.transitionTo).toHaveBeenCalledWith(COMPETITION_ID, 'voting');
    });

    it('逆行遷移の場合、ValidationErrorをスローする', async () => {
      const phaseService = createMockPhaseService('results');
      const service = new AdminService(
        createMockLogoRepository(),
        createMockVoteRepository(),
        phaseService,
      );

      await expect(service.setPhase(COMPETITION_ID, 'submission')).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('getRankedResults', () => {
    it('resultsフェーズ以外の場合、PhaseMismatchErrorをスローする', async () => {
      const service = new AdminService(
        createMockLogoRepository(),
        createMockVoteRepository(),
        createMockPhaseService('voting'),
      );

      await expect(service.getRankedResults(COMPETITION_ID)).rejects.toThrow(PhaseMismatchError);
    });

    it('resultsフェーズの場合、得票数降順のランキングを返す', async () => {
      const logos = [buildLogo({ id: 'logo-1' }), buildLogo({ id: 'logo-2' })];
      const logoRepository = createMockLogoRepository(logos);
      const service = new AdminService(
        logoRepository,
        createMockVoteRepository({ 'logo-1': 3, 'logo-2': 5 }),
        createMockPhaseService('results'),
      );

      const results = await service.getRankedResults(COMPETITION_ID);

      expect(logoRepository.findAllByCompetitionId).toHaveBeenCalledWith(COMPETITION_ID);
      expect(results[0]).toMatchObject({ id: 'logo-2', voteCount: 5, rank: 1 });
      expect(results[1]).toMatchObject({ id: 'logo-1', voteCount: 3, rank: 2 });
    });
  });

  describe('exportResultsCsv', () => {
    it('ランキングをCSV文字列に変換する', async () => {
      const logos = [buildLogo({ id: 'logo-1', uploaderName: '山田太郎', memo: 'メモ1' })];
      const service = new AdminService(
        createMockLogoRepository(logos),
        createMockVoteRepository({ 'logo-1': 2 }),
        createMockPhaseService('results'),
      );

      const csv = await service.exportResultsCsv(COMPETITION_ID);

      expect(csv).toContain('rank,imageUrl,uploaderName,memo,voteCount');
      expect(csv).toContain('1,https://example.com/logo-1.png,山田太郎,メモ1,2');
    });

    it('=+-@で始まるフィールドは数式実行を防ぐためタブを付与する（CSVインジェクション対策）', async () => {
      const logos = [buildLogo({ id: 'logo-1', uploaderName: '=SUM(A1:A10)', memo: '@メモ' })];
      const service = new AdminService(
        createMockLogoRepository(logos),
        createMockVoteRepository({ 'logo-1': 1 }),
        createMockPhaseService('results'),
      );

      const csv = await service.exportResultsCsv(COMPETITION_ID);

      expect(csv).toContain('\t=SUM(A1:A10)');
      expect(csv).toContain('\t@メモ');
    });
  });
});
