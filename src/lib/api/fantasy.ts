import { buildWebApiUrl } from '@/src/lib/webApi';

export type FantasyLeaderboardStanding = {
  country?: string | null;
  displayName: string;
  points: number;
  rank: number;
  raw: Record<string, unknown>;
  userId?: string | null;
};

type LeaderboardApiResponse = {
  standings?: unknown;
};

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
}

function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
}

export async function getFantasyLeaderboard(accessToken?: string | null) {
  const url = buildWebApiUrl('/api/fantasy/leaderboard');

  if (!url) {
    return {
      error: 'Leaderboard API is not configured for this native build.',
      standings: [] as FantasyLeaderboardStanding[],
    };
  }

  try {
    const response = await fetch(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });

    if (!response.ok) {
      return {
        error: 'Could not load leaderboard. Try again later.',
        standings: [] as FantasyLeaderboardStanding[],
      };
    }

    const payload = (await response.json()) as LeaderboardApiResponse;
    const rows = Array.isArray(payload.standings) ? payload.standings : [];

    const standings = rows
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
      .map((row, index) => {
        const displayName =
          readString(row, ['username', 'display_name', 'name']) ||
          readString(row, ['email'])?.split('@')[0] ||
          'Collector';
        const points = readNumber(row, ['total_points', 'totalPoints', 'points', 'score']);
        const rank = readNumber(row, ['rank', 'position']) || index + 1;

        return {
          country: readString(row, ['country']),
          displayName,
          points,
          rank,
          raw: row,
          userId: readString(row, ['user_id', 'userId', 'id']),
        };
      });

    return { error: null, standings };
  } catch {
    return {
      error: 'Could not load leaderboard. Try again later.',
      standings: [] as FantasyLeaderboardStanding[],
    };
  }
}
