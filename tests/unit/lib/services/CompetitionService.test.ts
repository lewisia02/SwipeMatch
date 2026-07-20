import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '@/lib/errors';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import { CompetitionService } from '@/lib/services/CompetitionService';
import type { Competition } from '@/lib/types/Competition';

function buildCompetition(overrides: Partial<Competition> = {}): Competition {
  return {
    id: 'competition-1',
    slug: 'x7k2p9',
    title: '第1回ロゴ作成大会',
    status: 'active',
    currentPhase: 'submission',
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
    ...overrides,
  } as unknown as CompetitionRepository;
}

describe('CompetitionService', () => {
  describe('activate', () => {
    it('既存activeをクローズしてから新規コンペを作成する', async () => {
      const repository = createMockRepository({
        findBySlug: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(buildCompetition({ title: '第2回ロゴ作成大会' })),
      });
      const service = new CompetitionService(repository);

      const result = await service.activate('第2回ロゴ作成大会');

      expect(repository.closeActive).toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: '第2回ロゴ作成大会' }),
      );
      expect(result.title).toBe('第2回ロゴ作成大会');
    });
  });

  describe('findBySlug', () => {
    it('該当するコンペが存在しない場合、NotFoundErrorをスローする', async () => {
      const repository = createMockRepository({ findBySlug: vi.fn().mockResolvedValue(null) });
      const service = new CompetitionService(repository);

      await expect(service.findBySlug('unknown')).rejects.toThrow(NotFoundError);
    });

    it('該当するコンペが存在する場合、それを返す', async () => {
      const competition = buildCompetition();
      const repository = createMockRepository({
        findBySlug: vi.fn().mockResolvedValue(competition),
      });
      const service = new CompetitionService(repository);

      await expect(service.findBySlug('x7k2p9')).resolves.toBe(competition);
    });
  });

  describe('findById', () => {
    it('該当するコンペが存在しない場合、NotFoundErrorをスローする', async () => {
      const repository = createMockRepository({ findById: vi.fn().mockResolvedValue(null) });
      const service = new CompetitionService(repository);

      await expect(service.findById('unknown')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listAll', () => {
    it('リポジトリのfindAllをそのまま返す', async () => {
      const competitions = [buildCompetition()];
      const repository = createMockRepository({ findAll: vi.fn().mockResolvedValue(competitions) });
      const service = new CompetitionService(repository);

      await expect(service.listAll()).resolves.toBe(competitions);
    });
  });
});
