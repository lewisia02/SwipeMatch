import { describe, expect, it, vi } from 'vitest';
import {
  DuplicateVoteError,
  PhaseMismatchError,
  RunoffNotEligibleError,
  RunoffNotOpenError,
  ValidationError,
} from '@/lib/errors';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import type { LogoRepository } from '@/lib/repositories/LogoRepository';
import type { RunoffRoundRepository } from '@/lib/repositories/RunoffRoundRepository';
import type { VoteRepository } from '@/lib/repositories/VoteRepository';
import type { PhaseService } from '@/lib/services/PhaseService';
import { VoteService } from '@/lib/services/VoteService';
import type { Competition } from '@/lib/types/Competition';
import type { Logo } from '@/lib/types/Logo';
import type { RunoffRound } from '@/lib/types/RunoffRound';

const COMPETITION_ID = 'competition-1';

function createMockVoteRepository(
  options: {
    reserved?: boolean;
    finalVoteCount?: number;
    roundVoteCount?: number;
  } = {},
) {
  const { reserved = true, finalVoteCount = 0, roundVoteCount = 0 } = options;
  return {
    reserveVoteSlot: vi.fn().mockResolvedValue(reserved),
    releaseVoteSlot: vi.fn().mockResolvedValue(undefined),
    createMany: vi.fn().mockResolvedValue([]),
    countByAnonId: vi
      .fn()
      .mockImplementation(async (_competitionId: string, _anonId: string, round: number) =>
        round === 1 ? finalVoteCount : roundVoteCount,
      ),
    countByLogoId: vi.fn(),
  } as unknown as VoteRepository;
}

function createMockPhaseService(shouldThrow = false, expectedPhase: string = 'voting') {
  return {
    assertPhase: vi.fn().mockImplementation(async (_competitionId: string, expected: string) => {
      if (shouldThrow) {
        throw new PhaseMismatchError(expected as never, expectedPhase as never);
      }
    }),
  } as unknown as PhaseService;
}

function buildCompetition(overrides: Partial<Competition> = {}): Competition {
  return {
    id: COMPETITION_ID,
    slug: 'x7k2p9',
    title: 'テストコンペ',
    status: 'active',
    currentPhase: 'runoff',
    runoffRound: 2,
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    closedAt: null,
    ...overrides,
  };
}

