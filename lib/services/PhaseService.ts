import { PhaseMismatchError, ValidationError } from '@/lib/errors';
import type { AppSettingsRepository } from '@/lib/repositories/AppSettingsRepository';
import type { EventPhase } from '@/lib/types/AppSettings';

const PHASE_ORDER: EventPhase[] = ['submission', 'voting', 'results'];

export class PhaseService {
  constructor(private appSettingsRepository: AppSettingsRepository) {}

  async getCurrentPhase(): Promise<EventPhase> {
    const settings = await this.appSettingsRepository.get();
    return settings.currentPhase;
  }

  async assertPhase(expected: EventPhase): Promise<void> {
    const actual = await this.getCurrentPhase();
    if (actual !== expected) {
      throw new PhaseMismatchError(expected, actual);
    }
  }

  async transitionTo(next: EventPhase): Promise<void> {
    const current = await this.getCurrentPhase();
    if (PHASE_ORDER.indexOf(next) <= PHASE_ORDER.indexOf(current)) {
      throw new ValidationError(
        `フェーズを${current}から${next}へ逆行させることはできません`,
        'phase',
      );
    }
    await this.appSettingsRepository.updatePhase(next);
  }
}
