import type { EventPhase } from './types/Competition';

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

export class RunoffNotOpenError extends Error {
  constructor() {
    super('ランオフの投票受付中ではありません');
    this.name = 'RunoffNotOpenError';
  }
}

export class RunoffNotEligibleError extends Error {
  constructor() {
    super('通常の決選投票をしていないため、ランオフには参加できません');
    this.name = 'RunoffNotEligibleError';
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super('認証が必要です');
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends Error {
  constructor(message = '対象が見つかりません') {
    super(message);
    this.name = 'NotFoundError';
  }
}
