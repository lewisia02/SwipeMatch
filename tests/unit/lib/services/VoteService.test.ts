import { describe, expect, it, vi } from 'vitest';
import { DuplicateVoteError, PhaseMismatchError } from '@/lib/errors';
import type { VoteRepository } from '@/lib/repositories/VoteRepository';
import type { PhaseService } from '@/lib/services/PhaseService';
import { VoteService } from '@/lib/services/VoteService';

const COMPETITION_ID = 'competition-1';

function createMockVoteRepository(options: { reserved?: boolean; existingVoteCount?: number } = {}) {
  const { reserved = true, existingVoteCount = 0 } = options;
  return {
    reserveVoteSlot: vi.fn().mockResolvedValue(reserved),
    releaseVoteSlot: vi.fn().mockResolvedValue(undefined),
    createMany: vi.fn().mockResolvedValue([]),
    countByAnonId: vi.fn().mockResolvedValue(existingVoteCount),
    countByLogoId: vi.fn(),
  } as unknown as VoteRepository;
}

function createMockPhaseService(shouldThrow = false) {
  return {
    assertPhase: shouldThrow
      ? vi.fn().mockRejectedValue(new PhaseMismatchError('voting', 'submission'))
      : vi.fn().mockResolvedValue(undefined),
  } as unknown as PhaseService;
}

describe('VoteService', () => {
  describe('submitVotes', () => {
    it('未投票の場合、投票枠を確保しVoteレコードを作成する', async () => {
      const voteRepository = createMockVoteRepository({ reserved: true });
      const phaseService = createMockPhaseService();
      const service = new VoteService(voteRepository, phaseService);

      await service.submitVotes(COMPETITION_ID, 'anon-1', ['logo-1', 'logo-2']);

      expect(voteRepository.reserveVoteSlot).toHaveBeenCalledWith(COMPETITION_ID, 'anon-1');
      expect(voteRepository.createMany).toHaveBeenCalledWith([
        { competitionId: COMPETITION_ID, logoId: 'logo-1', voterAnonId: 'anon-1' },
        { competitionId: COMPETITION_ID, logoId: 'logo-2', voterAnonId: 'anon-1' },
      ]);
    });

    it('votingフェーズでない場合、PhaseMismatchErrorをスローする', async () => {
      const voteRepository = createMockVoteRepository();
      const phaseService = createMockPhaseService(true);
      const service = new VoteService(voteRepository, phaseService);

      await expect(service.submitVotes(COMPETITION_ID, 'anon-1', ['logo-1'])).rejects.toThrow(
        PhaseMismatchError,
      );
      expect(voteRepository.reserveVoteSlot).not.toHaveBeenCalled();
      expect(voteRepository.createMany).not.toHaveBeenCalled();
    });

    it('投票枠の確保に失敗した場合（既に投票済み・同時リクエスト含む）、DuplicateVoteErrorをスローする', async () => {
      const voteRepository = createMockVoteRepository({ reserved: false });
      const phaseService = createMockPhaseService();
      const service = new VoteService(voteRepository, phaseService);

      await expect(service.submitVotes(COMPETITION_ID, 'anon-1', ['logo-1'])).rejects.toThrow(
        DuplicateVoteError,
      );
      expect(voteRepository.createMany).not.toHaveBeenCalled();
    });

    it('Vote作成が失敗した場合、投票枠を解放してから元のエラーをスローする', async () => {
      const voteRepository = createMockVoteRepository({ reserved: true });
      voteRepository.createMany = vi.fn().mockRejectedValue(new Error('DB接続エラー'));
      const phaseService = createMockPhaseService();
      const service = new VoteService(voteRepository, phaseService);

      await expect(service.submitVotes(COMPETITION_ID, 'anon-1', ['logo-1'])).rejects.toThrow(
        'DB接続エラー',
      );
      expect(voteRepository.releaseVoteSlot).toHaveBeenCalledWith(COMPETITION_ID, 'anon-1');
    });
  });

  describe('hasAlreadyVoted', () => {
    it('投票済みレコードがある場合、trueを返す', async () => {
      const voteRepository = createMockVoteRepository({ existingVoteCount: 1 });
      const phaseService = createMockPhaseService();
      const service = new VoteService(voteRepository, phaseService);

      await expect(service.hasAlreadyVoted(COMPETITION_ID, 'anon-1')).resolves.toBe(true);
    });

    it('投票済みレコードがない場合、falseを返す', async () => {
      const voteRepository = createMockVoteRepository({ existingVoteCount: 0 });
      const phaseService = createMockPhaseService();
      const service = new VoteService(voteRepository, phaseService);

      await expect(service.hasAlreadyVoted(COMPETITION_ID, 'anon-1')).resolves.toBe(false);
    });
  });
});