function createMockCompetitionRepository(competition: Competition | null = buildCompetition()) {
  return {
    findById: vi.fn().mockResolvedValue(competition),
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

function createMockRunoffRoundRepository(latestRound: RunoffRound | null = buildRunoffRound()) {
  return {
    findLatestRound: vi.fn().mockResolvedValue(latestRound),
  } as unknown as RunoffRoundRepository;
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

function createMockLogoRepository(logos: Logo[] = [buildLogo({ id: 'logo-1' }), buildLogo({ id: 'logo-2' })]) {
  return {
    findAllByCompetitionId: vi.fn().mockResolvedValue(logos),
  } as unknown as LogoRepository;
}

function buildService(options: {
  voteRepository?: VoteRepository;
  phaseService?: PhaseService;
  competitionRepository?: CompetitionRepository;
  runoffRoundRepository?: RunoffRoundRepository;
  logoRepository?: LogoRepository;
} = {}) {
  return new VoteService(
    options.voteRepository ?? createMockVoteRepository(),
    options.phaseService ?? createMockPhaseService(),
    options.competitionRepository ?? createMockCompetitionRepository(),
    options.runoffRoundRepository ?? createMockRunoffRoundRepository(),
    options.logoRepository ?? createMockLogoRepository(),
  );
}

describe('VoteService', () => {
  describe('submitVotes', () => {
    it('未投票の場合、投票枠を確保しVoteレコードを作成する', async () => {
      const voteRepository = createMockVoteRepository({ reserved: true });
      const phaseService = createMockPhaseService();
      const service = buildService({ voteRepository, phaseService });

      await service.submitVotes(COMPETITION_ID, 'anon-1', ['logo-1', 'logo-2']);

      expect(voteRepository.reserveVoteSlot).toHaveBeenCalledWith(COMPETITION_ID, 'anon-1', 1);
      expect(voteRepository.createMany).toHaveBeenCalledWith([
        { competitionId: COMPETITION_ID, logoId: 'logo-1', voterAnonId: 'anon-1', round: 1 },
        { competitionId: COMPETITION_ID, logoId: 'logo-2', voterAnonId: 'anon-1', round: 1 },
      ]);
    });

    it('votingフェーズでない場合、PhaseMismatchErrorをスローする', async () => {
      const voteRepository = createMockVoteRepository();
      const phaseService = createMockPhaseService(true, 'submission');
      const service = buildService({ voteRepository, phaseService });

      await expect(service.submitVotes(COMPETITION_ID, 'anon-1', ['logo-1'])).rejects.toThrow(
        PhaseMismatchError,
      );
      expect(voteRepository.reserveVoteSlot).not.toHaveBeenCalled();
      expect(voteRepository.createMany).not.toHaveBeenCalled();
    });

    it('投票枠の確保に失敗した場合（既に投票済み・同時リクエスト含む）、DuplicateVoteErrorをスローする', async () => {
      const voteRepository = createMockVoteRepository({ reserved: false });
      const phaseService = createMockPhaseService();
      const service = buildService({ voteRepository, phaseService });

      await expect(service.submitVotes(COMPETITION_ID, 'anon-1', ['logo-1'])).rejects.toThrow(
        DuplicateVoteError,
      );
      expect(voteRepository.createMany).not.toHaveBeenCalled();
    });

    it('Vote作成が失敗した場合、投票枠を解放してから元のエラーをスローする', async () => {
      const voteRepository = createMockVoteRepository({ reserved: true });
      voteRepository.createMany = vi.fn().mockRejectedValue(new Error('DB接続エラー'));
      const phaseService = createMockPhaseService();
      const service = buildService({ voteRepository, phaseService });

      await expect(service.submitVotes(COMPETITION_ID, 'anon-1', ['logo-1'])).rejects.toThrow(
        'DB接続エラー',
      );
      expect(voteRepository.releaseVoteSlot).toHaveBeenCalledWith(COMPETITION_ID, 'anon-1', 1);
    });
  });

  describe('hasAlreadyVoted', () => {
    it('投票済みレコードがある場合、trueを返す', async () => {
      const voteRepository = createMockVoteRepository({ finalVoteCount: 1 });
      const service = buildService({ voteRepository });

      await expect(service.hasAlreadyVoted(COMPETITION_ID, 'anon-1')).resolves.toBe(true);
    });

    it('投票済みレコードがない場合、falseを返す', async () => {
      const voteRepository = createMockVoteRepository({ finalVoteCount: 0 });
      const service = buildService({ voteRepository });

      await expect(service.hasAlreadyVoted(COMPETITION_ID, 'anon-1')).resolves.toBe(false);
    });
  });

  describe('submitRunoffVote', () => {
    it('round1投票済みかつ対象Logoの場合、投票枠を確保しVoteレコードを作成する', async () => {
      const voteRepository = createMockVoteRepository({ reserved: true, finalVoteCount: 1 });
      const service = buildService({ voteRepository });

      await service.submitRunoffVote(COMPETITION_ID, 'anon-1', 'logo-1');

      expect(voteRepository.reserveVoteSlot).toHaveBeenCalledWith(COMPETITION_ID, 'anon-1', 2);
      expect(voteRepository.createMany).toHaveBeenCalledWith([
        { competitionId: COMPETITION_ID, logoId: 'logo-1', voterAnonId: 'anon-1', round: 2 },
      ]);
    });

    it('runoffフェーズでない場合、PhaseMismatchErrorをスローする', async () => {
      const phaseService = createMockPhaseService(true, 'results');
      const service = buildService({ phaseService });

      await expect(
        service.submitRunoffVote(COMPETITION_ID, 'anon-1', 'logo-1'),
      ).rejects.toThrow(PhaseMismatchError);
    });

    it('現在受付中のランオフラウンドが無い場合、RunoffNotOpenErrorをスローする', async () => {
      const competitionRepository = createMockCompetitionRepository(
        buildCompetition({ runoffRound: null }),
      );
      const service = buildService({ competitionRepository });

      await expect(
        service.submitRunoffVote(COMPETITION_ID, 'anon-1', 'logo-1'),
      ).rejects.toThrow(RunoffNotOpenError);
    });

    it('round1未投票のanonIdの場合、RunoffNotEligibleErrorをスローする', async () => {
      const voteRepository = createMockVoteRepository({ finalVoteCount: 0 });
      const service = buildService({ voteRepository });

      await expect(
        service.submitRunoffVote(COMPETITION_ID, 'anon-1', 'logo-1'),
      ).rejects.toThrow(RunoffNotEligibleError);
    });

    it('対象外のLogoIdの場合、ValidationErrorをスローする', async () => {
      const voteRepository = createMockVoteRepository({ finalVoteCount: 1 });
      const service = buildService({ voteRepository });

      await expect(
        service.submitRunoffVote(COMPETITION_ID, 'anon-1', 'logo-999'),
      ).rejects.toThrow(ValidationError);
    });

    it('既に当該ラウンドに投票済みの場合、DuplicateVoteErrorをスローする', async () => {
      const voteRepository = createMockVoteRepository({ reserved: false, finalVoteCount: 1 });
      const service = buildService({ voteRepository });

      await expect(
        service.submitRunoffVote(COMPETITION_ID, 'anon-1', 'logo-1'),
      ).rejects.toThrow(DuplicateVoteError);
    });
  });

  describe('getRunoffStatus', () => {
    it('ランオフ受付中でround1投票済み・当該ラウンド未投票の場合、対象Logoと共に返す', async () => {
      const voteRepository = createMockVoteRepository({ finalVoteCount: 1, roundVoteCount: 0 });
      const service = buildService({ voteRepository });

      const status = await service.getRunoffStatus(COMPETITION_ID, 'anon-1');

      expect(status).toMatchObject({ round: 2, eligible: true, alreadyVoted: false });
      expect(status.logos.map((logo) => logo.id)).toEqual(['logo-1', 'logo-2']);
    });

    it('ランオフ受付中でない場合、roundはnullで対象Logoは空になる', async () => {
      const competitionRepository = createMockCompetitionRepository(
        buildCompetition({ runoffRound: null }),
      );
      const service = buildService({ competitionRepository });

      const status = await service.getRunoffStatus(COMPETITION_ID, 'anon-1');

      expect(status).toMatchObject({ round: null, logos: [], alreadyVoted: false });
    });

    it('round1未投票の場合、eligibleがfalseになる', async () => {
      const voteRepository = createMockVoteRepository({ finalVoteCount: 0 });
      const service = buildService({ voteRepository });

      const status = await service.getRunoffStatus(COMPETITION_ID, 'anon-1');

      expect(status.eligible).toBe(false);
    });

    it('当該ラウンドに投票済みの場合、alreadyVotedがtrueになる', async () => {
      const voteRepository = createMockVoteRepository({ finalVoteCount: 1, roundVoteCount: 1 });
      const service = buildService({ voteRepository });

      const status = await service.getRunoffStatus(COMPETITION_ID, 'anon-1');

      expect(status.alreadyVoted).toBe(true);
    });
  });
});
