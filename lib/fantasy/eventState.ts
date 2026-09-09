export type EventRow = {
  id: string;
  name: string;
  event_date: string;
  start_time: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  picks_locked: boolean;
  starts_at: string;
  picks_close_at: string | null;
};

export type FightRow = {
  event_id: string;
  fighter1: string;
  fighter2: string;
  winner: string | null;
  is_main_event: boolean;
  fight_order: number;
};

export type EventState = 'FINAL' | 'LIVE' | 'LOCKED' | 'OPEN';

/**
 * Only the fight actually flagged is_main_event counts toward finality —
 * the fight_order fallback below is for display only, per the ticket's
 * separate rules for "event state" vs. "main event display".
 */
export function isEventFinal(fights: FightRow[]): boolean {
  const mainEventFight = fights.find((fight) => fight.is_main_event) ?? null;
  return mainEventFight != null && mainEventFight.winner != null;
}

export function selectDisplayMainEventFight(fights: FightRow[]): FightRow | null {
  const mainEventFight = fights.find((fight) => fight.is_main_event);
  if (mainEventFight) {
    return mainEventFight;
  }
  if (fights.length === 0) {
    return null;
  }
  return fights.reduce((best, fight) => (fight.fight_order > best.fight_order ? fight : best), fights[0]);
}

export function deriveEventState(event: EventRow, fights: FightRow[], nowMs: number): EventState {
  if (isEventFinal(fights)) {
    return 'FINAL';
  }

  const startsAtMs = new Date(event.starts_at).getTime();
  if (nowMs >= startsAtMs) {
    return 'LIVE';
  }

  const picksCloseMs = event.picks_close_at ? new Date(event.picks_close_at).getTime() : null;
  if (event.picks_locked || (picksCloseMs != null && nowMs >= picksCloseMs)) {
    return 'LOCKED';
  }

  return 'OPEN';
}

export function shortEventName(name: string): string {
  const colonIndex = name.indexOf(':');
  return colonIndex === -1 ? name : name.slice(0, colonIndex).trim();
}

export function surname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export function formatShortEventDate(isoDate: string): string {
  const formatted = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(isoDate));
  return formatted.replace(',', '').toUpperCase();
}

export function formatLocalStartTime(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

export function formatCountdown(targetIso: string, nowMs: number): string {
  const diffMs = new Date(targetIso).getTime() - nowMs;
  if (diffMs <= 0) {
    return '0h';
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}
