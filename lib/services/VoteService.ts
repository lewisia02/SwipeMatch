import { DuplicateVoteError, RunoffNotEligibleError, RunoffNotOpenError, ValidationError } from '@/lib/errors';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import type { LogoRepository } from '@/lib/repositories/LogoRepository';
import type { RunoffRoundRepository } from '@/lib/repositories/RunoffRoundRepository';
import type { VoteRepository } from '@/lib/repositories/VoteRepository';
import type { PhaseService } from '@/lib/services/PhaseService';
import { FINAL_VOTE_ROUND } from '@/lib/types/Vote';
import type { Logo } from '@/lib/types/Logo';

export interface RunoffStatus {
  round: number | null; // 現在投票受付中のラウンド。受付中でなければnull
  logos: Logo[]; // 対象Logo（roundがnullの場合は空配列）
  eligible: boolean; // 通常決選投票（round1）に投票済みか
  alreadyVoted: boolean; // 現在のラウンドに投票済みか
}

export class VoteService {
  constructor(
    private voteRepository: VoteRepository,
    private phaseService: PhaseService,
    private competitionRepository: CompetitionRepository,
    private runoffRoundRepository: RunoffRoundRepository,
    private logoRepository: LogoRepository,
  ) {}

  async submitVotes(competitionId: string, anonId: string, logoIds: string[]): Promise<void> {
    await this.phaseService.assertPhase(competitionId, 'voting');

    // reserveVoteSlotはDBの複合PRIMARY KEY制約で原子性を保証するため、
    // 同一コンペ・同一anonIdからの同時リクエストでも一方だけが投票を確定できる
    const reserved = await this.voteRepository.reserveVoteSlot(competitionId, anonId, FINAL_VOTE_ROUND);
    if (!reserved) {
      throw new DuplicateVoteError(anonId);
    }

    try {
      await this.voteRepository.createMany(
        logoIds.map((logoId) => ({
          competitionId,
          logoId,
          voterAnonId: anonId,
          round: FINAL_VOTE_ROUND,
        })),
      );
    } catch (error) {
      // Vote作成に失敗した場合、予約を解放して再投票できるようにする
      try {
        await this.voteRepository.releaseVoteSlot(competitionId, anonId, FINAL_VOTE_ROUND);
      } catch (cleanupError) {
        console.error('補償処理（投票枠の解放）に失敗しました', cleanupError);
      }
      throw error;
    }
  }

  async hasAlreadyVoted(competitionId: string, anonId: string): Promise<boolean> {
    const count = await this.voteRepository.countByAnonId(competitionId, anonId, FINAL_VOTE_ROUND);
    return count > 0;
  }

  async submitRunoffVote(competitionId: string, anonId: string, logoId: string): Promise<void> {
    await this.phaseService.assertPhase(competitionId, 'runoff');

    const competition = await this.competitionRepository.findById(competitionId);
    const round = competition?.runoffRound ?? null;
    if (round === null) {
      throw new RunoffNotOpenError();
    }

    const finalVoteCount = await this.voteRepository.countByAnonId(
      competitionId,
      anonId,
      FINAL_VOTE_ROUND,
    );
    if (finalVoteCount === 0) {
      throw new RunoffNotEligibleError();
    }

    const latestRound = await this.runoffRoundRepository.findLatestRound(competitionId);
    if (!latestRound || latestRound.round !== round || !latestRound.logoIds.includes(logoId)) {
      throw new ValidationError('対象外の作品には投票できません', 'logoId');
    }

    const reserved = await this.voteRepository.reserveVoteSlot(competitionId, anonId, round);
    if (!reserved) {
      throw new DuplicateVoteError(anonId);
    }

    try {
      await this.voteRepository.createMany([{ competitionId, logoId, voterAnonId: anonId, round }]);
    } catch (error) {
      try {
        await this.voteRepository.releaseVoteSlot(competitionId, anonId, round);
      } catch (cleanupError) {
        console.error('補償処理（投票枠の解放）に失敗しました', cleanupError);
      }
      throw error;
    }
  }

  async getRunoffStatus(competitionId: string, anonId: string): Promise<RunoffStatus> {
    const [competition, eligibleVoteCount] = await Promise.all([
      this.competitionRepository.findById(competitionId),
      this.voteRepository.countByAnonId(competitionId, anonId, FINAL_VOTE_ROUND),
    ]);
    const round = competition?.runoffRound ?? null;
    const eligible = eligibleVoteCount > 0;

    if (round === null) {
      return { round: null, logos: [], eligible, alreadyVoted: false };
    }

    const [latestRound, roundVoteCount, allLogos] = await Promise.all([
      this.runoffRoundRepository.findLatestRound(competitionId),
      this.voteRepository.countByAnonId(competitionId, anonId, round),
      this.logoRepository.findAllByCompetitionId(competitionId),
    ]);

    const targetLogoIds = latestRound?.round === round ? latestRound.logoIds : [];
    const logos = allLogos.filter((logo) => targetLogoIds.includes(logo.id));

    return { round, logos, eligible, alreadyVoted: roundVoteCount > 0 };
  }
}
