import type { FlowFighter, PickMethod } from './picksFlow';

// A value the database does not have renders as an em dash — never blank,
// never the string "null".
export const MISSING = '—';

export function splitFighterName(fullName: string): { given: string; surname: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { given: '', surname: '' };
  }
  if (parts.length === 1) {
    return { given: '', surname: parts[0] };
  }
  return { given: parts.slice(0, -1).join(' '), surname: parts[parts.length - 1] };
}

export function fighterInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** `21-4-0`, dropping a draw count the database does not have. */
export function formatRecord(fighter: FlowFighter | null): string {
  if (!fighter || fighter.wins == null || fighter.losses == null) {
    return MISSING;
  }
  const base = `${fighter.wins}-${fighter.losses}`;
  return fighter.draws == null ? base : `${base}-${fighter.draws}`;
}

export function ageFromDateOfBirth(dateOfBirth: string | null | undefined, nowMs: number): number | null {
  if (!dateOfBirth) {
    return null;
  }
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }
  const now = new Date(nowMs);
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) {
    age -= 1;
  }
  return age >= 0 && age < 120 ? age : null;
}

export function formatText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : MISSING;
}

/** Winner only 10 · winner + method 25 · winner + method + round 100. */
export function pickPoints(hasWinner: boolean, method: PickMethod | null, round: number | null): number | null {
  if (!hasWinner) {
    return null;
  }
  if (!method) {
    return 10;
  }
  return round != null ? 100 : 25;
}

export function roundOptions(isFiveRoundFight: boolean): number[] {
  return isFiveRoundFight ? [1, 2, 3, 4, 5] : [1, 2, 3];
}
