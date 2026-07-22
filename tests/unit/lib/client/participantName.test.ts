import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getParticipantName, setParticipantName } from '@/lib/client/participantName';

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

describe('participantName', () => {
  beforeEach(() => {
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: createFakeLocalStorage(),
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('未設定の場合、nullを返す', () => {
    expect(getParticipantName()).toBeNull();
  });

  it('設定した名前を取得できる', () => {
    setParticipantName('やまだ');

    expect(getParticipantName()).toBe('やまだ');
  });
});
