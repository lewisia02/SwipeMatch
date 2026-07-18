import { describe, expect, it, vi } from 'vitest';
import { PhaseMismatchError, ValidationError } from '@/lib/errors';
import type { AppSettingsRepository } from '@/lib/repositories/AppSettingsRepository';
import { PhaseService } from '@/lib/services/PhaseService';
import type { AppSettings } from '@/lib/types/AppSettings';

function createMockRepository(currentPhase: AppSettings['currentPhase']) {
  return {
    get: vi.fn().mockResolvedValue({
      id: 'singleton',
      currentPhase,
      updatedAt: new Date(),
    } satisfies AppSettings),
    updatePhase: vi.fn().mockResolvedValue(undefined),
  } as unknown as AppSettingsRepository;
}

describe('PhaseService', () => {
  describe('assertPhase', () => {
    it('現在のフェーズが期待通りの場合、何もスローしない', async () => {
      const repository = createMockRepository('submission');
      const service = new PhaseService(repository);

      await expect(service.assertPhase('submission')).resolves.toBeUndefined();
    });

    it('現在のフェーズが期待と異なる場合、PhaseMismatchErrorをスローする', async () => {
      const repository = createMockRepository('voting');
      const service = new PhaseService(repository);

      await expect(service.assertPhase('submission')).rejects.toThrow(PhaseMismatchError);
    });
  });

  describe('transitionTo', () => {
    it('前方への遷移は許可される', async () => {
      const repository = createMockRepository('submission');
      const service = new PhaseService(repository);

      await service.transitionTo('voting');

      expect(repository.updatePhase).toHaveBeenCalledWith('voting');
    });

    it('逆行遷移はValidationErrorをスローする', async () => {
      const repository = createMockRepository('results');
      const service = new PhaseService(repository);

      await expect(service.transitionTo('submission')).rejects.toThrow(ValidationError);
      expect(repository.updatePhase).not.toHaveBeenCalled();
    });

    it('同一フェーズへの遷移もValidationErrorをスローする', async () => {
      const repository = createMockRepository('voting');
      const service = new PhaseService(repository);

      await expect(service.transitionTo('voting')).rejects.toThrow(ValidationError);
    });
  });
});
