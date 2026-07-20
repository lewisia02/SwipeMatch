import { shuffle } from '@/lib/algorithms/shuffle';
import type { Logo } from '@/lib/types/Logo';

const STORAGE_KEY_PREFIX = 'swipematch:swipe-session';

export type SwipeDecision = 'keep' | 'skip';

export interface SwipeSession {
  order: string[];
  decisions: Record<string, SwipeDecision>;
  currentIndex: number;
}

export class SwipeSessionManager {
  private logosById = new Map<string, Logo>();
  private session: SwipeSession;
  private storageKey: string;

  // storageKeyにcompetitionId（またはslug）を含め、コンペをまたいでキープ状態が混在しないようにする
  constructor(competitionId: string, logos: Logo[]) {
    this.storageKey = `${STORAGE_KEY_PREFIX}:${competitionId}`;
    for (const logo of logos) {
      this.logosById.set(logo.id, logo);
    }
    this.session = this.loadOrCreateSession(logos);
  }

  loadOrCreateSession(logos: Logo[]): SwipeSession {
    const stored = this.readStoredSession();
    if (stored && this.isValidForLogos(stored, logos)) {
      return stored;
    }

    const session: SwipeSession = {
      order: shuffle(logos.map((logo) => logo.id)),
      decisions: {},
      currentIndex: 0,
    };
    this.writeStoredSession(session);
    return session;
  }

  recordDecision(logoId: string, decision: SwipeDecision): void {
    this.session = {
      ...this.session,
      decisions: { ...this.session.decisions, [logoId]: decision },
      currentIndex: this.session.currentIndex + 1,
    };
    this.writeStoredSession(this.session);
  }

  getCurrentLogo(): Logo | undefined {
    const logoId = this.session.order[this.session.currentIndex];
    return logoId ? this.logosById.get(logoId) : undefined;
  }

  getKeptLogos(): Logo[] {
    return this.session.order
      .filter((logoId) => this.session.decisions[logoId] === 'keep')
      .map((logoId) => this.logosById.get(logoId))
      .filter((logo): logo is Logo => logo !== undefined);
  }

  getRemainingCount(): number {
    return this.session.order.length - this.session.currentIndex;
  }

  getTotalCount(): number {
    return this.session.order.length;
  }

  isComplete(): boolean {
    return this.session.currentIndex >= this.session.order.length;
  }

  private isValidForLogos(session: SwipeSession, logos: Logo[]): boolean {
    const currentIds = new Set(logos.map((logo) => logo.id));
    return (
      session.order.length === currentIds.size &&
      session.order.every((id) => currentIds.has(id))
    );
  }

  private readStoredSession(): SwipeSession | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as SwipeSession;
    } catch {
      return null;
    }
  }

  private writeStoredSession(session: SwipeSession): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(this.storageKey, JSON.stringify(session));
  }
}
