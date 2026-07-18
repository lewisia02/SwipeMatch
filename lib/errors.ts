import type { EventPhase } from './types/AppSettings';

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class PhaseMismatchError extends Error {
  constructor(
    public expectedPhase: EventPhase,
    public actualPhase: EventPhase,
  ) {
    super(`このフェーズ(${actualPhase})では実行できません`);
    this.name = 'PhaseMismatchError';
  }
}

export class DuplicateVoteError extends Error {
  constructor(public anonId: string) {
    super('既に投票済みです');
    this.name = 'DuplicateVoteError';
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super('認証が必要です');
    this.name = 'UnauthorizedError';
  }
}
