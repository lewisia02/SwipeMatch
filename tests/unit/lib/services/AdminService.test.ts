import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, PhaseMismatchError, UnauthorizedError, ValidationError } from '@/lib/errors';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import type { LogoRepository } from '@/lib/repositories/LogoRepository';
import type { RunoffRoundRepository } from '@/lib/repositories/RunoffRoundRepository';
import type { VoteRepository } from '@/lib/repositories/VoteRepository';
import { AdminService } from '@/lib/services/AdminService';
import { PhaseService } from '@/lib/services/PhaseService';
import type { Competition, EventPhase } from '@/lib/types/Competition';
import type { Logo } from '@/lib/types/Logo';
import type { RunoffRound } from '@/lib/types/RunoffRound';

const TEST_PASSWORD = 'test-admin-password';
const TEST_SECRET = 'test-admin-session-secret-value';
const COMPETITION_ID = 'competition-1';

function createMockLogoRepository(logos: Logo[] = []) {
  return {
    findAllByCompetitionId: vi.fn().mockResolvedValue(logos),
  } as unknown as LogoRepository;
}

function createMockVoteRepository(
  voteCountsByRound: Record<number, Record<string, number>> = {},
  stats: { voterCount?: number; totalVotes?: number } = {},
  votes: Array<{ id: string; logoId: string; voterAnonId: string; round?: number; createdAt: Date }> = [],
) {
  return {
    countByLogoId: vi
      .fn()
      .mockImplementation(async (_competitionId: string, round: number) => voteCountsByRound[round] ?? {}),
    countVoters: vi.fn().mockResolvedValue(stats.voterCount ?? 0),
    countTotal: vi.fn().mockResolvedValue(stats.totalVotes ?? 0),
    findAllByCompetitionId: vi.fn().mockResolvedValue(
      votes.map((v) => ({ round: 1, ...v, competitionId: COMPETITION_ID })),
    ),
  } as unknown as VoteRepository;
}

const PHASE_ORDER: EventPhase[] = ['submission', 'voting', 'results', 'runoff', 'ended'];

