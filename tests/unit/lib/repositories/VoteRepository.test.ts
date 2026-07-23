import { describe, expect, it, vi } from 'vitest';
import { VoteRepository } from '@/lib/repositories/VoteRepository';

const COMPETITION_ID = 'competition-1';

interface QueryResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

function createQueryBuilder(result: QueryResult) {
  const builder = {
    insert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
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

describe('VoteRepository', () => {
  describe('reserveVoteSlot', () => {
    it('未予約のanonIdの場合、trueを返す', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ error: null }) as never,
      );
      const repository = new VoteRepository();

      await expect(repository.reserveVoteSlot(COMPETITION_ID, 'anon-1', 1)).resolves.toBe(true);
    });

    it('既に予約済み(一意制約違反)の場合、falseを返す', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ error: { code: '23505', message: '重複キーです' } }) as never,
      );
      const repository = new VoteRepository();

      await expect(repository.reserveVoteSlot(COMPETITION_ID, 'anon-1', 1)).resolves.toBe(false);
    });

    it('一意制約違反以外のDBエラー時は例外をスローする', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ error: { code: '500', message: 'DB接続エラー' } }) as never,
      );
      const repository = new VoteRepository();

      await expect(repository.reserveVoteSlot(COMPETITION_ID, 'anon-1', 1)).rejects.toThrow(
        '投票枠の確保に失敗しました',
      );
    });
  });

  describe('releaseVoteSlot', () => {
    it('正常に予約を解放する', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ error: null }) as never,
      );
      const repository = new VoteRepository();

      await expect(
        repository.releaseVoteSlot(COMPETITION_ID, 'anon-1', 1),
      ).resolves.toBeUndefined();
    });

    it('DBエラー時は例外をスローする', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ error: { message: 'DB接続エラー' } }) as never,
      );
      const repository = new VoteRepository();

      await expect(repository.releaseVoteSlot(COMPETITION_ID, 'anon-1', 1)).rejects.toThrow(
        '投票枠の解放に失敗しました',
      );
    });
  });

  describe('createMany', () => {
    it('Voteレコードを複数件作成する', async () => {
      const rows = [
        {
          id: 'vote-1',
          competition_id: COMPETITION_ID,
          logo_id: 'logo-1',
          voter_anon_id: 'anon-1',
          created_at: '2026-07-19T00:00:00.000Z',
        },
        {
          id: 'vote-2',
          competition_id: COMPETITION_ID,
          logo_id: 'logo-2',
          voter_anon_id: 'anon-1',
          created_at: '2026-07-19T00:00:00.000Z',
        },
      ];
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ data: rows, error: null }) as never,
      );
      const repository = new VoteRepository();

      const result = await repository.createMany([
        { competitionId: COMPETITION_ID, logoId: 'logo-1', voterAnonId: 'anon-1', round: 1 },
        { competitionId: COMPETITION_ID, logoId: 'logo-2', voterAnonId: 'anon-1', round: 1 },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'vote-1', logoId: 'logo-1', voterAnonId: 'anon-1' });
    });

    it('DBエラー時は例外をスローする', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ error: { message: 'DB接続エラー' } }) as never,
      );
      const repository = new VoteRepository();

      await expect(
        repository.createMany([
          { competitionId: COMPETITION_ID, logoId: 'logo-1', voterAnonId: 'anon-1', round: 1 },
        ]),
      ).rejects.toThrow('Voteの作成に失敗しました');
    });
  });

  describe('countByAnonId', () => {
    it('該当するanonIdの件数を返す', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ count: 3, error: null }) as never,
      );
      const repository = new VoteRepository();

      const result = await repository.countByAnonId(COMPETITION_ID, 'anon-1', 1);

      expect(result).toBe(3);
    });

    it('該当レコードがない場合は0を返す', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ count: null, error: null }) as never,
      );
      const repository = new VoteRepository();

      const result = await repository.countByAnonId(COMPETITION_ID, 'anon-1', 1);

      expect(result).toBe(0);
    });
  });

  describe('findAllByCompetitionId', () => {
    it('created_at昇順でVote一覧を返す', async () => {
      const rows = [
        {
          id: 'vote-1',
          competition_id: COMPETITION_ID,
          logo_id: 'logo-1',
          voter_anon_id: 'anon-1',
          created_at: '2026-07-22T00:00:00.000Z',
        },
        {
          id: 'vote-2',
          competition_id: COMPETITION_ID,
          logo_id: 'logo-2',
          voter_anon_id: 'anon-2',
          created_at: '2026-07-22T00:01:00.000Z',
        },
      ];
      const client = mockSupabaseClient({ data: rows, error: null });
      vi.mocked(getSupabaseClient).mockReturnValue(client as never);
      const repository = new VoteRepository();

      const result = await repository.findAllByCompetitionId(COMPETITION_ID);

      const builder = client.from.mock.results[0].value;
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'vote-1', logoId: 'logo-1' });
    });

    it('DBエラー時は例外をスローする', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ error: { message: 'DB接続エラー' } }) as never,
      );
      const repository = new VoteRepository();

      await expect(repository.findAllByCompetitionId(COMPETITION_ID)).rejects.toThrow(
        'Vote一覧の取得に失敗しました',
      );
    });
  });

  describe('countVoters', () => {
    it('vote_locksの件数を投票済み人数として返す', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ count: 5, error: null }) as never,
      );
      const repository = new VoteRepository();

      const result = await repository.countVoters(COMPETITION_ID);

      expect(result).toBe(5);
    });

    it('該当レコードがない場合は0を返す', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ count: null, error: null }) as never,
      );
      const repository = new VoteRepository();

      const result = await repository.countVoters(COMPETITION_ID);

      expect(result).toBe(0);
    });
  });

  describe('countTotal', () => {
    it('votesの件数を総投票数として返す', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({ count: 12, error: null }) as never,
      );
      const repository = new VoteRepository();

      const result = await repository.countTotal(COMPETITION_ID);

      expect(result).toBe(12);
    });
  });

  describe('countByLogoId', () => {
    it('logoIdごとの得票数を集計する', async () => {
      vi.mocked(getSupabaseClient).mockReturnValue(
        mockSupabaseClient({
          data: [{ logo_id: 'logo-1' }, { logo_id: 'logo-1' }, { logo_id: 'logo-2' }],
          error: null,
        }) as never,
      );
      const repository = new VoteRepository();

      const result = await repository.countByLogoId(COMPETITION_ID, 1);

      expect(result).toEqual({ 'logo-1': 2, 'logo-2': 1 });
    });
  });
});
