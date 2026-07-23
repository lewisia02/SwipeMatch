import { describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import type { LogoRepository } from '@/lib/repositories/LogoRepository';
import type { RunoffRoundRepository } from '@/lib/repositories/RunoffRoundRepository';
import type { VoteRepository } from '@/lib/repositories/VoteRepository';
import { CompetitionService } from '@/lib/services/CompetitionService';
import type { Competition } from '@/lib/types/Competition';
import type { Logo } from '@/lib/types/Logo';

function buildCompetition(overrides: Partial<Competition> = {}): Competition {
  return {
    id: 'competition-1',
    slug: 'x7k2p9',
    title: '第1回ロゴ作成大会',
    status: 'active',
    currentPhase: 'submission',
    runoffRound: null,
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    closedAt: null,
    ...overrides,
  };
}

function createMockRepository(overrides: Partial<CompetitionRepository> = {}) {
  return {
    create: vi.fn().mockResolvedValue(buildCompetition()),
    closeActive: vi.fn().mockResolvedValue(undefined),
    findBySlug: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    findActive: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    updatePhase: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as CompetitionRepository;
}

function buildLogo(overrides: Partial<Logo> = {}): Logo {
  return {
    id: 'logo-1',
    competitionId: 'competition-1',
    imageUrl: 'https://example.com/storage/v1/object/public/logos/abc123.jpg',
    uploaderName: '山田太郎',
    memo: '一口メモ',
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    ...overrides,
  };
}

function createMockLogoRepository(overrides: Partial<LogoRepository> = {}) {
  return {
    findAllByCompetitionId: vi.fn().mockResolvedValue([]),
    deleteAllByCompetitionId: vi.fn().mockResolvedValue(undefined),
    deleteStorageObject: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as LogoRepository;
}

function createMockVoteRepository(overrides: Partial<VoteRepository> = {}) {
  return {
    deleteLocksByCompetitionId: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as VoteRepository;
}

function createMockRunoffRoundRepository(overrides: Partial<RunoffRoundRepository> = {}) {
  return {
    deleteAllByCompetitionId: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as RunoffRoundRepository;
}

function buildService(options: {
  competitionRepository?: CompetitionRepository;
  logoRepository?: LogoRepository;
  voteRepository?: VoteRepository;
  runoffRoundRepository?: RunoffRoundRepository;
} = {}) {
  return new CompetitionService(
    options.competitionRepository ?? createMockRepository(),
    options.logoRepository ?? createMockLogoRepository(),
    options.voteRepository ?? createMockVoteRepository(),
    options.runoffRoundRepository ?? createMockRunoffRoundRepository(),
  );
}

describe('CompetitionService', () => {
  describe('activate', () => {
    it('既存activeをクローズしてから新規コンペを作成する', async () => {
      const competitionRepository = createMockRepository({
        findBySlug: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(buildCompetition({ title: '第2回ロゴ作成大会' })),
      });
      const service = buildService({ competitionRepository });

      const result = await service.activate('第2回ロゴ作成大会');

      expect(competitionRepository.closeActive).toHaveBeenCalled();
      expect(competitionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: '第2回ロゴ作成大会' }),
      );
      expect(result.title).toBe('第2回ロゴ作成大会');
    });
  });

  describe('findBySlug', () => {
    it('該当するコンペが存在しない場合、NotFoundErrorをスローする', async () => {
      const competitionRepository = createMockRepository({ findBySlug: vi.fn().mockResolvedValue(null) });
      const service = buildService({ competitionRepository });

      await expect(service.findBySlug('unknown')).rejects.toThrow(NotFoundError);
    });

    it('該当するコンペが存在する場合、それを返す', async () => {
      const competition = buildCompetition();
      const competitionRepository = createMockRepository({
        findBySlug: vi.fn().mockResolvedValue(competition),
      });
      const service = buildService({ competitionRepository });

      await expect(service.findBySlug('x7k2p9')).resolves.toBe(competition);
    });
  });

  describe('findById', () => {
    it('該当するコンペが存在しない場合、NotFoundErrorをスローする', async () => {
      const competitionRepository = createMockRepository({ findById: vi.fn().mockResolvedValue(null) });
      const service = buildService({ competitionRepository });

      await expect(service.findById('unknown')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listAll', () => {
    it('リポジトリのfindAllをそのまま返す', async () => {
      const competitions = [buildCompetition()];
      const competitionRepository = createMockRepository({ findAll: vi.fn().mockResolvedValue(competitions) });
      const service = buildService({ competitionRepository });

      await expect(service.listAll()).resolves.toBe(competitions);
    });
  });

  describe('remove', () => {
    it('activeなコンペの場合、ValidationErrorをスローし何も削除しない', async () => {
      const competitionRepository = createMockRepository({
        findById: vi.fn().mockResolvedValue(buildCompetition({ status: 'active' })),
      });
      const logoRepository = createMockLogoRepository();
      const voteRepository = createMockVoteRepository();
      const runoffRoundRepository = createMockRunoffRoundRepository();
      const service = buildService({
        competitionRepository,
        logoRepository,
        voteRepository,
        runoffRoundRepository,
      });

      await expect(service.remove('competition-1')).rejects.toThrow(ValidationError);
      expect(logoRepository.deleteAllByCompetitionId).not.toHaveBeenCalled();
      expect(runoffRoundRepository.deleteAllByCompetitionId).not.toHaveBeenCalled();
      expect(competitionRepository.delete).not.toHaveBeenCalled();
    });

    it('closedなコンペの場合、Storage画像・logos・vote_locks・runoff_rounds・competitionsを順に削除する', async () => {
      const competitionRepository = createMockRepository({
        findById: vi.fn().mockResolvedValue(buildCompetition({ status: 'closed' })),
      });
      const logos = [
        buildLogo({ id: 'logo-1', imageUrl: 'https://example.com/storage/logos/abc.jpg' }),
        buildLogo({ id: 'logo-2', imageUrl: 'https://example.com/storage/logos/def.jpg' }),
      ];
      const logoRepository = createMockLogoRepository({
        findAllByCompetitionId: vi.fn().mockResolvedValue(logos),
      });
      const voteRepository = createMockVoteRepository();
      const runoffRoundRepository = createMockRunoffRoundRepository();
      const service = buildService({
        competitionRepository,
        logoRepository,
        voteRepository,
        runoffRoundRepository,
      });

      await service.remove('competition-1');

      expect(logoRepository.deleteStorageObject).toHaveBeenCalledWith('abc.jpg');
      expect(logoRepository.deleteStorageObject).toHaveBeenCalledWith('def.jpg');
      expect(logoRepository.deleteAllByCompetitionId).toHaveBeenCalledWith('competition-1');
      expect(voteRepository.deleteLocksByCompetitionId).toHaveBeenCalledWith('competition-1');
      expect(runoffRoundRepository.deleteAllByCompetitionId).toHaveBeenCalledWith('competition-1');
      expect(competitionRepository.delete).toHaveBeenCalledWith('competition-1');
    });

    it('存在しないコンペの場合、NotFoundErrorをスローする', async () => {
      const competitionRepository = createMockRepository({ findById: vi.fn().mockResolvedValue(null) });
      const service = buildService({ competitionRepository });

      await expect(service.remove('unknown')).rejects.toThrow(NotFoundError);
    });
  });
});
