import { describe, expect, it, vi } from 'vitest';
import { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';

interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
}

function createQueryBuilder(result: QueryResult) {
  const builder = {
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: QueryResult) => void) => resolve(result),
  };
  return builder;
}

function mockSupabaseClient(result: QueryResult) {
  const builder = createQueryBuilder(result);
  return { from: vi.fn(() => builder) };
}

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: vi.fn(),
}));

const { getSupabaseClient } = await import('@/lib/supabase/client');

const ROW = {
  id: 'competition-1',
  slug: 'x7k2p9',
  title: '第1回ロゴ作成大会',
  status: 'active' as const,
  current_phase: 'submission' as const,
  created_at: '2026-07-20T00:00:00.000Z',
  closed_at: null,
};

describe('CompetitionRepository', () => {
  describe('create', () => {
    it('Competitionレコードを作成する', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ data: ROW, error: null }) as never,
      );
      const repository = new CompetitionRepository();

      const result = await repository.create({ slug: 'x7k2p9', title: '第1回ロゴ作成大会' });

      expect(result).toMatchObject({ id: 'competition-1', slug: 'x7k2p9', status: 'active' });
    });

    it('DBエラー時は例外をスローする', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ error: { message: 'DB接続エラー' } }) as never,
      );
      const repository = new CompetitionRepository();

      await expect(
        repository.create({ slug: 'x7k2p9', title: '第1回ロゴ作成大会' }),
      ).rejects.toThrow('Competitionの作成に失敗しました');
    });
  });

  describe('closeActive', () => {
    it('DBエラー時は例外をスローする', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ error: { message: 'DB接続エラー' } }) as never,
      );
      const repository = new CompetitionRepository();

      await expect(repository.closeActive()).rejects.toThrow('Competitionのクローズに失敗しました');
    });

    it('正常にクローズする', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ error: null }) as never,
      );
      const repository = new CompetitionRepository();

      await expect(repository.closeActive()).resolves.toBeUndefined();
    });
  });

  describe('findBySlug', () => {
    it('該当するslugのCompetitionを返す', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ data: ROW, error: null }) as never,
      );
      const repository = new CompetitionRepository();

      const result = await repository.findBySlug('x7k2p9');

      expect(result).toMatchObject({ id: 'competition-1', slug: 'x7k2p9' });
    });

    it('該当するslugが無い場合、nullを返す', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ data: null, error: null }) as never,
      );
      const repository = new CompetitionRepository();

      await expect(repository.findBySlug('unknown')).resolves.toBeNull();
    });
  });

  describe('findActive', () => {
    it('activeなCompetitionが無い場合、nullを返す', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ data: null, error: null }) as never,
      );
      const repository = new CompetitionRepository();

      await expect(repository.findActive()).resolves.toBeNull();
    });
  });

  describe('findAll', () => {
    it('Competition一覧を返す', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ data: [ROW], error: null }) as never,
      );
      const repository = new CompetitionRepository();

      const result = await repository.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'competition-1' });
    });
  });

  describe('updatePhase', () => {
    it('currentPhaseを更新したCompetitionを返す', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({
          data: { ...ROW, current_phase: 'voting' },
          error: null,
        }) as never,
      );
      const repository = new CompetitionRepository();

      const result = await repository.updatePhase('competition-1', 'voting');

      expect(result.currentPhase).toBe('voting');
    });
  });
});
