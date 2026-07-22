const STORAGE_KEY = 'swipematch_participant_name';

export function getParticipantName(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setParticipantName(name: string): void {
  window.localStorage.setItem(STORAGE_KEY, name);
}
