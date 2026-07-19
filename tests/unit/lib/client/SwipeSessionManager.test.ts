import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SwipeSessionManager } from '@/lib/client/SwipeSessionManager';
import type { Logo } from '@/lib/types/Logo';

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

function createLogos(count: number): Logo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `logo-${i}`,
    imageUrl: `https://example.com/logo-${i}.jpg`,
    uploaderName: '',
    memo: `メモ${i}`,
    createdAt: new Date(),
  }));
}

describe('SwipeSessionManager', () => {
  beforeEach(() => {
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: createFakeLocalStorage(),
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('新規セッションでは全Logoがorderに含まれる', () => {
    const logos = createLogos(5);
    const manager = new SwipeSessionManager(logos);

    expect(manager.getTotalCount()).toBe(5);
    expect(manager.getRemainingCount()).toBe(5);
    expect(manager.isComplete()).toBe(false);
  });

  it('recordDecisionでkeepしたLogoがgetKeptLogosに含まれる', () => {
    const logos = createLogos(3);
    const manager = new SwipeSessionManager(logos);

    const first = manager.getCurrentLogo();
    expect(first).toBeDefined();
    manager.recordDecision(first!.id, 'keep');

    expect(manager.getKeptLogos()).toHaveLength(1);
    expect(manager.getKeptLogos()[0].id).toBe(first!.id);
    expect(manager.getRemainingCount()).toBe(2);
  });

  it('skipしたLogoはgetKeptLogosに含まれない', () => {
    const logos = createLogos(2);
    const manager = new SwipeSessionManager(logos);

    const first = manager.getCurrentLogo();
    manager.recordDecision(first!.id, 'skip');

    expect(manager.getKeptLogos()).toHaveLength(0);
  });

  it('全件仕分けするとisCompleteがtrueになる', () => {
    const logos = createLogos(2);
    const manager = new SwipeSessionManager(logos);

    manager.recordDecision(manager.getCurrentLogo()!.id, 'keep');
    manager.recordDecision(manager.getCurrentLogo()!.id, 'skip');

    expect(manager.isComplete()).toBe(true);
    expect(manager.getCurrentLogo()).toBeUndefined();
  });

  it('同じlocalStorageを共有する新しいインスタンスはセッションを復元する', () => {
    const logos = createLogos(3);
    const first = new SwipeSessionManager(logos);
    const firstLogo = first.getCurrentLogo();
    first.recordDecision(firstLogo!.id, 'keep');

    const second = new SwipeSessionManager(logos);

    expect(second.getRemainingCount()).toBe(2);
    expect(second.getKeptLogos().map((l) => l.id)).toEqual([firstLogo!.id]);
  });

  it('Logo構成が変わった場合は新規セッションとして再シャッフルする', () => {
    const logos = createLogos(3);
    const first = new SwipeSessionManager(logos);
    first.recordDecision(first.getCurrentLogo()!.id, 'keep');

    const differentLogos = createLogos(4);
    const second = new SwipeSessionManager(differentLogos);

    expect(second.getTotalCount()).toBe(4);
    expect(second.getRemainingCount()).toBe(4);
  });
});
