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

/** `Submission` -> `SUB`, `Decision` -> `DEC`, `KO/TKO` stays. */
export function shortMethodLabel(method: PickMethod): string {
  if (method === 'Submission') {
    return 'SUB';
  }
  if (method === 'Decision') {
    return 'DEC';
  }
  return method;
}

/** `KO/TKO · R2`, `SUB · R3`, `DEC`, or `WINNER` when no method was chosen. */
export function pickResultLine(method: PickMethod | null, round: number | null): string {
  if (!method) {
    return 'WINNER';
  }
  const label = shortMethodLabel(method);
  return round != null ? `${label} · R${round}` : label;
}

export type FormResult = 'W' | 'L' | 'D' | 'N';
const FORM_RESULTS: readonly string[] = ['W', 'L', 'D', 'N'];

/**
 * `last_five` oldest-first, newest-last. Anything outside W/L/D/N — including
 * a null or empty column, which is every fighter's state until the backfill
 * job runs — is dropped rather than shown, character by character.
 */
export function parseLastFive(value: string | null | undefined): FormResult[] {
  if (!value) {
    return [];
  }
  return value.split('').filter((char): char is FormResult => FORM_RESULTS.includes(char));
}
