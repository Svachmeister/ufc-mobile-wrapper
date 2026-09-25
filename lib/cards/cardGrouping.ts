export type SetRow = {
  id: string;
  name: string;
  year: number;
  manufacturer: string;
  sort_order: number;
};

export type SetYearGroup = {
  year: number;
  sets: SetRow[];
};

export function groupSetsByYear(sets: SetRow[]): SetYearGroup[] {
  const byYear = new Map<number, SetRow[]>();
  for (const set of sets) {
    const existing = byYear.get(set.year);
    if (existing) {
      existing.push(set);
    } else {
      byYear.set(set.year, [set]);
    }
  }

  const groups = Array.from(byYear.entries()).map(([year, yearSets]) => ({
    year,
    sets: [...yearSets].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
  }));

  groups.sort((a, b) => b.year - a.year);
  return groups;
}

/** "Base Set" always leads if present; the rest are alphabetical — the ticket
 * gives no other ordering signal for subsets. */
export function orderSubsets(subsets: string[]): string[] {
  const unique = Array.from(new Set(subsets)).sort((a, b) => a.localeCompare(b));
  const baseIndex = unique.indexOf('Base Set');
  if (baseIndex > 0) {
    const [base] = unique.splice(baseIndex, 1);
    unique.unshift(base);
  }
  return unique;
}

/**
 * Natural sort on card_number: digit runs compare numerically ("2" before
 * "10"), everything else compares as text, so alphanumeric codes like
 * "RA-AP" fall in with their neighbors instead of before every plain digit.
 */
function naturalSortParts(value: string): (string | number)[] {
  const matches = value.match(/\d+|\D+/g);
  if (!matches) {
    return [value];
  }
  return matches.map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

export function compareCardNumbers(a: string, b: string): number {
  const partsA = naturalSortParts(a);
  const partsB = naturalSortParts(b);
  const length = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < length; i++) {
    const partA = partsA[i];
    const partB = partsB[i];
    if (partA === undefined) return -1;
    if (partB === undefined) return 1;
    if (typeof partA === 'number' && typeof partB === 'number') {
      if (partA !== partB) return partA - partB;
      continue;
    }
    const strA = String(partA);
    const strB = String(partB);
    if (strA !== strB) return strA.localeCompare(strB);
  }
  return 0;
}

export type ParallelInfo = {
  id: string;
  variation: string;
  print_run: number | null;
};

/** Largest print run first, unnumbered ahead of all numbered ones, 1/1 last. */
export function sortParallels(parallels: ParallelInfo[]): ParallelInfo[] {
  return [...parallels].sort((a, b) => {
    if (a.print_run == null && b.print_run == null) return 0;
    if (a.print_run == null) return -1;
    if (b.print_run == null) return 1;
    return b.print_run - a.print_run;
  });
}

export function parallelChipLabel(parallel: ParallelInfo): string {
  if (parallel.print_run === 1) {
    return '1/1';
  }
  if (parallel.print_run == null) {
    return parallel.variation;
  }
  return `${parallel.variation} /${parallel.print_run}`;
}

export type ChecklistRow = {
  id: string;
  card_number: string;
  variation: string;
  print_run: number | null;
  fighter_name: string;
  is_rookie: boolean;
};

export type ChecklistCard = {
  card_number: string;
  fighter_name: string;
  is_rookie: boolean;
  parallels: ParallelInfo[];
};

/**
 * Groups by card_number regardless of which loaded page a row came from, so
 * a card whose parallels straddle two .range() pages still merges into one
 * row once both pages have arrived (and shows a partial chip set in the
 * meantime, since rows render as pages come in).
 */
export function groupChecklistRows(rows: ChecklistRow[]): ChecklistCard[] {
  const byNumber = new Map<string, ChecklistCard>();

  for (const row of rows) {
    let card = byNumber.get(row.card_number);
    if (!card) {
      card = {
        card_number: row.card_number,
        fighter_name: row.fighter_name,
        is_rookie: row.is_rookie,
        parallels: [],
      };
      byNumber.set(row.card_number, card);
    }
    card.is_rookie = card.is_rookie || row.is_rookie;
    card.parallels.push({ id: row.id, variation: row.variation, print_run: row.print_run });
  }

  return Array.from(byNumber.values())
    .map((card) => ({ ...card, parallels: sortParallels(card.parallels) }))
    .sort((a, b) => compareCardNumbers(a.card_number, b.card_number));
}
