import { describe, expect, it, vi } from 'vitest';
import { NotFoundError, PhaseMismatchError, ValidationError } from '@/lib/errors';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import { PhaseService } from '@/lib/services/PhaseService';
import type { Competition, EventPhase } from '@/lib/types/Competition';

const COMPETITION_ID = 'competition-1';

function createMockRepository(currentPhase: EventPhase | null) {
  return {
    findById: vi.fn().mockResolvedValue(
      currentPhase === null
        ? null
        : ({
            id: COMPETITION_ID,
            slug: 'x7k2p9',
            title: 'テストコンペ',
            status: 'active',
            currentPhase,
            createdAt: new Date(),
            closedAt: null,
          } satisfies Competition),
    ),
    updatePhase: vi.fn().mockResolvedValue(undefined),
  } as unknown as CompetitionRepository;
}

describe('PhaseService', () => {
  describe('getCurrentPhase', () => {
    it('コンペが存在しない場合、NotFoundErrorをスローする', async () => {
      const repository = createMockRepository(null);
      const service = new PhaseService(repository);

      await expect(service.getCurrentPhase(COMPETITION_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('assertPhase', () => {
    it('現在のフェーズが期待通りの場合、何もスローしない', async () => {
      const repository = createMockRepository('submission');
      const service = new PhaseService(repository);

      await expect(service.assertPhase(COMPETITION_ID, 'submission')).resolves.toBeUndefined();
    });

    it('現在のフェーズが期待と異なる場合、PhaseMismatchErrorをスローする', async () => {
      const repository = createMockRepository('voting');
      const service = new PhaseService(repository);

      await expect(service.assertPhase(COMPETITION_ID, 'submission')).rejects.toThrow(
        PhaseMismatchError,
      );
    });
  });

  describe('transitionTo', () => {
    it('前方への遷移は許可される', async () => {
      const repository = createMockRepository('submission');
      const service = new PhaseService(repository);

      await service.transitionTo(COMPETITION_ID, 'voting');

      expect(repository.updatePhase).toHaveBeenCalledWith(COMPETITION_ID, 'voting');
    });

    it('逆行遷移はValidationErrorをスローする', async () => {
      const repository = createMockRepository('results');
      const service = new PhaseService(repository);

      await expect(service.transitionTo(COMPETITION_ID, 'submission')).rejects.toThrow(
        ValidationError,
      );
      expect(repository.updatePhase).not.toHaveBeenCalled();
    });

    it('同一フェーズへの遷移もValidationErrorをスローする', async () => {
      const repository = createMockRepository('voting');
      const service = new PhaseService(repository);

      await expect(service.transitionTo(COMPETITION_ID, 'voting')).rejects.toThrow(
        ValidationError,
      );
    });
  });
});
