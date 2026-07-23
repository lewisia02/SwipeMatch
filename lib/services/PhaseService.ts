import { NotFoundError, PhaseMismatchError, ValidationError } from '@/lib/errors';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import type { EventPhase } from '@/lib/types/Competition';

const PHASE_ORDER: EventPhase[] = ['submission', 'voting', 'results', 'runoff', 'ended'];

export class PhaseService {
  constructor(private competitionRepository: CompetitionRepository) {}

  async getCurrentPhase(competitionId: string): Promise<EventPhase> {
    const competition = await this.competitionRepository.findById(competitionId);
    if (!competition) {
      throw new NotFoundError('指定されたコンペが見つかりません');
    }
    return competition.currentPhase;
  }

  async assertPhase(competitionId: string, expected: EventPhase): Promise<void> {
    const actual = await this.getCurrentPhase(competitionId);
    if (actual !== expected) {
      throw new PhaseMismatchError(expected, actual);
    }
  }

  // 結果発表など、resultsフェーズ到達後(=results以降、endedを含む)であれば
  // 継続してアクセスを許可したい操作向け。assertPhaseと異なり完全一致を要求しない
  async assertPhaseAtLeast(competitionId: string, minPhase: EventPhase): Promise<void> {
    const actual = await this.getCurrentPhase(competitionId);
    if (PHASE_ORDER.indexOf(actual) < PHASE_ORDER.indexOf(minPhase)) {
      throw new PhaseMismatchError(minPhase, actual);
    }
  }

  async transitionTo(competitionId: string, next: EventPhase): Promise<void> {
    const current = await this.getCurrentPhase(competitionId);
    if (PHASE_ORDER.indexOf(next) <= PHASE_ORDER.indexOf(current)) {
      throw new ValidationError(
        `フェーズを${current}から${next}へ逆行させることはできません`,
        'phase',
      );
    }
    await this.competitionRepository.updatePhase(competitionId, next);
  }
}
