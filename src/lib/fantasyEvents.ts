export type NativeFantasyEventBase = {
  event_date: string | null;
  id: string;
  name: string | null;
  picks_close_at: string | null;
  picks_locked: boolean | null;
  starts_at: string | null;
  status: string | null;
};

function getEventTimeValue(event: NativeFantasyEventBase) {
  const value = event.starts_at || event.event_date;
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function getUpcomingFantasyEvents<T extends NativeFantasyEventBase>(events: T[]) {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  return events
    .filter((event) => {
      if (event.status === 'upcoming') return true;
      if (event.starts_at && Date.parse(event.starts_at) > now) return true;
      return Boolean(event.event_date && event.event_date >= today);
    })
    .sort((a, b) => getEventTimeValue(a) - getEventTimeValue(b));
}

export function getNextFantasyEvent<T extends NativeFantasyEventBase>(events: T[]) {
  return getUpcomingFantasyEvents(events)[0] ?? null;
}

export function formatFantasyEventDate(value?: string | null) {
  if (!value) return 'Date TBA';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date TBA';

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function getFantasyPickStatus(event: NativeFantasyEventBase | null) {
  if (!event) return 'Awaiting card';
  if (event.picks_locked) return 'Picks closed';
  if (!event.picks_close_at) return 'Picks open';

  const closeTime = Date.parse(event.picks_close_at);
  if (!Number.isFinite(closeTime)) return 'Picks open';

  return Date.now() >= closeTime ? 'Picks closed' : 'Picks open';
}