function createMockPhaseService(currentPhase: EventPhase = 'results') {
  return {
    assertPhase: vi.fn().mockImplementation(async (_competitionId: string, expected: string) => {
      if (expected !== currentPhase) {
        throw new PhaseMismatchError(expected as never, currentPhase);
      }
    }),
    assertPhaseAtLeast: vi
      .fn()
      .mockImplementation(async (_competitionId: string, minPhase: string) => {
        if (PHASE_ORDER.indexOf(currentPhase) < PHASE_ORDER.indexOf(minPhase as EventPhase)) {
          throw new PhaseMismatchError(minPhase as never, currentPhase);
        }
      }),
    transitionTo: vi.fn().mockImplementation(async (_competitionId: string, next: string) => {
      if (PHASE_ORDER.indexOf(next as EventPhase) <= PHASE_ORDER.indexOf(currentPhase)) {
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

function buildCompetition(overrides: Partial<Competition> = {}): Competition {
  return {
    id: COMPETITION_ID,
    slug: 'x7k2p9',
    title: 'テストコンペ',
    status: 'active',
    currentPhase: 'results',
    runoffRound: null,
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    closedAt: null,
    ...overrides,
  };
}

function createMockCompetitionRepository(competition: Competition | null = buildCompetition()) {
  return {
    findById: vi.fn().mockResolvedValue(competition),
    updateRunoffRound: vi.fn().mockResolvedValue(competition),
  } as unknown as CompetitionRepository;
}

function buildRunoffRound(overrides: Partial<RunoffRound> = {}): RunoffRound {
  return {
    id: 'runoff-round-1',
    competitionId: COMPETITION_ID,
    round: 2,
    logoIds: ['logo-1', 'logo-2'],
    resolution: null,
    createdAt: new Date('2026-07-22T00:00:00.000Z'),
    ...overrides,
  };
}

function createMockRunoffRoundRepository(
  options: { latestRound?: RunoffRound | null; allRounds?: RunoffRound[] } = {},
) {
  return {
    createRound: vi.fn().mockResolvedValue(undefined),
    findLatestRound: vi.fn().mockResolvedValue(options.latestRound ?? null),
    findAllByCompetitionId: vi.fn().mockResolvedValue(options.allRounds ?? []),
    resolveAsJointWinner: vi.fn().mockResolvedValue(undefined),
  } as unknown as RunoffRoundRepository;
}

function buildService(options: {
  logoRepository?: LogoRepository;
  voteRepository?: VoteRepository;
  phaseService?: PhaseService;
  competitionRepository?: CompetitionRepository;
  runoffRoundRepository?: RunoffRoundRepository;
} = {}) {
  return new AdminService(
    options.logoRepository ?? createMockLogoRepository(),
    options.voteRepository ?? createMockVoteRepository(),
    options.phaseService ?? createMockPhaseService(),
    options.competitionRepository ?? createMockCompetitionRepository(),
    options.runoffRoundRepository ?? createMockRunoffRoundRepository(),
  );
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
      const service = buildService();

      const result = await service.login(TEST_PASSWORD);

      expect(typeof result.token).toBe('string');
      expect(result.token.split('.')).toHaveLength(3);
    });

    it('誤ったパスワードの場合、UnauthorizedErrorをスローする', async () => {
      const service = buildService();

      await expect(service.login('wrong-password')).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('verifySession', () => {
    it('有効なトークンの場合、何もスローしない', async () => {
      const service = buildService();
      const { token } = await service.login(TEST_PASSWORD);

      await expect(service.verifySession(token)).resolves.toBeUndefined();
    });

    it('トークンが存在しない場合、UnauthorizedErrorをスローする', async () => {
      const service = buildService();

      await expect(service.verifySession(undefined)).rejects.toThrow(UnauthorizedError);
    });

    it('期限切れのトークンの場合、UnauthorizedErrorをスローする', async () => {
      const service = buildService();
      const expiredToken = await new SignJWT({ role: 'admin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 20)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
        .sign(new TextEncoder().encode(TEST_SECRET));

      await expect(service.verifySession(expiredToken)).rejects.toThrow(UnauthorizedError);
    });

    it('異なるシークレットで署名されたトークンの場合、UnauthorizedErrorをスローする', async () => {
      const service = buildService();
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
      const service = buildService({ phaseService });

      await service.setPhase(COMPETITION_ID, 'voting');

      expect(phaseService.transitionTo).toHaveBeenCalledWith(COMPETITION_ID, 'voting');
    });

    it('逆行遷移の場合、ValidationErrorをスローする', async () => {
      const phaseService = createMockPhaseService('results');
      const service = buildService({ phaseService });

      await expect(service.setPhase(COMPETITION_ID, 'submission')).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('getRankedResults', () => {
    it('resultsフェーズ以外の場合、PhaseMismatchErrorをスローする', async () => {
      const service = buildService({ phaseService: createMockPhaseService('voting') });

      await expect(service.getRankedResults(COMPETITION_ID)).rejects.toThrow(PhaseMismatchError);
    });

    it('endedフェーズ(resultsより後方)の場合でも、ランキングを返す（回帰確認）', async () => {
      const logos = [buildLogo({ id: 'logo-1' })];
      const service = buildService({
        logoRepository: createMockLogoRepository(logos),
        voteRepository: createMockVoteRepository({ 1: { 'logo-1': 3 } }),
        phaseService: createMockPhaseService('ended'),
      });

      const results = await service.getRankedResults(COMPETITION_ID);

      expect(results[0]).toMatchObject({ id: 'logo-1', voteCount: 3, rank: 1 });
    });

    it('resultsフェーズの場合、得票数降順のランキングを返す', async () => {
      const logos = [buildLogo({ id: 'logo-1' }), buildLogo({ id: 'logo-2' })];
      const logoRepository = createMockLogoRepository(logos);
      const service = buildService({
        logoRepository,
        voteRepository: createMockVoteRepository({ 1: { 'logo-1': 3, 'logo-2': 5 } }),
        phaseService: createMockPhaseService('results'),
      });

      const results = await service.getRankedResults(COMPETITION_ID);

      expect(logoRepository.findAllByCompetitionId).toHaveBeenCalledWith(COMPETITION_ID);
      expect(results[0]).toMatchObject({ id: 'logo-2', voteCount: 5, rank: 1 });
      expect(results[1]).toMatchObject({ id: 'logo-1', voteCount: 3, rank: 2 });
    });

    it('ランオフが1回で解消した場合、決選投票+ランオフの合算得票数で対象Logoの順位が入れ替わる', async () => {
      const logos = [
        buildLogo({ id: 'logo-1' }),
        buildLogo({ id: 'logo-2' }),
        buildLogo({ id: 'logo-3' }),
      ];
      const voteRepository = createMockVoteRepository({
        1: { 'logo-1': 5, 'logo-2': 5, 'logo-3': 3 },
        2: { 'logo-1': 3, 'logo-2': 7 },
      });
      const runoffRoundRepository = createMockRunoffRoundRepository({
        allRounds: [buildRunoffRound({ round: 2, logoIds: ['logo-1', 'logo-2'], resolution: null })],
      });
      const service = buildService({
        logoRepository: createMockLogoRepository(logos),
        voteRepository,
        phaseService: createMockPhaseService('ended'),
        runoffRoundRepository,
      });

      const results = await service.getRankedResults(COMPETITION_ID);

      expect(results.find((r) => r.id === 'logo-2')).toMatchObject({
        rank: 1,
        voteCount: 12,
        finalRoundVoteCount: 5,
        runoffVoteCount: 7,
        isTiedForRunoff: false,
      });
      expect(results.find((r) => r.id === 'logo-1')).toMatchObject({
        rank: 2,
        voteCount: 8,
        finalRoundVoteCount: 5,
        runoffVoteCount: 3,
        isTiedForRunoff: false,
      });
      expect(results.find((r) => r.id === 'logo-3')).toMatchObject({
        rank: 3,
        voteCount: 3,
        finalRoundVoteCount: 3,
        runoffVoteCount: 0,
      });
    });

    it('ランオフ経由Logoの合算voteCountが、順位の降順と矛盾しない（ランオフ対象外Logoより下位にならない）', async () => {
      const logos = [
        buildLogo({ id: 'logo-1' }),
        buildLogo({ id: 'logo-2' }),
        buildLogo({ id: 'logo-3' }),
        buildLogo({ id: 'logo-4' }),
        buildLogo({ id: 'logo-5' }),
      ];
      // round1: logo-1/2が5票で1位同着、logo-3が4票（同着境界外）、logo-4/5が2票
      // round2（ランオフ）: logo-1が1票、logo-2が0票 → 合算後はlogo-1=6, logo-2=5, logo-3=4のまま降順を維持する
      // （もしround2の得票数だけで上書きすると1,0,4,2,2となり2位→3位で逆転する不具合が再発する）
      const voteRepository = createMockVoteRepository({
        1: { 'logo-1': 5, 'logo-2': 5, 'logo-3': 4, 'logo-4': 2, 'logo-5': 2 },
        2: { 'logo-1': 1, 'logo-2': 0 },
      });
      const runoffRoundRepository = createMockRunoffRoundRepository({
        allRounds: [buildRunoffRound({ round: 2, logoIds: ['logo-1', 'logo-2'], resolution: null })],
      });
      const service = buildService({
        logoRepository: createMockLogoRepository(logos),
        voteRepository,
        phaseService: createMockPhaseService('ended'),
        runoffRoundRepository,
      });

      const results = await service.getRankedResults(COMPETITION_ID);
      const sortedByRank = [...results].sort((a, b) => a.rank - b.rank);

      for (let i = 1; i < sortedByRank.length; i++) {
        expect(sortedByRank[i].voteCount).toBeLessThanOrEqual(sortedByRank[i - 1].voteCount);
      }
    });

    it('ランオフが複数ラウンド継続した場合、全ラウンドの得票を合算した結果で順位が確定する', async () => {
      const logos = [
        buildLogo({ id: 'logo-1' }),
        buildLogo({ id: 'logo-2' }),
        buildLogo({ id: 'logo-3' }),
      ];
      const voteRepository = createMockVoteRepository({
        1: { 'logo-1': 5, 'logo-2': 5, 'logo-3': 2 },
        2: { 'logo-1': 3, 'logo-2': 3 },
        3: { 'logo-1': 6, 'logo-2': 2 },
      });
      const runoffRoundRepository = createMockRunoffRoundRepository({
        allRounds: [
          buildRunoffRound({ round: 2, logoIds: ['logo-1', 'logo-2'], resolution: null }),
          buildRunoffRound({ round: 3, logoIds: ['logo-1', 'logo-2'], resolution: null }),
        ],
      });
      const service = buildService({
        logoRepository: createMockLogoRepository(logos),
        voteRepository,
        phaseService: createMockPhaseService('ended'),
        runoffRoundRepository,
      });

      const results = await service.getRankedResults(COMPETITION_ID);

      expect(results.find((r) => r.id === 'logo-1')).toMatchObject({
        rank: 1,
        voteCount: 14,
        finalRoundVoteCount: 5,
        runoffVoteCount: 9,
        isTiedForRunoff: false,
      });
      expect(results.find((r) => r.id === 'logo-2')).toMatchObject({
        rank: 2,
        voteCount: 10,
        finalRoundVoteCount: 5,
        runoffVoteCount: 5,
      });
      expect(results.find((r) => r.id === 'logo-3')).toMatchObject({
        rank: 3,
        voteCount: 2,
        finalRoundVoteCount: 2,
        runoffVoteCount: 0,
      });
    });

    it('同率優勝が確定した場合、対象LogoにisJointWinnerが立ち順位・得票数を上書きしない', async () => {
      const logos = [
        buildLogo({ id: 'logo-1' }),
        buildLogo({ id: 'logo-2' }),
        buildLogo({ id: 'logo-3' }),
      ];
      const voteRepository = createMockVoteRepository({
        1: { 'logo-1': 5, 'logo-2': 5, 'logo-3': 2 },
      });
      const runoffRoundRepository = createMockRunoffRoundRepository({
        allRounds: [
          buildRunoffRound({ round: 2, logoIds: ['logo-1', 'logo-2'], resolution: 'joint_winner' }),
        ],
      });
      const service = buildService({
        logoRepository: createMockLogoRepository(logos),
        voteRepository,
        phaseService: createMockPhaseService('ended'),
        runoffRoundRepository,
      });

      const results = await service.getRankedResults(COMPETITION_ID);

      const jointWinners = results.filter((r) => r.isJointWinner);
      expect(jointWinners.map((r) => r.id).sort()).toEqual(['logo-1', 'logo-2']);
      expect(jointWinners.every((r) => !r.isTiedForRunoff)).toBe(true);
      // joint_winnerで確定したラウンドの投票は合算対象外（決選投票の得票数のまま）
      expect(jointWinners.every((r) => r.voteCount === 5 && r.runoffVoteCount === 0)).toBe(true);
      expect(results.find((r) => r.id === 'logo-3')).toMatchObject({ rank: 3 });
    });
  });

  describe('startRunoff', () => {
    it('resultsフェーズで同着がある場合、runoffへ遷移しラウンド2を作成する', async () => {
      const logos = [buildLogo({ id: 'logo-1' }), buildLogo({ id: 'logo-2' })];
      const phaseService = createMockPhaseService('results');
      const competitionRepository = createMockCompetitionRepository(
        buildCompetition({ currentPhase: 'results', runoffRound: null }),
      );
      const runoffRoundRepository = createMockRunoffRoundRepository();
      const service = buildService({
        logoRepository: createMockLogoRepository(logos),
        voteRepository: createMockVoteRepository({ 1: { 'logo-1': 5, 'logo-2': 5 } }),
        phaseService,
        competitionRepository,
        runoffRoundRepository,
      });

      await service.startRunoff(COMPETITION_ID);

      expect(phaseService.transitionTo).toHaveBeenCalledWith(COMPETITION_ID, 'runoff');
      expect(runoffRoundRepository.createRound).toHaveBeenCalledWith(COMPETITION_ID, 2, [
        'logo-1',
        'logo-2',
      ]);
      expect(competitionRepository.updateRunoffRound).toHaveBeenCalledWith(COMPETITION_ID, 2);
    });

    it('resultsフェーズで同着が無い場合、ValidationErrorをスローする', async () => {
      const logos = [buildLogo({ id: 'logo-1' }), buildLogo({ id: 'logo-2' })];
      const phaseService = createMockPhaseService('results');
      const runoffRoundRepository = createMockRunoffRoundRepository();
      const service = buildService({
        logoRepository: createMockLogoRepository(logos),
        voteRepository: createMockVoteRepository({ 1: { 'logo-1': 5, 'logo-2': 3 } }),
        phaseService,
        competitionRepository: createMockCompetitionRepository(
          buildCompetition({ currentPhase: 'results', runoffRound: null }),
        ),
        runoffRoundRepository,
      });

      await expect(service.startRunoff(COMPETITION_ID)).rejects.toThrow(ValidationError);
      expect(runoffRoundRepository.createRound).not.toHaveBeenCalled();
    });

    it('runoffフェーズで受付が閉じておりまだ同着の場合、次のラウンドを作成する（再投票）', async () => {
      const runoffRoundRepository = createMockRunoffRoundRepository({
        latestRound: buildRunoffRound({ round: 2, logoIds: ['logo-1', 'logo-2'], resolution: null }),
      });
      const service = buildService({
        voteRepository: createMockVoteRepository({ 2: { 'logo-1': 3, 'logo-2': 3 } }),
        phaseService: createMockPhaseService('runoff'),
        competitionRepository: createMockCompetitionRepository(
          buildCompetition({ currentPhase: 'runoff', runoffRound: null }),
        ),
        runoffRoundRepository,
      });

      await service.startRunoff(COMPETITION_ID);

      expect(runoffRoundRepository.createRound).toHaveBeenCalledWith(COMPETITION_ID, 3, [
        'logo-1',
        'logo-2',
      ]);
    });

    it('runoffフェーズで受付が閉じており同着が解消している場合、ValidationErrorをスローする', async () => {
      const runoffRoundRepository = createMockRunoffRoundRepository({
        latestRound: buildRunoffRound({ round: 2, logoIds: ['logo-1', 'logo-2'], resolution: null }),
      });
      const service = buildService({
        voteRepository: createMockVoteRepository({ 2: { 'logo-1': 3, 'logo-2': 7 } }),
        phaseService: createMockPhaseService('runoff'),
        competitionRepository: createMockCompetitionRepository(
          buildCompetition({ currentPhase: 'runoff', runoffRound: null }),
        ),
        runoffRoundRepository,
      });

      await expect(service.startRunoff(COMPETITION_ID)).rejects.toThrow(ValidationError);
      expect(runoffRoundRepository.createRound).not.toHaveBeenCalled();
    });

    it('直近のラウンドが既に同率優勝で解決済みの場合、ValidationErrorをスローする', async () => {
      const runoffRoundRepository = createMockRunoffRoundRepository({
        latestRound: buildRunoffRound({ round: 2, resolution: 'joint_winner' }),
      });
      const service = buildService({
        phaseService: createMockPhaseService('runoff'),
        competitionRepository: createMockCompetitionRepository(
          buildCompetition({ currentPhase: 'runoff', runoffRound: null }),
        ),
        runoffRoundRepository,
      });

      await expect(service.startRunoff(COMPETITION_ID)).rejects.toThrow(ValidationError);
    });

    it('votingフェーズなど不正な状態から呼び出した場合、ValidationErrorをスローする', async () => {
      const service = buildService({
        competitionRepository: createMockCompetitionRepository(
          buildCompetition({ currentPhase: 'voting' }),
        ),
      });

      await expect(service.startRunoff(COMPETITION_ID)).rejects.toThrow(ValidationError);
    });

    it('存在しないコンペIDの場合、NotFoundErrorをスローする', async () => {
      const service = buildService({ competitionRepository: createMockCompetitionRepository(null) });

      await expect(service.startRunoff(COMPETITION_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('closeRunoff', () => {
    it('投票を締め切り、同着が解消した場合はresolved:trueを返す', async () => {
      const competitionRepository = createMockCompetitionRepository(
        buildCompetition({ currentPhase: 'runoff', runoffRound: 2 }),
      );
      const runoffRoundRepository = createMockRunoffRoundRepository({
        latestRound: buildRunoffRound({ round: 2, logoIds: ['logo-1', 'logo-2'], resolution: null }),
      });
      const service = buildService({
        voteRepository: createMockVoteRepository({ 2: { 'logo-1': 3, 'logo-2': 7 } }),
        competitionRepository,
        runoffRoundRepository,
      });

      const result = await service.closeRunoff(COMPETITION_ID);

      expect(competitionRepository.updateRunoffRound).toHaveBeenCalledWith(COMPETITION_ID, null);
      expect(result).toEqual({ resolved: true });
    });

    it('まだ同着の場合はresolved:falseを返す', async () => {
      const competitionRepository = createMockCompetitionRepository(
        buildCompetition({ currentPhase: 'runoff', runoffRound: 2 }),
      );
      const runoffRoundRepository = createMockRunoffRoundRepository({
        latestRound: buildRunoffRound({ round: 2, logoIds: ['logo-1', 'logo-2'], resolution: null }),
      });
      const service = buildService({
        voteRepository: createMockVoteRepository({ 2: { 'logo-1': 3, 'logo-2': 3 } }),
        competitionRepository,
        runoffRoundRepository,
      });

      const result = await service.closeRunoff(COMPETITION_ID);

      expect(result).toEqual({ resolved: false });
    });

    it('runoffフェーズでない場合、ValidationErrorをスローする', async () => {
      const service = buildService({
        competitionRepository: createMockCompetitionRepository(
          buildCompetition({ currentPhase: 'results', runoffRound: null }),
        ),
      });

      await expect(service.closeRunoff(COMPETITION_ID)).rejects.toThrow(ValidationError);
    });

    it('受付中のラウンドが無い場合、ValidationErrorをスローする', async () => {
      const service = buildService({
        competitionRepository: createMockCompetitionRepository(
          buildCompetition({ currentPhase: 'runoff', runoffRound: null }),
        ),
      });

      await expect(service.closeRunoff(COMPETITION_ID)).rejects.toThrow(ValidationError);
    });
  });

  describe('resolveRunoffAsJointWinner', () => {
    it('締切済みで直近ラウンドがある場合、同率優勝として確定する', async () => {
      const runoffRoundRepository = createMockRunoffRoundRepository({
        latestRound: buildRunoffRound({ round: 2 }),
      });
      const service = buildService({
        competitionRepository: createMockCompetitionRepository(
          buildCompetition({ currentPhase: 'runoff', runoffRound: null }),
        ),
        runoffRoundRepository,
      });

      await service.resolveRunoffAsJointWinner(COMPETITION_ID);

      expect(runoffRoundRepository.resolveAsJointWinner).toHaveBeenCalledWith(COMPETITION_ID, 2);
    });

    it('投票受付中（締切前）の場合、ValidationErrorをスローする', async () => {
      const service = buildService({
        competitionRepository: createMockCompetitionRepository(
          buildCompetition({ currentPhase: 'runoff', runoffRound: 2 }),
        ),
      });

      await expect(service.resolveRunoffAsJointWinner(COMPETITION_ID)).rejects.toThrow(
        ValidationError,
      );
    });

    it('対象のランオフラウンドが存在しない場合、ValidationErrorをスローする', async () => {
      const service = buildService({
        competitionRepository: createMockCompetitionRepository(
          buildCompetition({ currentPhase: 'runoff', runoffRound: null }),
        ),
        runoffRoundRepository: createMockRunoffRoundRepository({ latestRound: null }),
      });

      await expect(service.resolveRunoffAsJointWinner(COMPETITION_ID)).rejects.toThrow(
        ValidationError,
      );
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
      const service = buildService({ logoRepository, voteRepository });

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
      const service = buildService({
        logoRepository: createMockLogoRepository([]),
        voteRepository: createMockVoteRepository(),
      });

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
      const service = buildService({ phaseService: createMockPhaseService('voting') });

      await expect(service.getVoteTimeline(COMPETITION_ID)).rejects.toThrow(PhaseMismatchError);
    });

    it('投票を時系列順に{logoId, votedAt, round}へ整形して返し、voterAnonIdは含めない', async () => {
      const votedAt1 = new Date('2026-07-22T00:00:00.000Z');
      const votedAt2 = new Date('2026-07-22T00:01:00.000Z');
      const voteRepository = createMockVoteRepository({}, {}, [
        { id: 'vote-1', logoId: 'logo-1', voterAnonId: 'anon-1', createdAt: votedAt1 },
        { id: 'vote-2', logoId: 'logo-2', voterAnonId: 'anon-2', createdAt: votedAt2 },
      ]);
      const service = buildService({
        voteRepository,
        phaseService: createMockPhaseService('results'),
      });

      const timeline = await service.getVoteTimeline(COMPETITION_ID);

      expect(timeline).toEqual([
        { logoId: 'logo-1', votedAt: votedAt1, round: 1 },
        { logoId: 'logo-2', votedAt: votedAt2, round: 1 },
      ]);
    });

    it('ランオフの投票にはround2以降の値が設定される', async () => {
      const votedAt1 = new Date('2026-07-22T00:00:00.000Z');
      const votedAt2 = new Date('2026-07-22T00:05:00.000Z');
      const voteRepository = createMockVoteRepository({}, {}, [
        { id: 'vote-1', logoId: 'logo-1', voterAnonId: 'anon-1', round: 1, createdAt: votedAt1 },
        { id: 'vote-2', logoId: 'logo-1', voterAnonId: 'anon-1', round: 2, createdAt: votedAt2 },
      ]);
      const service = buildService({
        voteRepository,
        phaseService: createMockPhaseService('results'),
      });

      const timeline = await service.getVoteTimeline(COMPETITION_ID);

      expect(timeline).toEqual([
        { logoId: 'logo-1', votedAt: votedAt1, round: 1 },
        { logoId: 'logo-1', votedAt: votedAt2, round: 2 },
      ]);
    });

    it('endedフェーズでも取得できる（回帰確認）', async () => {
      const service = buildService({ phaseService: createMockPhaseService('ended') });

      await expect(service.getVoteTimeline(COMPETITION_ID)).resolves.toEqual([]);
    });
  });

  describe('exportResultsCsv', () => {
    it('ランキングをCSV文字列に変換する', async () => {
      const logos = [buildLogo({ id: 'logo-1', uploaderName: '山田太郎', memo: 'メモ1' })];
      const service = buildService({
        logoRepository: createMockLogoRepository(logos),
        voteRepository: createMockVoteRepository({ 1: { 'logo-1': 2 } }),
        phaseService: createMockPhaseService('results'),
      });

      const csv = await service.exportResultsCsv(COMPETITION_ID);

      expect(csv).toContain('rank,imageUrl,uploaderName,memo,voteCount');
      expect(csv).toContain('1,https://example.com/logo-1.png,山田太郎,メモ1,2');
    });

    it('=+-@で始まるフィールドは数式実行を防ぐためタブを付与する（CSVインジェクション対策）', async () => {
      const logos = [buildLogo({ id: 'logo-1', uploaderName: '=SUM(A1:A10)', memo: '@メモ' })];
      const service = buildService({
        logoRepository: createMockLogoRepository(logos),
        voteRepository: createMockVoteRepository({ 1: { 'logo-1': 1 } }),
        phaseService: createMockPhaseService('results'),
      });

      const csv = await service.exportResultsCsv(COMPETITION_ID);

      expect(csv).toContain('\t=SUM(A1:A10)');
      expect(csv).toContain('\t@メモ');
    });
  });
});
