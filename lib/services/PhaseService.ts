import { NotFoundError, PhaseMismatchError, ValidationError } from '@/lib/errors';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import type { EventPhase } from '@/lib/types/Competition';

const PHASE_ORDER: EventPhase[] = ['submission', 'voting', 'results'];

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
