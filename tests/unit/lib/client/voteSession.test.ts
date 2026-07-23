import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hasVoted, markVoted } from '@/lib/client/voteSession';

function createFakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

describe('voteSession', () => {
  beforeEach(() => {
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: createFakeLocalStorage(),
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('未設定の場合、falseを返す', () => {
    expect(hasVoted('comp-1', 1)).toBe(false);
  });

  it('markVotedした後、同じcompetitionId・同じroundでhasVotedがtrueを返す', () => {
    markVoted('comp-1', 1);

    expect(hasVoted('comp-1', 1)).toBe(true);
  });

  it('異なるcompetitionIdではhasVotedがfalseのままである', () => {
    markVoted('comp-1', 1);

    expect(hasVoted('comp-2', 1)).toBe(false);
  });

  it('同じcompetitionIdでも異なるroundではhasVotedがfalseのままである（ランオフは別ラウンドとして扱う）', () => {
    markVoted('comp-1', 1);

    expect(hasVoted('comp-1', 2)).toBe(false);
  });
});
