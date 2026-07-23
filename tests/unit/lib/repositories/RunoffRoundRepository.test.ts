import { describe, expect, it, vi } from 'vitest';
import { RunoffRoundRepository } from '@/lib/repositories/RunoffRoundRepository';

const COMPETITION_ID = 'competition-1';

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
    limit: vi.fn(() => builder),
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
  id: 'runoff-round-1',
  competition_id: COMPETITION_ID,
  round: 2,
  logo_ids: ['logo-1', 'logo-2'],
  resolution: null,
  created_at: '2026-07-22T00:00:00.000Z',
};

describe('RunoffRoundRepository', () => {
  describe('createRound', () => {
    it('ランオフラウンドを作成する', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ data: ROW, error: null }) as never,
      );
      const repository = new RunoffRoundRepository();

      const result = await repository.createRound(COMPETITION_ID, 2, ['logo-1', 'logo-2']);

      expect(result).toMatchObject({ round: 2, logoIds: ['logo-1', 'logo-2'], resolution: null });
    });

    it('DBエラー時は例外をスローする', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ error: { message: 'DB接続エラー' } }) as never,
      );
      const repository = new RunoffRoundRepository();

      await expect(
        repository.createRound(COMPETITION_ID, 2, ['logo-1', 'logo-2']),
      ).rejects.toThrow('ランオフラウンドの作成に失敗しました');
    });
  });

  describe('findLatestRound', () => {
    it('直近のランオフラウンドを返す', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ data: ROW, error: null }) as never,
      );
      const repository = new RunoffRoundRepository();

      const result = await repository.findLatestRound(COMPETITION_ID);

      expect(result).toMatchObject({ round: 2, logoIds: ['logo-1', 'logo-2'] });
    });

    it('ランオフラウンドが無い場合、nullを返す', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ data: null, error: null }) as never,
      );
      const repository = new RunoffRoundRepository();

      await expect(repository.findLatestRound(COMPETITION_ID)).resolves.toBeNull();
    });
  });

  describe('findAllByCompetitionId', () => {
    it('round昇順でランオフラウンド一覧を返す', async () => {
      const rows = [ROW, { ...ROW, id: 'runoff-round-2', round: 3 }];
      const client = mockSupabaseClient({ data: rows, error: null });
      vi.mocked(getSupabaseClient).mockReturnValue(client as never);
      const repository = new RunoffRoundRepository();

      const result = await repository.findAllByCompetitionId(COMPETITION_ID);

      const builder = client.from.mock.results[0].value;
      expect(builder.order).toHaveBeenCalledWith('round', { ascending: true });
      expect(result).toHaveLength(2);
    });
  });

  describe('resolveAsJointWinner', () => {
    it('正常に解決済みへ更新する', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ error: null }) as never,
      );
      const repository = new RunoffRoundRepository();

      await expect(repository.resolveAsJointWinner(COMPETITION_ID, 2)).resolves.toBeUndefined();
    });

    it('DBエラー時は例外をスローする', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ error: { message: 'DB接続エラー' } }) as never,
      );
      const repository = new RunoffRoundRepository();

      await expect(repository.resolveAsJointWinner(COMPETITION_ID, 2)).rejects.toThrow(
        'ランオフラウンドの解決に失敗しました',
      );
    });
  });
});
