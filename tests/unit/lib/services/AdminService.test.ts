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

function createMockVoteRepository(
  voteCounts: Record<string, number> = {},
  stats: { voterCount?: number; totalVotes?: number } = {},
  votes: Array<{ id: string; logoId: string; voterAnonId: string; createdAt: Date }> = [],
) {
  return {
    countByLogoId: vi.fn().mockResolvedValue(voteCounts),
    countVoters: vi.fn().mockResolvedValue(stats.voterCount ?? 0),
    countTotal: vi.fn().mockResolvedValue(stats.totalVotes ?? 0),
    findAllByCompetitionId: vi.fn().mockResolvedValue(
      votes.map((v) => ({ ...v, competitionId: COMPETITION_ID })),
    ),
  } as unknown as VoteRepository;
}

const PHASE_ORDER = ['submission', 'voting', 'results', 'ended'];

function createMockPhaseService(
  currentPhase: 'submission' | 'voting' | 'results' | 'ended' = 'results',
) {
  return {
    assertPhase: vi.fn().mockImplementation(async (_competitionId: string, expected: string) => {
      if (expected !== currentPhase) {
        throw new PhaseMismatchError(expected as never, currentPhase);
      }
    }),
    assertPhaseAtLeast: vi
      .fn()
      .mockImplementation(async (_competitionId: string, minPhase: string) => {
        if (PHASE_ORDER.indexOf(currentPhase) < PHASE_ORDER.indexOf(minPhase)) {
          throw new PhaseMismatchError(minPhase as never, currentPhase);
        }
      }),
    transitionTo: vi.fn().mockImplementation(async (_competitionId: string, next: string) => {
      if (PHASE_ORDER.indexOf(next) <= PHASE_ORDER.indexOf(currentPhase)) {
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

    it('endedフェーズ(resultsより後方)の場合でも、ランキングを返す（回帰確認）', async () => {
      const logos = [buildLogo({ id: 'logo-1' })];
      const service = new AdminService(
        createMockLogoRepository(logos),
        createMockVoteRepository({ 'logo-1': 3 }),
        createMockPhaseService('ended'),
      );

      const results = await service.getRankedResults(COMPETITION_ID);

      expect(results[0]).toMatchObject({ id: 'logo-1', voteCount: 3, rank: 1 });
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

  describe('getDashboardStats', () => {
    it('投稿数・投稿詳細・投票状況を集計して返す', async () => {
      const logos = [
        buildLogo({ id: 'logo-1', uploaderName: '山田太郎', memo: 'メモ1' }),
        buildLogo({ id: 'logo-2', uploaderName: '鈴木花子', memo: 'メモ2' }),
      ];
      const logoRepository = createMockLogoRepository(logos);
      const voteRepository = createMockVoteRepository({}, { voterCount: 4, totalVotes: 9 });
      const service = new AdminService(logoRepository, voteRepository, createMockPhaseService());

      const stats = await service.getDashboardStats(COMPETITION_ID);

      expect(logoRepository.findAllByCompetitionId).toHaveBeenCalledWith(COMPETITION_ID);
      expect(voteRepository.countVoters).toHaveBeenCalledWith(COMPETITION_ID);
      expect(voteRepository.countTotal).toHaveBeenCalledWith(COMPETITION_ID);
      expect(stats.submissionCount).toBe(2);
      expect(stats.submissions).toHaveLength(2);
      expect(stats.submissions[0]).toMatchObject({ id: 'logo-1', uploaderName: '山田太郎' });
      expect(stats.voterCount).toBe(4);
      expect(stats.totalVotes).toBe(9);
    });

    it('投稿・投票が0件の場合、0の集計結果を返す', async () => {
      const service = new AdminService(
        createMockLogoRepository([]),
        createMockVoteRepository(),
        createMockPhaseService(),
      );

      const stats = await service.getDashboardStats(COMPETITION_ID);

      expect(stats).toEqual({
        submissionCount: 0,
        submissions: [],
        voterCount: 0,
        totalVotes: 0,
      });
    });
  });

  describe('getVoteTimeline', () => {
    it('resultsフェーズ未満の場合、PhaseMismatchErrorをスローする', async () => {
      const service = new AdminService(
        createMockLogoRepository(),
        createMockVoteRepository(),
        createMockPhaseService('voting'),
      );

      await expect(service.getVoteTimeline(COMPETITION_ID)).rejects.toThrow(PhaseMismatchError);
    });

    it('投票を時系列順に{logoId, votedAt}へ整形して返し、voterAnonIdは含めない', async () => {
      const votedAt1 = new Date('2026-07-22T00:00:00.000Z');
      const votedAt2 = new Date('2026-07-22T00:01:00.000Z');
      const voteRepository = createMockVoteRepository({}, {}, [
        { id: 'vote-1', logoId: 'logo-1', voterAnonId: 'anon-1', createdAt: votedAt1 },
        { id: 'vote-2', logoId: 'logo-2', voterAnonId: 'anon-2', createdAt: votedAt2 },
      ]);
      const service = new AdminService(
        createMockLogoRepository(),
        voteRepository,
        createMockPhaseService('results'),
      );

      const timeline = await service.getVoteTimeline(COMPETITION_ID);

      expect(timeline).toEqual([
        { logoId: 'logo-1', votedAt: votedAt1 },
        { logoId: 'logo-2', votedAt: votedAt2 },
      ]);
    });

    it('endedフェーズでも取得できる（回帰確認）', async () => {
      const service = new AdminService(
        createMockLogoRepository(),
        createMockVoteRepository(),
        createMockPhaseService('ended'),
      );

      await expect(service.getVoteTimeline(COMPETITION_ID)).resolves.toEqual([]);
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
