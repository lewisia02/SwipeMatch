import { DuplicateVoteError } from '@/lib/errors';
import type { VoteRepository } from '@/lib/repositories/VoteRepository';
import type { PhaseService } from '@/lib/services/PhaseService';

export class VoteService {
  constructor(
    private voteRepository: VoteRepository,
    private phaseService: PhaseService,
  ) {}

  async submitVotes(anonId: string, logoIds: string[]): Promise<void> {
    await this.phaseService.assertPhase('voting');

    // reserveVoteSlotはDBのPRIMARY KEY制約で原子性を保証するため、
    // 同一anonIdからの同時リクエストでも一方だけが投票を確定できる
    const reserved = await this.voteRepository.reserveVoteSlot(anonId);
    if (!reserved) {
      throw new DuplicateVoteError(anonId);
    }

    try {
      await this.voteRepository.createMany(
        logoIds.map((logoId) => ({ logoId, voterAnonId: anonId })),
      );
    } catch (error) {
      // Vote作成に失敗した場合、予約を解放して再投票できるようにする
      try {
        await this.voteRepository.releaseVoteSlot(anonId);
      } catch (cleanupError) {
        console.error('補償処理（投票枠の解放）に失敗しました', cleanupError);
      }
      throw error;
    }
  }

  async hasAlreadyVoted(anonId: string): Promise<boolean> {
    const count = await this.voteRepository.countByAnonId(anonId);
    return count > 0;
  }
}
