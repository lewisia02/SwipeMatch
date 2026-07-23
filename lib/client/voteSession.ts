const STORAGE_KEY_PREFIX = 'swipematch:voted';

export function hasVoted(competitionId: string, round: number): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(`${STORAGE_KEY_PREFIX}:${competitionId}:${round}`) !== null;
}

export function markVoted(competitionId: string, round: number): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${STORAGE_KEY_PREFIX}:${competitionId}:${round}`, '1');
}
